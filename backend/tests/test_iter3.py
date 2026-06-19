"""Iter 3 tests: Company info + logo upload."""
import os
import io
import struct
import zlib
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").rstrip("/")
API = f"{BASE_URL}/api"


def make_png(size=8) -> bytes:
    """Return a minimal valid 1x1 PNG."""
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    ihdr_crc = zlib.crc32(b"IHDR" + ihdr)
    ihdr_chunk = struct.pack(">I", 13) + b"IHDR" + ihdr + struct.pack(">I", ihdr_crc)
    raw = b"\x00\xff\x00\x00"
    comp = zlib.compress(raw)
    idat_crc = zlib.crc32(b"IDAT" + comp)
    idat_chunk = struct.pack(">I", len(comp)) + b"IDAT" + comp + struct.pack(">I", idat_crc)
    iend_crc = zlib.crc32(b"IEND")
    iend_chunk = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", iend_crc)
    return sig + ihdr_chunk + idat_chunk + iend_chunk


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return login("admin@crm.com", "admin123")


@pytest.fixture(scope="module")
def vendedor_token():
    return login("vendedor@crm.com", "vendedor123")


@pytest.fixture(scope="module")
def supervisor_token():
    return login("supervisor@crm.com", "supervisor123")


# --- GET /api/company ---
class TestCompanyGet:
    def test_get_company_admin(self, admin_token):
        r = requests.get(f"{API}/company", headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["id"] == "demo-company"
        assert "name" in data

    def test_get_company_vendedor(self, vendedor_token):
        r = requests.get(f"{API}/company", headers=h(vendedor_token), timeout=15)
        assert r.status_code == 200
        assert r.json().get("id") == "demo-company"

    def test_get_company_unauth(self):
        r = requests.get(f"{API}/company", timeout=15)
        assert r.status_code == 401


# --- PUT /api/company ---
class TestCompanyUpdate:
    def test_update_company_admin(self, admin_token):
        payload = {"name": "Constructora Demo", "address": "Av. Reforma 100", "phone": "+52 55 1234 5678", "email": "info@demo.mx", "rfc": "DEM010101AAA"}
        r = requests.put(f"{API}/company", json=payload, headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["address"] == "Av. Reforma 100"
        assert data["rfc"] == "DEM010101AAA"
        # Verify persistence via GET
        g = requests.get(f"{API}/company", headers=h(admin_token), timeout=15).json()
        assert g["phone"] == "+52 55 1234 5678"
        assert g["email"] == "info@demo.mx"

    def test_update_company_vendedor_forbidden(self, vendedor_token):
        r = requests.put(f"{API}/company", json={"name": "Hack"}, headers=h(vendedor_token), timeout=15)
        assert r.status_code == 403

    def test_update_company_supervisor_forbidden(self, supervisor_token):
        r = requests.put(f"{API}/company", json={"name": "Hack"}, headers=h(supervisor_token), timeout=15)
        assert r.status_code == 403

    def test_update_company_ignores_unknown_fields(self, admin_token):
        # Sending arbitrary fields should be silently dropped; only allowlist applied
        r = requests.put(f"{API}/company", json={"company_id": "evil", "id": "evil", "name": "Constructora Demo"}, headers=h(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == "demo-company"


# --- POST /api/company/logo & GET /api/company/logo ---
class TestCompanyLogo:
    def test_logo_upload_non_image_rejected(self, admin_token):
        files = {"file": ("evil.txt", b"not an image", "text/plain")}
        r = requests.post(f"{API}/company/logo", files=files, headers=h(admin_token), timeout=30)
        assert r.status_code == 400

    def test_logo_upload_too_big(self, admin_token):
        big = b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 10)
        files = {"file": ("big.png", big, "image/png")}
        r = requests.post(f"{API}/company/logo", files=files, headers=h(admin_token), timeout=60)
        assert r.status_code == 413

    def test_logo_upload_vendedor_forbidden(self, vendedor_token):
        files = {"file": ("logo.png", make_png(), "image/png")}
        r = requests.post(f"{API}/company/logo", files=files, headers=h(vendedor_token), timeout=30)
        assert r.status_code == 403

    def test_logo_upload_admin_ok_and_get(self, admin_token):
        png = make_png()
        files = {"file": ("logo.png", png, "image/png")}
        r = requests.post(f"{API}/company/logo", files=files, headers=h(admin_token), timeout=60)
        # If storage is not available (503) we skip; otherwise must be 200
        if r.status_code == 503:
            pytest.skip("Object storage unavailable in this environment")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "logo_path" in data and data["logo_path"]

        # GET /api/company should now show logo_path
        g = requests.get(f"{API}/company", headers=h(admin_token), timeout=15).json()
        assert g.get("logo_path")

        # GET /api/company/logo streams bytes
        lg = requests.get(f"{API}/company/logo", headers=h(admin_token), timeout=30)
        assert lg.status_code == 200
        assert lg.headers["content-type"].startswith("image/")
        assert len(lg.content) > 0


# --- Multi-tenant isolation ---
class TestCompanyMultiTenant:
    def test_logo_isolation_between_tenants(self, admin_token):
        # Register a fresh company
        suffix = uuid.uuid4().hex[:8]
        reg = requests.post(f"{API}/auth/register-company", json={
            "company_name": f"TEST_T_{suffix}",
            "admin_name": "T Admin",
            "admin_email": f"t_admin_{suffix}@test.com",
            "admin_password": "TestPass123!",
        }, timeout=20)
        assert reg.status_code == 200, reg.text
        t_token = reg.json()["token"]

        # Tenant B has no logo yet
        r = requests.get(f"{API}/company/logo", headers=h(t_token), timeout=15)
        assert r.status_code == 404

        # Tenant B GET /company returns own company (not demo-company)
        own = requests.get(f"{API}/company", headers=h(t_token), timeout=15).json()
        assert own["id"] != "demo-company"
        assert own["name"] == f"TEST_T_{suffix}"

        # Upload a logo to tenant B
        files = {"file": ("logo.png", make_png(), "image/png")}
        up = requests.post(f"{API}/company/logo", files=files, headers=h(t_token), timeout=60)
        if up.status_code == 503:
            pytest.skip("Object storage unavailable")
        assert up.status_code == 200

        # Tenant B can read its logo
        lg = requests.get(f"{API}/company/logo", headers=h(t_token), timeout=30)
        assert lg.status_code == 200

        # Admin (demo-company) reading its own logo must NOT get tenant B's logo path
        admin_company = requests.get(f"{API}/company", headers=h(admin_token), timeout=15).json()
        tenant_b_company = requests.get(f"{API}/company", headers=h(t_token), timeout=15).json()
        assert admin_company.get("logo_path") != tenant_b_company.get("logo_path")
