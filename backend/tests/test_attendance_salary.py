"""Backend sanity checks for Attendance & Salary feature (iteration 21).

Scope: auth gates, dashboard KPIs, admin attendance edit (status derivation + activity log),
salary adjust math, exports (xlsx/csv/pdf content-type), slip, security 403s.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

def _get_base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # read from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE = _get_base()
IST = timezone(timedelta(hours=5, minutes=30))


def ist_today():
    return datetime.now(IST).strftime("%Y-%m-%d")


def ist_month():
    return datetime.now(IST).strftime("%Y-%m")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{BASE}/api/auth/employee/login",
                      json={"username": "rahul.k", "password": "Emp@1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def rahul_id(admin_token):
    r = requests.get(f"{BASE}/api/admin/attendance",
                     params={"month": ist_month()},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    emps = r.json()["employees"]
    for e in emps:
        if "rahul" in (e.get("name") or "").lower() or e.get("employee_code"):
            # pick rahul specifically
            pass
    # Look for Rahul in all employees
    r2 = requests.get(f"{BASE}/api/admin/attendance",
                      params={"date": ist_today()},
                      headers={"Authorization": f"Bearer {admin_token}"})
    for e in r2.json()["employees"]:
        if "rahul" in (e.get("name") or "").lower():
            return e["id"]
    pytest.skip("Rahul employee not found")


# ---------- SECURITY ----------
class TestSecurity:
    def test_employee_cannot_hit_admin_salary(self, emp_token):
        r = requests.get(f"{BASE}/api/admin/salary",
                         headers={"Authorization": f"Bearer {emp_token}"})
        assert r.status_code == 403

    def test_employee_cannot_hit_admin_attendance(self, emp_token):
        r = requests.get(f"{BASE}/api/admin/attendance",
                         headers={"Authorization": f"Bearer {emp_token}"})
        assert r.status_code == 403

    def test_admin_cannot_check_in(self, admin_token):
        r = requests.post(f"{BASE}/api/employee/attendance/check-in",
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 403


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_attendance_dashboard_kpis(self, admin_token):
        r = requests.get(f"{BASE}/api/admin/attendance/dashboard",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        d = r.json()
        for k in ("total_employees", "present_today", "absent_today", "late_today",
                  "on_leave_today", "total_monthly_salary", "salary_paid", "salary_pending"):
            assert k in d, f"missing {k}"
        assert isinstance(d["total_employees"], int)
        assert d["total_employees"] >= 1


# ---------- EMPLOYEE ATTENDANCE ----------
class TestEmployeeAttendance:
    def test_my_attendance(self, emp_token):
        r = requests.get(f"{BASE}/api/employee/attendance",
                         headers={"Authorization": f"Bearer {emp_token}"})
        assert r.status_code == 200
        d = r.json()
        assert "summary" in d and "items" in d and "date" in d
        s = d["summary"]
        for k in ("present", "late", "half_day", "absent", "paid_leave", "unpaid_leave", "paid_days", "days_in_month"):
            assert k in s


# ---------- ADMIN EDIT + ACTIVITY LOG ----------
class TestAdminEdit:
    def test_edit_leave_paid_and_present_late(self, admin_token, rahul_id):
        # Use a past date so edits don't collide with today's self-check-in record
        test_date = f"{ist_month()}-05"
        # Set as paid leave
        r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{test_date}",
                         json={"status": "leave", "leave_paid": True, "note": "TEST_leave"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "leave" and d["leave_paid"] is True

        # Edit to present 10:30-17:00 => should become 'late' and ~6.5h
        r2 = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{test_date}",
                          json={"status": "present", "check_in": "10:30", "check_out": "17:00", "note": "TEST_late"},
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["status"] == "late", f"expected late got {d2['status']}"
        assert abs(d2["hours"] - 6.5) < 0.01

        # Edit to 10:00-13:00 => half_day, 3h
        r3 = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{test_date}",
                          json={"status": "present", "check_in": "10:00", "check_out": "13:00", "note": "TEST_half"},
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["status"] == "half_day"
        assert abs(d3["hours"] - 3.0) < 0.01

    def test_activity_log_has_attendance_edits(self, admin_token):
        r = requests.get(f"{BASE}/api/admin/activity-logs",
                         params={"action": "attendance_edited"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        logs = r.json().get("items", r.json() if isinstance(r.json(), list) else [])
        assert len(logs) > 0, "No attendance_edited activity logs found"
        # Check at least one has a '→' in detail (old → new)
        details = " ".join(str(l.get("detail", "")) for l in logs[:20])
        assert "→" in details


# ---------- SALARY ----------
class TestSalary:
    def test_salary_sheet_and_math(self, admin_token, rahul_id):
        month = ist_month()
        # Set monthly salary 15000, bonus 500, advance 1000
        r = requests.put(f"{BASE}/api/admin/salary/{rahul_id}",
                         json={"monthly_salary": 15000},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        r2 = requests.put(f"{BASE}/api/admin/salary/{rahul_id}/{month}",
                          json={"bonus": 500, "incentive": 0, "advance": 1000, "deduction": 0, "note": "TEST"},
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        row = r2.json()
        # Verify maths
        expected_per_day = round(15000 / row["days_in_month"], 2)
        assert abs(row["per_day"] - expected_per_day) < 0.5
        expected_earned = round(expected_per_day * row["paid_days"], 2)
        assert abs(row["earned"] - expected_earned) < 1
        expected_net = round(expected_earned + 500 - 1000, 2)
        assert abs(row["net_payable"] - expected_net) < 1

    def test_mark_paid_toggle(self, admin_token, rahul_id):
        month = ist_month()
        # Get current state
        r = requests.get(f"{BASE}/api/admin/salary", params={"month": month},
                         headers={"Authorization": f"Bearer {admin_token}"})
        row = next(x for x in r.json()["rows"] if x["employee_id"] == rahul_id)
        # Mark paid
        r1 = requests.put(f"{BASE}/api/admin/salary/{rahul_id}/{month}",
                          json={"bonus": row["bonus"], "incentive": row["incentive"],
                                "advance": row["advance"], "deduction": row["deduction"],
                                "note": row["note"], "payment_status": "paid"},
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r1.status_code == 200
        assert r1.json()["payment_status"] == "paid"
        # Toggle back to pending
        r2 = requests.put(f"{BASE}/api/admin/salary/{rahul_id}/{month}",
                          json={"bonus": row["bonus"], "incentive": row["incentive"],
                                "advance": row["advance"], "deduction": row["deduction"],
                                "note": row["note"], "payment_status": "pending"},
                          headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        assert r2.json()["payment_status"] == "pending"


# ---------- EXPORTS ----------
class TestExports:
    def test_attendance_exports(self, admin_token):
        month = ist_month()
        for fmt, ct_prefix in [("xlsx", "application/vnd.openxmlformats"),
                               ("csv", "text/csv"),
                               ("pdf", "application/pdf")]:
            r = requests.get(f"{BASE}/api/admin/attendance/export",
                             params={"month": month, "format": fmt},
                             headers={"Authorization": f"Bearer {admin_token}"})
            assert r.status_code == 200, f"{fmt}: {r.text[:200]}"
            assert r.headers.get("content-type", "").startswith(ct_prefix), f"{fmt} ct={r.headers.get('content-type')}"
            assert len(r.content) > 100

    def test_salary_exports(self, admin_token):
        month = ist_month()
        for fmt, ct_prefix in [("xlsx", "application/vnd.openxmlformats"),
                               ("csv", "text/csv"),
                               ("pdf", "application/pdf")]:
            r = requests.get(f"{BASE}/api/admin/salary/export",
                             params={"month": month, "format": fmt},
                             headers={"Authorization": f"Bearer {admin_token}"})
            assert r.status_code == 200, f"{fmt}: {r.text[:200]}"
            assert r.headers.get("content-type", "").startswith(ct_prefix)
            assert len(r.content) > 100

    def test_salary_slip(self, admin_token, rahul_id):
        month = ist_month()
        r = requests.get(f"{BASE}/api/admin/salary/slip/{rahul_id}",
                         params={"month": month, "format": "pdf"},
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.headers.get("content-type") == "application/pdf"
        assert r.content[:4] == b"%PDF"
