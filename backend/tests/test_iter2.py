"""Iteration 2 tests: multi-tenant, password reset, file attachments."""
import os
import time
import io
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sitemanager-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@crm.com", "password": "admin123"}
VENDEDOR = {"email": "vendedor@crm.com", "password": "vendedor123"}
SUPERVISOR = {"email": "supervisor@crm.com", "password": "supervisor123"}


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def Hauth(token):
    return {"Authorization": f"Bearer {token}"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN)
    assert r.status_code == 200, r.text
    j = r.json()
    return j["token"], j.get("company_id", "")


# ------ MULTI-TENANT ------
class TestMultiTenant:
    def test_seeded_admin_has_demo_company(self):
        r = _login(ADMIN)
        assert r.status_code == 200
        d = r.json()
        assert d.get("company_id") == "demo-company", f"expected demo-company, got {d.get('company_id')}"

    def test_seeded_vendedor_supervisor_same_company(self):
        for c in (VENDEDOR, SUPERVISOR):
            r = _login(c)
            assert r.status_code == 200
            assert r.json()["company_id"] == "demo-company"

    def test_register_company_creates_admin(self):
        ts = int(time.time())
        payload = {
            "company_name": f"TEST Tenant {ts}",
            "admin_name": "TEST Admin B",
            "admin_email": f"tenant-b-{ts}@test.com",
            "admin_password": "tenantb123",
        }
        r = requests.post(f"{API}/auth/register-company", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "admin"
        assert d["company_id"] and d["company_id"] != "demo-company"
        assert d["email"] == payload["admin_email"].lower()
        # login with new admin
        r2 = _login({"email": payload["admin_email"], "password": payload["admin_password"]})
        assert r2.status_code == 200, r2.text
        assert r2.json()["company_id"] == d["company_id"]

    def test_register_duplicate_email_rejected(self):
        payload = {
            "company_name": "Dup",
            "admin_name": "Dup",
            "admin_email": "admin@crm.com",
            "admin_password": "x12345",
        }
        r = requests.post(f"{API}/auth/register-company", json=payload, timeout=15)
        assert r.status_code == 400

    def test_cross_tenant_isolation_clients(self, admin_token):
        a_tok, a_cid = admin_token
        # Create client in company A
        cli_payload = {"name": f"TEST_A_Client_{int(time.time())}", "stage": "lead"}
        r = requests.post(f"{API}/clients", headers=H(a_tok), json=cli_payload, timeout=15)
        assert r.status_code == 200, r.text
        a_client_id = r.json()["id"]

        # Register company B
        ts = int(time.time())
        regp = {
            "company_name": f"TEST Tenant B {ts}",
            "admin_name": "Admin B",
            "admin_email": f"tenant-iso-{ts}@test.com",
            "admin_password": "isob123",
        }
        rb = requests.post(f"{API}/auth/register-company", json=regp, timeout=15)
        assert rb.status_code == 200, rb.text
        b_tok = rb.json()["token"]
        b_cid = rb.json()["company_id"]
        assert b_cid != a_cid

        # List clients as B — must not contain A's client
        rl = requests.get(f"{API}/clients", headers=H(b_tok), timeout=15)
        assert rl.status_code == 200
        ids = [c["id"] for c in rl.json()]
        assert a_client_id not in ids, "Cross-tenant leak: company B sees company A's client"

        # GET by id from B must 404
        rg = requests.get(f"{API}/clients/{a_client_id}", headers=H(b_tok), timeout=15)
        assert rg.status_code == 404

        # DELETE attempt from B does not affect A (deletion is silent but scoped)
        requests.delete(f"{API}/clients/{a_client_id}", headers=H(b_tok), timeout=15)
        rg2 = requests.get(f"{API}/clients/{a_client_id}", headers=H(a_tok), timeout=15)
        assert rg2.status_code == 200, "Company B was able to delete company A's client!"

        # cleanup
        requests.delete(f"{API}/clients/{a_client_id}", headers=H(a_tok), timeout=15)


# ------ PASSWORD RESET ------
class TestPasswordReset:
    def test_forgot_password_returns_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "admin@crm.com"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_forgot_password_unknown_email_still_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "noone@nowhere.io"}, timeout=15)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_full_reset_flow(self):
        # Create isolated test user for reset
        ts = int(time.time())
        email = f"reset-{ts}@test.com"
        # Register a new company to avoid disturbing seeded users
        reg = requests.post(f"{API}/auth/register-company", json={
            "company_name": f"Reset Co {ts}",
            "admin_name": "Reset Admin",
            "admin_email": email,
            "admin_password": "oldpass123",
        }, timeout=15)
        assert reg.status_code == 200, reg.text

        # Trigger forgot-password
        r = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
        assert r.status_code == 200

        # Read backend logs to find the reset link/token
        time.sleep(1)
        token = None
        for log_path in ("/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"):
            try:
                # grep for last [PWD RESET] line mentioning our email
                out = subprocess.run(
                    ["grep", "-a", "-F", f"[PWD RESET] Link for {email}", log_path],
                    capture_output=True, text=True, timeout=10,
                )
                if out.stdout:
                    last = out.stdout.strip().splitlines()[-1]
                    if "token=" in last:
                        token = last.split("token=")[-1].strip()
                        break
            except Exception:
                continue
        assert token, f"Could not find [PWD RESET] token for {email} in backend logs"

        # Reset
        new_pw = "newpass456"
        rr = requests.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_pw}, timeout=15)
        assert rr.status_code == 200, rr.text

        # Old pw fails
        old = _login({"email": email, "password": "oldpass123"})
        assert old.status_code == 401

        # New pw works
        new = _login({"email": email, "password": new_pw})
        assert new.status_code == 200

        # Token cannot be re-used
        rr2 = requests.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "x"}, timeout=15)
        assert rr2.status_code == 400

    def test_reset_with_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "bogus", "new_password": "abc12345"}, timeout=15)
        assert r.status_code == 400


