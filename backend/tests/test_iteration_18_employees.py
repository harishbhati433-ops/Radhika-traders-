"""Iteration 18 - Employee Management + Activity Logs + RBAC."""
import os
import time
import pytest
import requests

def _load_base():
    b = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not b:
        try:
            for line in open("/app/frontend/.env"):
                if line.startswith("REACT_APP_BACKEND_URL="):
                    b = line.split("=", 1)[1].strip()
                    break
        except Exception:
            pass
    return b.rstrip("/")


BASE = _load_base()
API = f"{BASE}/api"

ADMIN = {"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"}
CUST = {"email": "testcust@example.com", "password": "Test@1234"}
RAHUL = {"username": "rahul.k", "password": "Emp@1234"}

TS = str(int(time.time()))[-6:]
NEW_EMP_USERNAME = f"test_emp_{TS}"
NEW_EMP_PW = "Test@Emp1"


def _post(path, json=None, token=None, **kw):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json, headers=h, timeout=30, **kw)


def _get(path, token=None, **kw):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, timeout=30, **kw)


def _patch(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.patch(f"{API}{path}", json=json, headers=h, timeout=30)


def _delete(path, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.delete(f"{API}{path}", headers=h, timeout=30)


@pytest.fixture(scope="module")
def admin_token():
    r = _post("/auth/login", ADMIN)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_token():
    r = _post("/auth/login", CUST)
    if r.status_code != 200:
        pytest.skip("Customer login failed")
    return r.json()["token"]


@pytest.fixture(scope="module")
def rahul_token():
    r = _post("/auth/employee/login", RAHUL)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------------- Admin regression ----------------
class TestAdminRegression:
    def test_dashboard(self, admin_token):
        assert _get("/admin/dashboard", admin_token).status_code == 200

    def test_leads(self, admin_token):
        assert _get("/admin/leads", admin_token).status_code == 200

    def test_withdrawals(self, admin_token):
        assert _get("/admin/withdrawals", admin_token).status_code == 200

    def test_customers(self, admin_token):
        assert _get("/admin/customers", admin_token).status_code == 200


# ---------------- Employee CRUD & validation ----------------
class TestEmployeeCRUD:
    created_id = None

    def test_create_bad_username_uppercase(self, admin_token):
        r = _post("/admin/employees", {"name": "X", "username": "BAD USER", "password": "abcdef",
                                        "permissions": {}}, admin_token)
        assert r.status_code == 400

    def test_create_short_password(self, admin_token):
        r = _post("/admin/employees", {"name": "X", "username": f"okname_{TS}", "password": "12",
                                        "permissions": {}}, admin_token)
        assert r.status_code == 400

    def test_create_success(self, admin_token):
        r = _post("/admin/employees", {"name": "Test Emp", "username": NEW_EMP_USERNAME, "password": NEW_EMP_PW,
                                        "mobile": "9111111111",
                                        "permissions": {"leads": "edit", "withdrawals": "view",
                                                        "clients": "view", "payments": "none",
                                                        "campaigns": "none", "reports": "none"}},
                  admin_token)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["username"] == NEW_EMP_USERNAME
        assert data["permissions"]["leads"] == "edit"
        TestEmployeeCRUD.created_id = data["id"]

    def test_create_duplicate(self, admin_token):
        r = _post("/admin/employees", {"name": "Dup", "username": NEW_EMP_USERNAME, "password": "abcdef",
                                        "permissions": {}}, admin_token)
        assert r.status_code == 400

    def test_list_includes_activity_count(self, admin_token):
        r = _get("/admin/employees", admin_token)
        assert r.status_code == 200
        items = r.json()
        found = [e for e in items if e["username"] == NEW_EMP_USERNAME]
        assert found and "activity_count" in found[0]


# ---------------- Employee login flows ----------------
class TestEmployeeLogin:
    def test_login_success(self):
        r = _post("/auth/employee/login", {"username": NEW_EMP_USERNAME, "password": NEW_EMP_PW})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["user"]["role"] == "employee"
        assert "permissions" in j["user"]

    def test_login_wrong_password_attempts_left(self):
        r = _post("/auth/employee/login", {"username": NEW_EMP_USERNAME, "password": "WRONGpw!"})
        assert r.status_code == 401
        assert "attempt" in r.text.lower()

    def test_employee_cannot_use_admin_login(self):
        r = _post("/auth/login", {"email": f"{NEW_EMP_USERNAME}@employee.radhikatraders.net",
                                   "password": NEW_EMP_PW, "portal": "admin"})
        assert r.status_code in (401, 403)

    def test_disable_then_login_forbidden(self, admin_token):
        eid = TestEmployeeCRUD.created_id
        assert eid
        r = _patch(f"/admin/employees/{eid}", {"status": "disabled"}, admin_token)
        assert r.status_code == 200
        r2 = _post("/auth/employee/login", {"username": NEW_EMP_USERNAME, "password": NEW_EMP_PW})
        assert r2.status_code == 403
        r3 = _patch(f"/admin/employees/{eid}", {"status": "active"}, admin_token)
        assert r3.status_code == 200
        r4 = _post("/auth/employee/login", {"username": NEW_EMP_USERNAME, "password": NEW_EMP_PW})
        assert r4.status_code == 200


# ---------------- RBAC using rahul.k (leads=edit, withdrawals=view, clients=view, others=none per prompt)
class TestRBAC:
    def test_leads_view(self, rahul_token):
        assert _get("/admin/leads", rahul_token).status_code == 200

    def test_withdrawals_view(self, rahul_token):
        assert _get("/admin/withdrawals", rahul_token).status_code == 200

    def test_customers_view(self, rahul_token):
        assert _get("/admin/customers", rahul_token).status_code == 200

    def test_withdrawals_patch_forbidden(self, rahul_token, admin_token):
        # find any withdrawal id
        wl = _get("/admin/withdrawals", admin_token).json()
        items = wl if isinstance(wl, list) else wl.get("items", [])
        wid = (items[0].get("id") or items[0].get("_id")) if items else "dummy_id"
        r = _patch(f"/admin/withdrawals/{wid}", {"status": "paid"}, rahul_token)
        assert r.status_code == 403

    def test_lead_fund_forbidden(self, rahul_token):
        r = _post("/admin/leads/LD-7194D3FE/fund", {"amount": 1}, rahul_token)
        assert r.status_code == 403

    def test_categories_post_forbidden(self, rahul_token):
        r = _post("/categories", {"name": "x"}, rahul_token)
        assert r.status_code == 403

    def test_broadcast_forbidden(self, rahul_token):
        r = _post("/admin/broadcast", {"message": "x"}, rahul_token)
        assert r.status_code == 403

    def test_reports_forbidden(self, rahul_token):
        r = _get("/admin/reports", rahul_token)
        assert r.status_code == 403

    def test_kyc_patch_forbidden(self, rahul_token):
        r = _patch("/admin/kyc/dummy_uid", {"status": "verified"}, rahul_token)
        assert r.status_code == 403

    def test_credit_forbidden(self, rahul_token):
        r = _post("/admin/credit", {"amount": 1, "user_id": "x"}, rahul_token)
        assert r.status_code == 403

    def test_dashboard_admin_only(self, rahul_token):
        assert _get("/admin/dashboard", rahul_token).status_code == 403

    def test_employees_admin_only(self, rahul_token):
        assert _get("/admin/employees", rahul_token).status_code == 403

    def test_activity_logs_admin_only(self, rahul_token):
        assert _get("/admin/activity-logs", rahul_token).status_code == 403

    def test_settings_admin_only(self, rahul_token):
        r = requests.put(f"{API}/admin/settings", json={}, headers={"Authorization": f"Bearer {rahul_token}"}, timeout=30)
        assert r.status_code == 403

    def test_dedicated_referrals_admin_only(self, rahul_token):
        assert _get("/admin/dedicated-referrals", rahul_token).status_code == 403

    def test_customer_forbidden_employees(self, cust_token):
        assert _get("/admin/employees", cust_token).status_code == 403

    def test_customer_forbidden_activity_logs(self, cust_token):
        assert _get("/admin/activity-logs", cust_token).status_code == 403

    def test_lead_patch_allowed(self, rahul_token, admin_token):
        leads = _get("/admin/leads", admin_token).json()
        items = leads if isinstance(leads, list) else leads.get("items", [])
        if not items:
            pytest.skip("No leads to patch")
        lid = items[0].get("id") or items[0].get("lead_id") or items[0].get("_id")
        orig = items[0].get("status", "pending")
        r = _patch(f"/admin/leads/{lid}", {"status": orig or "pending"}, rahul_token)
        # 200 either way indicates permission passed
        assert r.status_code in (200, 400), r.text


# ---------------- Employee change password + my-activity ----------------
class TestEmployeeSelfService:
    def test_change_password_wrong_current(self, rahul_token):
        r = _post("/employee/change-password", {"current_password": "WRONG", "new_password": "NewEmp@1"}, rahul_token)
        assert r.status_code == 400

    def test_change_password_success_and_reset(self, admin_token):
        r = _post("/auth/employee/login", RAHUL)
        assert r.status_code == 200
        tok = r.json()["token"]
        new_pw = "NewEmp@1"
        r2 = _post("/employee/change-password", {"current_password": RAHUL["password"], "new_password": new_pw}, tok)
        assert r2.status_code == 200
        # Login with new
        r3 = _post("/auth/employee/login", {"username": RAHUL["username"], "password": new_pw})
        assert r3.status_code == 200
        # Reset back via admin
        # find rahul id
        emps = _get("/admin/employees", admin_token).json()
        rid = next(e["id"] for e in emps if e["username"] == RAHUL["username"])
        r4 = _patch(f"/admin/employees/{rid}", {"password": RAHUL["password"]}, admin_token)
        assert r4.status_code == 200
        r5 = _post("/auth/employee/login", RAHUL)
        assert r5.status_code == 200

    def test_my_activity(self, rahul_token):
        r = _get("/employee/my-activity", rahul_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Activity logs ----------------
class TestActivityLogs:
    def test_logs_contain_actions(self, admin_token):
        r = _get("/admin/activity-logs?limit=500", admin_token)
        assert r.status_code == 200
        j = r.json()
        actions = {i["action"] for i in j["items"]}
        assert "employee_login" in actions
        assert "employee_created" in actions
        for i in j["items"][:5]:
            assert "actor_username" in i and "created_at" in i and "ip" in i

    def test_filter_by_action(self, admin_token):
        r = _get("/admin/activity-logs?action=employee_login", admin_token).json()
        for i in r["items"]:
            assert i["action"] == "employee_login"

    def test_filter_by_role_employee(self, admin_token):
        r = _get("/admin/activity-logs?role=employee", admin_token).json()
        for i in r["items"][:20]:
            assert i["actor_role"] == "employee"

    def test_filter_by_status(self, admin_token):
        r = _get("/admin/activity-logs?status=success", admin_token)
        assert r.status_code == 200

    def test_filter_by_employee_id(self, admin_token):
        emps = _get("/admin/employees", admin_token).json()
        rid = next(e["id"] for e in emps if e["username"] == RAHUL["username"])
        r = _get(f"/admin/activity-logs?employee_id={rid}", admin_token).json()
        for i in r["items"]:
            assert i["actor_id"] == rid

    def test_filter_date_range(self, admin_token):
        from datetime import date
        today = date.today().isoformat()
        r = _get(f"/admin/activity-logs?date_from={today}&date_to={today}", admin_token)
        assert r.status_code == 200

    def test_meta(self, admin_token):
        r = _get("/admin/activity-logs/meta", admin_token)
        assert r.status_code == 200
        j = r.json()
        for k in ("actions", "actors", "campaigns"):
            assert k in j

    def test_no_edit_endpoint(self, admin_token):
        r = _patch("/admin/activity-logs/anyid", {"x": 1}, admin_token)
        assert r.status_code in (404, 405)
        r2 = _delete("/admin/activity-logs/anyid", admin_token)
        assert r2.status_code in (404, 405)


# ---------------- Delete employee cleanup ----------------
class TestEmployeeDelete:
    def test_delete_and_reusable_username(self, admin_token):
        eid = TestEmployeeCRUD.created_id
        assert eid
        r = _delete(f"/admin/employees/{eid}", admin_token)
        assert r.status_code == 200
        # No longer in list
        lst = _get("/admin/employees", admin_token).json()
        assert not any(e["username"] == NEW_EMP_USERNAME for e in lst)
        # Cannot login
        r2 = _post("/auth/employee/login", {"username": NEW_EMP_USERNAME, "password": NEW_EMP_PW})
        assert r2.status_code == 401
        # Username reusable
        r3 = _post("/admin/employees", {"name": "Reuse", "username": NEW_EMP_USERNAME, "password": NEW_EMP_PW,
                                         "permissions": {}}, admin_token)
        assert r3.status_code == 200, r3.text
        new_id = r3.json()["id"]
        # cleanup
        _delete(f"/admin/employees/{new_id}", admin_token)
