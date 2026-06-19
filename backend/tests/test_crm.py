"""Backend tests for Construccion CRM API."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sitemanager-30.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@crm.com", "password": "admin123"}
VENDEDOR = {"email": "vendedor@crm.com", "password": "vendedor123"}
SUPERVISOR = {"email": "supervisor@crm.com", "password": "supervisor123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _login(ADMIN)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def vendedor_token():
    r = _login(VENDEDOR)
    assert r.status_code == 200, f"Vendedor login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def supervisor_token():
    r = _login(SUPERVISOR)
    assert r.status_code == 200, f"Supervisor login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------ AUTH ------
class TestAuth:
    def test_login_admin(self):
        r = _login(ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@crm.com"
        assert data["role"] == "admin"
        assert "token" in data and len(data["token"]) > 0
        # Verify cookie
        assert "access_token" in r.cookies or any("access_token" in c for c in r.headers.get("set-cookie", "").split(","))

    def test_login_vendedor(self):
        r = _login(VENDEDOR)
        assert r.status_code == 200
        assert r.json()["role"] == "vendedor"

    def test_login_supervisor(self):
        r = _login(SUPERVISOR)
        assert r.status_code == 200
        assert r.json()["role"] == "supervisor"

    def test_login_invalid(self):
        r = _login({"email": "admin@crm.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_endpoint(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@crm.com"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ------ USERS (admin only) ------
class TestUsers:
    def test_admin_list_users(self, admin_token):
        r = requests.get(f"{API}/users", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_vendedor_forbidden_users(self, vendedor_token):
        r = requests.get(f"{API}/users", headers=H(vendedor_token), timeout=10)
        assert r.status_code == 403

    def test_supervisor_forbidden_users(self, supervisor_token):
        r = requests.get(f"{API}/users", headers=H(supervisor_token), timeout=10)
        assert r.status_code == 403

    def test_create_and_delete_user(self, admin_token):
        ts = int(time.time())
        payload = {"name": "TEST User", "email": f"TEST_user_{ts}@crm.com", "password": "test1234", "role": "vendedor"}
        r = requests.post(f"{API}/users", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        new_user = r.json()
        assert new_user["email"] == payload["email"].lower()
        # Delete user (admin only)
        r2 = requests.delete(f"{API}/users/{new_user['id']}", headers=H(admin_token), timeout=10)
        assert r2.status_code == 200

    def test_vendedor_cannot_delete_user(self, vendedor_token, admin_token):
        # Create test user
        ts = int(time.time())
        payload = {"name": "TEST User2", "email": f"TEST_user2_{ts}@crm.com", "password": "test1234", "role": "vendedor"}
        r = requests.post(f"{API}/users", headers=H(admin_token), json=payload, timeout=10)
        uid = r.json()["id"]
        # Vendedor tries to delete
        r2 = requests.delete(f"{API}/users/{uid}", headers=H(vendedor_token), timeout=10)
        assert r2.status_code == 403
        # Clean up
        requests.delete(f"{API}/users/{uid}", headers=H(admin_token), timeout=10)


# ------ CLIENTS CRUD ------
class TestClients:
    def test_clients_crud(self, admin_token):
        # Create
        payload = {"name": "TEST_Cliente", "company": "TEST Co", "email": "test@cli.com", "stage": "lead"}
        r = requests.post(f"{API}/clients", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        cli = r.json()
        cid = cli["id"]
        assert cli["name"] == "TEST_Cliente"
        # Get
        r2 = requests.get(f"{API}/clients/{cid}", headers=H(admin_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["company"] == "TEST Co"
        # Update
        r3 = requests.put(f"{API}/clients/{cid}", headers=H(admin_token), json={**payload, "stage": "contactado"}, timeout=10)
        assert r3.status_code == 200
        assert r3.json()["stage"] == "contactado"
        # List
        r4 = requests.get(f"{API}/clients", headers=H(admin_token), timeout=10)
        assert r4.status_code == 200
        assert any(c["id"] == cid for c in r4.json())
        # Delete
        r5 = requests.delete(f"{API}/clients/{cid}", headers=H(admin_token), timeout=10)
        assert r5.status_code == 200
        # Verify deleted
        r6 = requests.get(f"{API}/clients/{cid}", headers=H(admin_token), timeout=10)
        assert r6.status_code == 404


# ------ PROJECTS ------
class TestProjects:
    def test_projects_crud(self, admin_token):
        payload = {"name": "TEST_Project", "status": "planificacion", "progress": 25, "budget": 100000}
        r = requests.post(f"{API}/projects", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["progress"] == 25
        # Verify GET
        g = requests.get(f"{API}/projects/{pid}", headers=H(admin_token), timeout=10)
        assert g.status_code == 200
        # Delete
        requests.delete(f"{API}/projects/{pid}", headers=H(admin_token), timeout=10)


# ------ SUPPLIERS ------
class TestSuppliers:
    def test_suppliers_crud(self, admin_token):
        payload = {"name": "TEST_Supplier", "type": "proveedor", "rating": 4}
        r = requests.post(f"{API}/suppliers", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200
        sid = r.json()["id"]
        requests.delete(f"{API}/suppliers/{sid}", headers=H(admin_token), timeout=10)


# ------ MATERIALS ------
class TestMaterials:
    def test_materials_crud(self, admin_token):
        ts = int(time.time())
        payload = {"sku": f"TEST-SKU-{ts}", "name": "TEST_Material", "unit": "kg", "stock": 50, "min_stock": 10, "unit_cost": 25.5}
        r = requests.post(f"{API}/materials", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        assert r.json()["sku"] == payload["sku"]
        # Cleanup at end of class via finalizer would be nice; do inline
        requests.delete(f"{API}/materials/{mid}", headers=H(admin_token), timeout=10)


# ------ QUOTES ------
class TestQuotes:
    def test_quote_auto_number_and_totals(self, admin_token):
        payload = {
            "client_name": "TEST_Cliente",
            "items": [
                {"description": "Item A", "quantity": 2, "unit_price": 100, "unit": "und"},
                {"description": "Item B", "quantity": 3, "unit_price": 50, "unit": "und"},
            ],
            "tax_rate": 16.0,
            "status": "borrador",
        }
        r = requests.post(f"{API}/quotes", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["number"].startswith("COT-")
        assert q["subtotal"] == 350.0
        assert q["tax"] == 56.0
        assert q["total"] == 406.0
        # Cleanup
        requests.delete(f"{API}/quotes/{q['id']}", headers=H(admin_token), timeout=10)


# ------ REQUISITIONS ------
class TestRequisitions:
    def test_req_auto_number_and_requester(self, admin_token):
        payload = {
            "project_name": "TEST_Project",
            "items": [{"material_id": "mat-1", "material_name": "Cemento", "quantity": 5, "unit": "saco"}],
            "notes": "TEST req",
        }
        r = requests.post(f"{API}/requisitions", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        req = r.json()
        assert req["number"].startswith("REQ-")
        assert req["requested_by_name"] == "Administrador"
        rid = req["id"]
        # Approve as admin
        r2 = requests.put(f"{API}/requisitions/{rid}/status?status=aprobada", headers=H(admin_token), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["status"] == "aprobada"
        # Cleanup
        requests.delete(f"{API}/requisitions/{rid}", headers=H(admin_token), timeout=10)

    def test_supervisor_can_approve(self, admin_token, supervisor_token):
        # Create
        r = requests.post(f"{API}/requisitions", headers=H(admin_token), json={"items": []}, timeout=10)
        rid = r.json()["id"]
        r2 = requests.put(f"{API}/requisitions/{rid}/status?status=aprobada", headers=H(supervisor_token), timeout=10)
        assert r2.status_code == 200
        requests.delete(f"{API}/requisitions/{rid}", headers=H(admin_token), timeout=10)

    def test_vendedor_cannot_approve(self, admin_token, vendedor_token):
        r = requests.post(f"{API}/requisitions", headers=H(admin_token), json={"items": []}, timeout=10)
        rid = r.json()["id"]
        r2 = requests.put(f"{API}/requisitions/{rid}/status?status=aprobada", headers=H(vendedor_token), timeout=10)
        assert r2.status_code == 403
        requests.delete(f"{API}/requisitions/{rid}", headers=H(admin_token), timeout=10)


# ------ EVENTS ------
class TestEvents:
    def test_events_crud(self, admin_token):
        payload = {"title": "TEST_Event", "date": "2026-01-15T10:00:00", "type": "reunion"}
        r = requests.post(f"{API}/events", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200
        eid = r.json()["id"]
        requests.delete(f"{API}/events/{eid}", headers=H(admin_token), timeout=10)


# ------ DASHBOARD / REPORTS ------
class TestDashboard:
    def test_dashboard_stats(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ["clients_count", "leads_count", "won_count", "active_projects",
                  "completed_projects", "pending_quotes", "pending_requisitions",
                  "total_revenue", "low_stock_count"]:
            assert k in d, f"Missing key {k}"

    def test_projects_by_status(self, admin_token):
        r = requests.get(f"{API}/reports/projects-by-status", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_leads_by_stage(self, admin_token):
        r = requests.get(f"{API}/reports/leads-by-stage", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