# ------ FILE ATTACHMENTS ------
class TestAttachments:
    def _create_project(self, token):
        r = requests.post(f"{API}/projects", headers=H(token),
                          json={"name": f"TEST_AttProj_{int(time.time()*1000)}"}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_attachment_full_cycle(self, admin_token):
        token, _ = admin_token
        pid = self._create_project(token)
        try:
            content = b"Hello attachment world! " + str(time.time()).encode()
            files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
            r = requests.post(f"{API}/projects/{pid}/attachments",
                              headers=Hauth(token), files=files, timeout=60)
            assert r.status_code == 200, r.text
            att = r.json()
            assert att["original_filename"] == "test.txt"
            assert att["project_id"] == pid
            aid = att["id"]

            # list
            lr = requests.get(f"{API}/projects/{pid}/attachments", headers=Hauth(token), timeout=15)
            assert lr.status_code == 200
            assert any(a["id"] == aid for a in lr.json())

            # download
            dr = requests.get(f"{API}/attachments/{aid}/download", headers=Hauth(token), timeout=30)
            assert dr.status_code == 200, dr.text
            assert dr.content == content, "Downloaded content mismatch"

            # delete soft
            xr = requests.delete(f"{API}/attachments/{aid}", headers=Hauth(token), timeout=15)
            assert xr.status_code == 200

            # list no longer contains
            lr2 = requests.get(f"{API}/projects/{pid}/attachments", headers=Hauth(token), timeout=15)
            assert all(a["id"] != aid for a in lr2.json())

            # download deleted -> 404
            dr2 = requests.get(f"{API}/attachments/{aid}/download", headers=Hauth(token), timeout=15)
            assert dr2.status_code == 404
        finally:
            requests.delete(f"{API}/projects/{pid}", headers=H(token), timeout=15)

    def test_attachment_cross_tenant_404(self, admin_token):
        token, _ = admin_token
        pid = self._create_project(token)
        try:
            # Upload as company A
            files = {"file": ("a.txt", io.BytesIO(b"company A secret"), "text/plain")}
            r = requests.post(f"{API}/projects/{pid}/attachments",
                              headers=Hauth(token), files=files, timeout=60)
            assert r.status_code == 200, r.text
            aid = r.json()["id"]

            # Register company B
            ts = int(time.time())
            rb = requests.post(f"{API}/auth/register-company", json={
                "company_name": f"AttCross {ts}",
                "admin_name": "B",
                "admin_email": f"attcross-{ts}@test.com",
                "admin_password": "abc12345",
            }, timeout=15)
            b_tok = rb.json()["token"]

            # B cannot upload to A's project
            files_b = {"file": ("b.txt", io.BytesIO(b"b"), "text/plain")}
            up = requests.post(f"{API}/projects/{pid}/attachments",
                               headers=Hauth(b_tok), files=files_b, timeout=30)
            assert up.status_code == 404

            # B sees empty list (project doesn't belong to B) — endpoint doesn't 404 on list, returns []
            ls = requests.get(f"{API}/projects/{pid}/attachments", headers=Hauth(b_tok), timeout=15)
            assert ls.status_code == 200
            assert ls.json() == []

            # B cannot download A's attachment
            dl = requests.get(f"{API}/attachments/{aid}/download", headers=Hauth(b_tok), timeout=15)
            assert dl.status_code == 404
        finally:
            requests.delete(f"{API}/projects/{pid}", headers=H(token), timeout=15)


# ------ REQUISITION NOTIFY (no-op with empty RESEND) ------
class TestRequisitionNotify:
    def test_approve_does_not_error_without_resend(self, admin_token):
        token, _ = admin_token
        r = requests.post(f"{API}/requisitions", headers=H(token),
                          json={"project_name": "TEST", "items": []}, timeout=15)
        assert r.status_code == 200
        rid = r.json()["id"]
        try:
            r2 = requests.put(f"{API}/requisitions/{rid}/status?status=aprobada",
                              headers=H(token), timeout=15)
            assert r2.status_code == 200
            assert r2.json()["status"] == "aprobada"
        finally:
            requests.delete(f"{API}/requisitions/{rid}", headers=H(token), timeout=15)
