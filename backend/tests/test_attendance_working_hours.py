"""Iteration 24 — Dynamic working-hours attendance + salary + auto-close + employee privacy."""
import os
import calendar
import datetime as dt
from datetime import datetime, timezone, timedelta
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

def _read_env(path, key):
    try:
        with open(path) as fh:
            for ln in fh:
                if ln.startswith(key + "="):
                    return ln.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        return None
    return None


BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _read_env("/app/frontend/.env", "REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL missing"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"
IST = timezone(timedelta(hours=5, minutes=30))

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASS = "Radhika@2023"
EMP_USER = "rahul.k"
EMP_PASS = "Emp@1234"


@pytest.fixture(scope="module")
def mongo():
    cli = MongoClient(MONGO_URL)
    db = cli[DB_NAME]
    # Make sure admin + employee aren't locked
    db.login_attempts.delete_many({})
    yield db
    cli.close()


@pytest.fixture(scope="module")
def admin_tok():
    r = requests.post(f"{BASE}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASS, "portal": "admin"},
                      headers={"Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def emp_tok():
    r = requests.post(f"{BASE}/api/auth/employee/login",
                      json={"username": EMP_USER, "password": EMP_PASS},
                      headers={"Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


def ah(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def rahul_id(admin_tok):
    r = requests.get(f"{BASE}/api/admin/attendance", headers=ah(admin_tok))
    assert r.status_code == 200, r.text
    emps = r.json()["employees"]
    for e in emps:
        if e.get("name") and "rahul" in e["name"].lower():
            return e["id"]
    # fallback via users
    for e in emps:
        return e["id"]
    pytest.skip("No employees")


@pytest.fixture(scope="module")
def month_info():
    today_ist = datetime.now(IST).date()
    y, m = today_ist.year, today_ist.month
    today_day = today_ist.day
    # If current month doesn't have 4 past days, fall back to previous month
    if today_day - 1 >= 4:
        pick_year, pick_month = y, m
        last = today_day - 1
    else:
        pick_month = m - 1 if m > 1 else 12
        pick_year = y if m > 1 else y - 1
        last = calendar.monthrange(pick_year, pick_month)[1]
    days_in_m = calendar.monthrange(pick_year, pick_month)[1]
    month = f"{pick_year:04d}-{pick_month:02d}"
    dates = [f"{month}-{d:02d}" for d in range(last - 3, last + 1)]
    # Also compute for salary of actual current month separately
    return {"month": month, "days_in_m": days_in_m, "dates": dates,
            "current_month": f"{y:04d}-{m:02d}",
            "current_days_in_m": calendar.monthrange(y, m)[1]}


@pytest.fixture(scope="module")
def created_dates(rahul_id, mongo, month_info):
    """Track which admin-created dates we need to clean up at teardown."""
    created = []
    yield created
    # Cleanup
    if created:
        mongo.attendance.delete_many({"employee_id": rahul_id, "date": {"$in": created}, "source": "admin"})
    # Also clean any stale auto-close created in tests
    mongo.attendance.delete_many({"employee_id": rahul_id, "date": {"$in": month_info["dates"]}})


# ------------- Backend tests -------------

def test_admin_put_full_day_10_20(admin_tok, rahul_id, month_info, created_dates):
    d = month_info["dates"][0]
    created_dates.append(d)
    r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{d}", headers=ah(admin_tok),
                     json={"status": "present", "check_in": "10:20", "check_out": "17:20"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "present"
    assert j["worked_minutes"] == 420
    assert j["short_minutes"] == 0
    assert j["deduction"] == 0


def test_admin_put_short_10_45(admin_tok, rahul_id, month_info, created_dates):
    d = month_info["dates"][1]
    created_dates.append(d)
    r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{d}", headers=ah(admin_tok),
                     json={"status": "present", "check_in": "10:45", "check_out": "17:30"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "short_hours"
    assert j["short_minutes"] == 15
    assert j["late_minutes"] == 45
    assert j["extra_minutes"] == 30
    assert j["adjusted_minutes"] == 30
    # salary
    s = requests.get(f"{BASE}/api/admin/salary", params={"month": month_info["month"]}, headers=ah(admin_tok)).json()
    row = next(r for r in s["rows"] if r["employee_id"] == rahul_id)
    per_day = row["per_day"]
    expected_ded = round(per_day * 15 / 420, 2)
    # j["deduction"] is per-row deduction
    assert abs(j["deduction"] - expected_ded) < 0.02


def test_admin_put_short_11_15(admin_tok, rahul_id, month_info, created_dates):
    d = month_info["dates"][2]
    created_dates.append(d)
    r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{d}", headers=ah(admin_tok),
                     json={"status": "present", "check_in": "11:15", "check_out": "18:00"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "short_hours"
    assert j["short_minutes"] == 15


def test_admin_put_full_day_11_00(admin_tok, rahul_id, month_info, created_dates):
    d = month_info["dates"][3]
    created_dates.append(d)
    r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{d}", headers=ah(admin_tok),
                     json={"status": "present", "check_in": "11:00", "check_out": "18:00"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "present"
    assert j["worked_minutes"] == 420
    assert j["short_minutes"] == 0
    assert j["deduction"] == 0


def test_admin_put_rejects_checkout_before_checkin(admin_tok, rahul_id, month_info):
    d = month_info["dates"][0]
    r = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{d}", headers=ah(admin_tok),
                     json={"status": "present", "check_in": "17:00", "check_out": "10:00"})
    assert r.status_code == 400


def test_admin_attendance_fields_and_rules(admin_tok, month_info):
    r = requests.get(f"{BASE}/api/admin/attendance",
                     params={"month": month_info["month"]}, headers=ah(admin_tok))
    assert r.status_code == 200
    j = r.json()
    assert "rules" in j and j["rules"]["required_minutes"] == 420
    assert j["rules"]["auto_close"] == "06:00 PM"
    if j["items"]:
        a = j["items"][0]
        for k in ("check_in_time", "check_out_time", "duration", "late_minutes",
                  "extra_minutes", "adjusted_minutes", "short_minutes", "status", "deduction"):
            assert k in a, f"missing {k}"


def test_salary_sheet_math(admin_tok, rahul_id, month_info):
    r = requests.get(f"{BASE}/api/admin/salary",
                     params={"month": month_info["month"]}, headers=ah(admin_tok))
    assert r.status_code == 200
    row = next(x for x in r.json()["rows"] if x["employee_id"] == rahul_id)
    assert row["monthly_salary"] > 0
    assert "short_hours" in row and "short_minutes_total" in row and "short_deduction" in row
    assert "checkout_missing" in row
    assert "paid_days" in row
    # earned = per_day * paid_days
    assert abs(row["earned"] - round(row["per_day"] * row["paid_days"], 2)) < 0.5


def test_auto_close_stale_record(admin_tok, rahul_id, mongo, month_info, created_dates):
    """Insert a stale open record and verify auto-close marks it checkout_missing."""
    # pick a NEW date (not already used)
    y, m = map(int, month_info["month"].split("-"))
    used = set(month_info["dates"])
    stale_day = None
    for d in range(1, calendar.monthrange(y, m)[1] + 1):
        s = f"{y:04d}-{m:02d}-{d:02d}"
        # must be strictly in the past (<= yesterday IST)
        if s not in used and s < datetime.now(IST).date().isoformat():
            stale_day = s
            break
    if not stale_day:
        pytest.skip("no spare day")
    created_dates.append(stale_day)
    # 10:05 IST that date -> UTC
    ci_ist = datetime.fromisoformat(stale_day).replace(hour=10, minute=5, tzinfo=IST)
    ci_utc = ci_ist.astimezone(timezone.utc).isoformat()
    mongo.attendance.delete_many({"employee_id": rahul_id, "date": stale_day})
    mongo.attendance.insert_one({
        "employee_id": rahul_id, "date": stale_day, "check_in": ci_utc, "check_out": None,
        "status": "present", "source": "self", "late": True, "late_minutes": 5,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    r = requests.get(f"{BASE}/api/admin/attendance",
                     params={"date": stale_day}, headers=ah(admin_tok))
    assert r.status_code == 200
    row = next(x for x in r.json()["items"] if x.get("employee_id") == rahul_id and x["date"] == stale_day)
    assert row["status"] == "checkout_missing"
    assert row.get("auto_closed_at")
    # deduction = per_day (approximately), fraction=0
    per_day = row["deduction"]
    assert per_day and per_day > 0

    # salary sheet shows checkout_missing >= 1
    s_before = requests.get(f"{BASE}/api/admin/salary",
                            params={"month": month_info["month"]}, headers=ah(admin_tok)).json()
    row_s = next(x for x in s_before["rows"] if x["employee_id"] == rahul_id)
    cm_before = row_s["checkout_missing"]
    assert cm_before >= 1

    # Admin fixes it
    rp = requests.put(f"{BASE}/api/admin/attendance/{rahul_id}/{stale_day}",
                      headers=ah(admin_tok),
                      json={"status": "present", "check_in": "10:05", "check_out": "17:05"})
    assert rp.status_code == 200
    jp = rp.json()
    assert jp["status"] == "present"
    assert jp["worked_minutes"] == 420
    assert jp["deduction"] == 0

    s_after = requests.get(f"{BASE}/api/admin/salary",
                           params={"month": month_info["month"]}, headers=ah(admin_tok)).json()
    row_s2 = next(x for x in s_after["rows"] if x["employee_id"] == rahul_id)
    assert row_s2["checkout_missing"] == cm_before - 1


def test_employee_api_no_salary_info(emp_tok):
    r = requests.get(f"{BASE}/api/employee/attendance", headers=ah(emp_tok))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["office"]["required_hours"] == 7
    assert j["office"]["auto_close"] == "06:00 PM"
    # No rupee amounts in items
    for a in j["items"]:
        # worked_minutes/short_minutes keys may or may not exist on legacy records,
        # but if they do they must not expose salary; critical: no rupee amounts
        for forbidden in ("monthly_salary", "per_day", "earned", "net_payable", "short_deduction"):
            assert forbidden not in a, f"employee sees {forbidden}"
        # deduction field, if present, must be None (never a rupee amount)
        assert a.get("deduction") in (None, 0, ""), f"employee sees deduction={a.get('deduction')}"


def test_export_attendance_csv_columns(admin_tok, month_info):
    r = requests.get(f"{BASE}/api/admin/attendance/export",
                     params={"month": month_info["month"], "format": "csv"},
                     headers=ah(admin_tok))
    assert r.status_code == 200
    text = r.content.decode("utf-8-sig", errors="replace")
    header = text.splitlines()[0]
    for col in ("Working Duration", "Late Min", "Extra Min", "Adjusted Min", "Short Min", "Deduction (Rs)"):
        assert col in header, f"missing col {col} in {header}"


def test_salary_slip_pdf(admin_tok, rahul_id, month_info):
    r = requests.get(f"{BASE}/api/admin/salary/slip/{rahul_id}",
                     params={"month": month_info["month"], "format": "pdf"},
                     headers=ah(admin_tok))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"


def test_admin_dashboard_has_pending_review(admin_tok):
    r = requests.get(f"{BASE}/api/admin/attendance/dashboard", headers=ah(admin_tok))
    assert r.status_code == 200
    j = r.json()
    assert "pending_review" in j
