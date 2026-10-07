"""Backend tests for Employee Leave Requests feature (Jan 2026)."""
import os
import pytest
import requests
from datetime import date

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL missing")


BASE = _load_url()
API = f"{BASE}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PWD = "Radhika@2023"
EMP_USER = "rahul.k"
EMP_PWD = "Emp@1234"
EMP_ID = "6aa4f62060cf8b2d2a38c56b"
PER_DAY = 500  # 15000/30


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD, "portal": "admin"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{API}/auth/employee/login", json={"username": EMP_USER, "password": EMP_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


class TestEmployeeLeaveApply:
    def test_sunday_only_range_rejected(self, emp_token):
        # 2026-11-01 is Sunday
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-01", "to_date": "2026-11-01", "reason": "sick day", "leave_type": "sick"})
        assert r.status_code == 400
        assert "sunday" in r.text.lower()

    def test_to_before_from(self, emp_token):
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-05", "to_date": "2026-11-03", "reason": "travel"})
        assert r.status_code == 400

    def test_short_reason(self, emp_token):
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-20", "to_date": "2026-11-20", "reason": "x"})
        assert r.status_code in (400, 422)

    def test_create_and_days_count(self, emp_token):
        # 2026-11-03 (Tue) → 2026-11-05 (Thu) = 3 working days, no Sundays
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-03", "to_date": "2026-11-05", "reason": "family function", "leave_type": "casual"})
        assert r.status_code == 201, r.text
        data = r.json()
        assert data["days"] == 3
        assert data["status"] == "pending"
        pytest.leave_id = data["id"]

    def test_overlap_rejected(self, emp_token):
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-04", "to_date": "2026-11-06", "reason": "overlap test"})
        assert r.status_code == 400
        assert "overlap" in r.text.lower() or "already" in r.text.lower()

    def test_list_and_summary(self, emp_token):
        r = requests.get(f"{API}/employee/leaves", headers=hdr(emp_token))
        assert r.status_code == 200
        js = r.json()
        assert "items" in js and "summary" in js
        s = js["summary"]
        assert set(s.keys()) >= {"pending", "paid_days", "unpaid_days", "year"}
        assert s["pending"] >= 1


class TestAdminDecision:
    def test_unauth_admin_route(self, emp_token):
        r = requests.get(f"{API}/admin/leaves", headers=hdr(emp_token))
        assert r.status_code == 403

    def test_no_token_401(self):
        r = requests.get(f"{API}/admin/leaves")
        assert r.status_code == 401

    def test_list_pending(self, admin_token):
        r = requests.get(f"{API}/admin/leaves?status=pending", headers=hdr(admin_token))
        assert r.status_code == 200
        js = r.json()
        assert "pending" in js and js["pending"] >= 1
        assert any(it["id"] == pytest.leave_id for it in js["items"])

    def test_approve_needs_paid(self, admin_token):
        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "approve"})
        assert r.status_code == 400

    def test_invalid_action(self, admin_token):
        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "foo"})
        assert r.status_code == 400

    def test_set_paid_on_pending(self, admin_token):
        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "set_paid"})
        assert r.status_code == 400

    def test_approve_unpaid_and_salary_deducted(self, admin_token):
        # Capture baseline salary
        r0 = requests.get(f"{API}/admin/salary?month=2026-11", headers=hdr(admin_token))
        assert r0.status_code == 200
        base = next((row for row in r0.json().get("items", r0.json().get("rows", [])) if row.get("employee_id") == EMP_ID), None)
        base_net = base.get("net_payable") if base else None
        base_unpaid = (base or {}).get("unpaid_leave", 0)

        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "approve", "paid": False})
        assert r.status_code == 200, r.text
        js = r.json()
        assert js["status"] == "approved" and js["paid"] is False

        # Attendance should have 3 'leave' rows source=leave_request
        r2 = requests.get(f"{API}/admin/attendance?month=2026-11&employee_id={EMP_ID}", headers=hdr(admin_token))
        assert r2.status_code == 200
        items = r2.json().get("items", r2.json().get("rows", []))
        leave_rows = [a for a in items if a.get("status") == "leave" and a.get("source") == "leave_request" and a["date"] in ("2026-11-03", "2026-11-04", "2026-11-05")]
        assert len(leave_rows) == 3
        assert all(a.get("leave_paid") is False for a in leave_rows)

        # Salary unpaid_leave should include these 3 days
        r3 = requests.get(f"{API}/admin/salary?month=2026-11", headers=hdr(admin_token))
        row = next((x for x in r3.json().get("items", r3.json().get("rows", [])) if x.get("employee_id") == EMP_ID), None)
        assert row is not None
        assert row.get("unpaid_leave", 0) >= base_unpaid + 3
        if base_net is not None:
            assert row["net_payable"] <= base_net - 3 * PER_DAY + 1

    def test_set_paid_flip(self, admin_token):
        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "set_paid"})
        assert r.status_code == 200
        assert r.json()["paid"] is True

        r3 = requests.get(f"{API}/admin/salary?month=2026-11", headers=hdr(admin_token))
        row = next((x for x in r3.json().get("items", r3.json().get("rows", [])) if x.get("employee_id") == EMP_ID), None)
        assert row["paid_leave"] >= 3

    def test_reject_removes_attendance(self, admin_token):
        r = requests.patch(f"{API}/admin/leaves/{pytest.leave_id}", headers=hdr(admin_token),
                           json={"action": "reject"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"
        r2 = requests.get(f"{API}/admin/attendance?month=2026-11&employee_id={EMP_ID}", headers=hdr(admin_token))
        items = r2.json().get("items", r2.json().get("rows", []))
        remaining = [a for a in items if a.get("leave_request_id") == pytest.leave_id and a.get("status") == "leave"]
        assert len(remaining) == 0


class TestWithdraw:
    def test_create_and_withdraw(self, emp_token):
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-10", "to_date": "2026-11-10", "reason": "personal work"})
        assert r.status_code == 201
        lid = r.json()["id"]
        # Withdraw
        r2 = requests.delete(f"{API}/employee/leaves/{lid}", headers=hdr(emp_token))
        assert r2.status_code == 200
        # Withdraw again → 404 or 400
        r3 = requests.delete(f"{API}/employee/leaves/{lid}", headers=hdr(emp_token))
        assert r3.status_code in (400, 404)

    def test_withdraw_nonpending(self, emp_token, admin_token):
        r = requests.post(f"{API}/employee/leaves", headers=hdr(emp_token),
                          json={"from_date": "2026-11-12", "to_date": "2026-11-12", "reason": "doctor visit"})
        lid = r.json()["id"]
        requests.patch(f"{API}/admin/leaves/{lid}", headers=hdr(admin_token), json={"action": "reject"})
        r2 = requests.delete(f"{API}/employee/leaves/{lid}", headers=hdr(emp_token))
        assert r2.status_code == 400


def test_cleanup(admin_token):
    """Reject every test leave created in Nov 2026 so salary sheet is clean."""
    r = requests.get(f"{API}/admin/leaves?month=2026-11", headers=hdr(admin_token))
    for it in r.json().get("items", []):
        if it["employee_id"] == EMP_ID and it["status"] not in ("rejected", "cancelled"):
            requests.patch(f"{API}/admin/leaves/{it['id']}", headers=hdr(admin_token), json={"action": "reject"})
