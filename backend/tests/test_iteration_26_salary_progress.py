"""Iteration 26: Verify salary_row returns payable_now/in_progress/as_of for current month,
and in_progress=false with payable_now==net_payable for past months."""
import os, requests, pytest
from pathlib import Path

def _load_env():
    envp = Path("/app/frontend/.env")
    for line in envp.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_env()).rstrip("/")

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_admin_salary_current_month_in_progress(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/salary", params={"month": "2026-10"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    rows = r.json()["rows"]
    assert rows, "expected rows for 2026-10"
    for row in rows:
        if row.get("not_joined"):
            continue
        assert "payable_now" in row, row
        assert row.get("in_progress") is True, row
        assert row.get("as_of") == "2026-10-03", row.get("as_of")


def test_admin_salary_past_month_not_in_progress(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/salary", params={"month": "2026-09"}, headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()["rows"]
    assert rows
    for row in rows:
        if row.get("not_joined"):
            continue
        assert row.get("in_progress") is False, row
        assert row["payable_now"] == row["net_payable"], (row["payable_now"], row["net_payable"])


def test_rahul_october_math(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/salary", params={"month": "2026-10"}, headers=admin_headers)
    rows = r.json()["rows"]
    rahul = next((x for x in rows if x.get("username") == "rahul.k" or x.get("name", "").lower().startswith("rahul")), None)
    assert rahul, "Rahul not found in Oct rows"
    print("Rahul Oct row:", {k: rahul.get(k) for k in ("monthly_salary", "per_day", "paid_days", "earned_to_date", "payable_now", "net_payable", "in_progress", "as_of", "bonus", "incentive")})
    assert rahul["in_progress"] is True
    assert rahul["as_of"] == "2026-10-03"


def test_employee_my_salary_fields():
    # login as employee
    r = requests.post(f"{BASE_URL}/api/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    r2 = requests.get(f"{BASE_URL}/api/employee/salary", headers={"Authorization": f"Bearer {tok}"})
    assert r2.status_code == 200
    items = r2.json()["items"]
    # Only shows published months; may be empty if nothing published
    print("Published items for rahul:", [(i["month"], i.get("in_progress"), i.get("as_of"), i.get("paid_days")) for i in items])
