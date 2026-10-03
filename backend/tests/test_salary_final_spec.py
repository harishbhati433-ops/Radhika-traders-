"""Salary FINAL spec tests — daily rate = monthly/30, Sunday extra, date deductions, publish, audit."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"
EMP_USER = "rahul.k"
EMP_PASS = "Emp@1234"
EMP_ID = "6aa4f62060cf8b2d2a38c56b"
MONTH = "2026-08"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{BASE}/api/auth/employee/login", json={"username": EMP_USER, "password": EMP_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def admin_h(t):
    return {"Authorization": f"Bearer {t}"}


def get_row(t, month=MONTH):
    r = requests.get(f"{BASE}/api/admin/salary?month={month}", headers=admin_h(t))
    assert r.status_code == 200, r.text
    rows = r.json()["rows"]
    row = next((x for x in rows if x["employee_id"] == EMP_ID), None)
    assert row, f"rahul not in salary rows: {[x['employee_id'] for x in rows]}"
    return row


# ---------- 1. Salary rate basis = monthly / 30 ----------
class TestSalaryBasis:
    def test_set_12000_per_day_400(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/salary/{EMP_ID}", json={"monthly_salary": 12000}, headers=admin_h(admin_token))
        assert r.status_code == 200
        row = get_row(admin_token)
        assert row["monthly_salary"] == 12000
        assert row["per_day"] == 400.0, f"per_day={row['per_day']}"

    def test_set_6000_per_day_200(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/salary/{EMP_ID}", json={"monthly_salary": 6000}, headers=admin_h(admin_token))
        assert r.status_code == 200
        row = get_row(admin_token)
        assert row["per_day"] == 200.0


# ---------- 2. Sunday extra calculation (Aug 2026) ----------
class TestAugustSalary:
    def test_setup_12000(self, admin_token):
        requests.put(f"{BASE}/api/admin/salary/{EMP_ID}", json={"monthly_salary": 12000}, headers=admin_h(admin_token)).raise_for_status()

    def test_mark_sunday_worked_02(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/attendance/{EMP_ID}/2026-08-02",
                         json={"status": "sunday_worked", "check_in": "10:00", "check_out": "17:00"},
                         headers=admin_h(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "sunday_worked"

    def test_mark_half_sunday_09(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/attendance/{EMP_ID}/2026-08-09",
                         json={"status": "half_day", "check_in": "10:00", "check_out": "13:30"},
                         headers=admin_h(admin_token))
        assert r.status_code == 200, r.text

    def test_salary_row_breakdown(self, admin_token):
        row = get_row(admin_token)
        assert row["sunday_worked"] == 1, row
        assert row["half_day"] == 1, row
        # Sunday extra = 400 (full) + 200 (half) = 600
        assert row["sunday_extra"] == 600.0, f"sunday_extra={row['sunday_extra']}"
        # 3 remaining Sundays as weekly_off (16,23,30)
        assert row["weekly_off"] == 3, f"weekly_off={row['weekly_off']}"
        # absent working days = 26
        assert row["absent"] == 26, f"absent={row['absent']}"
        assert row["attendance_deduction"] == 10400.0, row["attendance_deduction"]
        assert row["net_payable"] == 2200.0, f"net={row['net_payable']}"


# ---------- 3. Date-specific deductions, publish, employee view, audit ----------
class TestDateDeductionAndPublish:
    ded_id = None

    def test_add_date_deduction(self, admin_token):
        r = requests.post(f"{BASE}/api/admin/salary/{EMP_ID}/{MONTH}/date-deduction",
                          json={"date": "2026-08-05", "amount": 500, "reason": "test"},
                          headers=admin_h(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["manual_adjustment"] == 500.0, data["manual_adjustment"]
        assert data["net_payable"] == 1700.0, data["net_payable"]
        assert len(data["date_deductions"]) >= 1
        TestDateDeductionAndPublish.ded_id = data["date_deductions"][-1]["id"]

    def test_date_outside_month_rejected(self, admin_token):
        r = requests.post(f"{BASE}/api/admin/salary/{EMP_ID}/{MONTH}/date-deduction",
                          json={"date": "2026-07-15", "amount": 100, "reason": "x"},
                          headers=admin_h(admin_token))
        assert r.status_code == 400, r.text

    def test_publish(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/salary/{EMP_ID}/{MONTH}/publish",
                         json={"published": True}, headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.json()["published"] is True

    def test_employee_sees_published(self, emp_token):
        r = requests.get(f"{BASE}/api/employee/salary", headers=admin_h(emp_token))
        assert r.status_code == 200
        items = r.json()["items"]
        aug = next((x for x in items if x["month"] == MONTH), None)
        assert aug, f"items={items}"
        assert aug["net_payable"] == 1700.0, aug
        # must NOT leak admin keys
        for banned in ("note", "date_deductions", "reason"):
            assert banned not in aug, f"leaked {banned}"

    def test_delete_date_deduction_restores(self, admin_token):
        assert TestDateDeductionAndPublish.ded_id
        r = requests.delete(f"{BASE}/api/admin/salary/{EMP_ID}/{MONTH}/date-deduction/{TestDateDeductionAndPublish.ded_id}",
                            headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.json()["net_payable"] == 2200.0

    def test_unpublish(self, admin_token):
        r = requests.put(f"{BASE}/api/admin/salary/{EMP_ID}/{MONTH}/publish",
                         json={"published": False}, headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.json()["published"] is False

    def test_employee_list_empty_after_unpublish(self, emp_token):
        r = requests.get(f"{BASE}/api/employee/salary", headers=admin_h(emp_token))
        items = r.json()["items"]
        assert not any(x["month"] == MONTH for x in items)

    def test_audit_has_entries(self, admin_token):
        r = requests.get(f"{BASE}/api/admin/salary/audit?month={MONTH}", headers=admin_h(admin_token))
        assert r.status_code == 200
        items = r.json()["items"]
        types = {x["type"] for x in items}
        for t in ("date_deduction", "date_deduction_removed", "published", "unpublished"):
            assert t in types, f"missing type {t}, got {types}"
        sample = items[0]
        for k in ("previous_final", "new_final", "admin_name"):
            assert k in sample


# ---------- 4. Recalculate + Sunday auto-status ----------
class TestRecalculate:
    def test_recalculate_endpoint(self, admin_token):
        r = requests.post(f"{BASE}/api/admin/salary/recalculate?month={MONTH}", headers=admin_h(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "30" in data["basis"]

    def test_sunday_auto_promoted_to_sunday_worked(self, admin_token):
        # 2026-08-16 is a Sunday; even posting short_hours should auto-derive sunday_worked
        r = requests.put(f"{BASE}/api/admin/attendance/{EMP_ID}/2026-08-16",
                         json={"status": "short_hours", "check_in": "10:00", "check_out": "17:00"},
                         headers=admin_h(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "sunday_worked"


# ---------- 5. Salary slip PDF ----------
class TestSalarySlip:
    def test_slip_pdf(self, admin_token):
        r = requests.get(f"{BASE}/api/admin/salary/slip/{EMP_ID}?month={MONTH}", headers=admin_h(admin_token))
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        # Extract text from PDF
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader
        import io as _io
        text = "\n".join((p.extract_text() or "") for p in PdfReader(_io.BytesIO(r.content)).pages)
        for needle in ("Daily Salary Rate", "Sunday Extra", "Final Payable Salary"):
            assert needle in text, f"missing {needle!r} in slip text"


# ---------- 6. Cleanup ----------
class TestCleanup:
    def test_cleanup(self, admin_token):
        from pymongo import MongoClient
        mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = mc[os.environ.get("DB_NAME", "test_database")]
        db.attendance.delete_many({"employee_id": EMP_ID, "date": {"$in": ["2026-08-02", "2026-08-09", "2026-08-16"]}})
        db.salary_adjustments.delete_many({"employee_id": EMP_ID, "month": MONTH})
        db.salary_audit.delete_many({"employee_id": EMP_ID, "month": MONTH})
        # restore salary to 15000
        requests.put(f"{BASE}/api/admin/salary/{EMP_ID}", json={"monthly_salary": 15000}, headers=admin_h(admin_token)).raise_for_status()
        row = get_row(admin_token)
        assert row["monthly_salary"] == 15000
