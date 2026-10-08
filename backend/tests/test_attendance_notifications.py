"""
Attendance notification reliability test (iteration_39).
Covers:
 - Employee check-in / check-out create exactly one attendance_events doc + two push_log rows (admin+employee audiences).
 - Idempotency on second check-out (400) and no new push_log rows.
 - push_service.send_push idempotency via event_key.
 - Nudge cron runs at least once + no duplicate (attendance_reminders / nudge push_log).
 - Admin endpoints /api/admin/push-log and /api/admin/attendance-events return 200 with required fields.
 - Email outbox has no 'bulk' rows after campaign status toggle.
Cleans up all test rows at the end.
"""
import os
import re
import sys
import time
import asyncio
import datetime as dt
import requests
import pytest
from pathlib import Path

sys.path.insert(0, "/app/backend")
# Load env BEFORE importing push_service
from dotenv import load_dotenv  # noqa: E402
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

from pymongo import MongoClient  # noqa: E402

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CRON_SECRET = os.environ["WEBHOOK_CRON_SECRET"]
EMP_ID = "6aa4f62060cf8b2d2a38c56b"
CAMPAIGN_ID = "6a9d87a93ee34323c98dfdc1"

db = MongoClient(MONGO_URL)[DB_NAME]


def _run(coro):
    """Run async coroutine in a fresh event loop (used only for push_service calls)."""
    return asyncio.new_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{BASE_URL}/api/auth/employee/login",
                      json={"username": "rahul.k", "password": "Emp@1234"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def ist_date(emp_token):
    """Get IST today via check-in response (also performs the check-in used by downstream tests)."""
    # Ensure clean today
    _cleanup_today()
    r = requests.post(f"{BASE_URL}/api/employee/attendance/check-in",
                      headers={"Authorization": f"Bearer {emp_token}"}, json={}, timeout=15)
    assert r.status_code == 200, r.text
    date = r.json()["date"]
    # wait for background notify
    time.sleep(14)
    return date


def _cleanup_today():
    rx = re.compile(f"^(punch|nudge):{EMP_ID}:")
    db.attendance.delete_many({"employee_id": EMP_ID})
    db.attendance_events.delete_many({"_id": rx})
    db.attendance_reminders.delete_many({"employee_id": EMP_ID})
    db.attendance_push_log.delete_many({"employee_id": EMP_ID})
    db.push_events.delete_many({"_id": rx})
    db.push_log.delete_many({"event_key": rx})
    # emails: delete attendance mail outbox entries for test window
    db.email_outbox.delete_many({"to": {"$in": ["rahul.k@example.com", "rahul.k@radhikatraders.com"]}})


# ---------- 1. check-in creates event + 2 push_log rows ----------
class TestCheckIn:
    def test_attendance_event_doc(self, ist_date):
        key = f"punch:{EMP_ID}:{ist_date}:in"
        doc = db.attendance_events.find_one({"_id": key})
        assert doc is not None, f"missing event {key}"
        assert "push" in doc and "admin" in doc["push"] and "employee" in doc["push"]
        assert isinstance(doc.get("emails"), dict) and len(doc["emails"]) >= 1
        # Each email entry must have a status field with expected values
        for addr, info in doc["emails"].items():
            assert info["status"] in ("sent", "queued/failed — see Email Log"), info

    def test_push_log_rows_in(self, ist_date):
        key = f"punch:{EMP_ID}:{ist_date}:in"
        admin_row = db.push_log.find_one({"event_key": f"{key}:admin"})
        emp_row = db.push_log.find_one({"event_key": f"{key}:employee"})
        assert admin_row is not None, "no admin push_log row"
        assert emp_row is not None, "no employee push_log row"
        # devices expected 0 in this env
        for row in (admin_row, emp_row):
            assert "devices" in row and "sent" in row and "failed" in row and "gone" in row
            if row["devices"] == 0:
                assert "no subscribed device" in (row.get("reason") or "")


# ---------- 2. check-out + idempotency ----------
class TestCheckOut:
    def test_check_out_success(self, emp_token, ist_date):
        r = requests.post(f"{BASE_URL}/api/employee/attendance/check-out",
                          headers={"Authorization": f"Bearer {emp_token}"}, json={}, timeout=15)
        assert r.status_code == 200, r.text
        time.sleep(14)
        key = f"punch:{EMP_ID}:{ist_date}:out"
        doc = db.attendance_events.find_one({"_id": key})
        assert doc is not None, f"missing event {key}"
        assert db.push_log.find_one({"event_key": f"{key}:admin"}) is not None
        assert db.push_log.find_one({"event_key": f"{key}:employee"}) is not None

    def test_second_check_out_rejected_and_idempotent(self, emp_token, ist_date):
        key = f"punch:{EMP_ID}:{ist_date}:out"
        count_before = db.push_log.count_documents({"event_key": {"$regex": f"^{re.escape(key)}:"}})
        r = requests.post(f"{BASE_URL}/api/employee/attendance/check-out",
                          headers={"Authorization": f"Bearer {emp_token}"}, json={}, timeout=15)
        assert r.status_code == 400
        assert "Already checked out" in r.text
        time.sleep(2)
        count_after = db.push_log.count_documents({"event_key": {"$regex": f"^{re.escape(key)}:"}})
        assert count_after == count_before, f"push_log rows duplicated: {count_before}->{count_after}"


# ---------- 3. push_service idempotency ----------
class TestPushIdempotency:
    def test_send_push_dedup(self):
        from motor.motor_asyncio import AsyncIOMotorClient
        import push_service

        ekey = f"TEST_pytest_dedup_{int(time.time())}"

        async def _go():
            adb = AsyncIOMotorClient(MONGO_URL)[DB_NAME]
            push_service.init(adb)
            r1 = await push_service.send_push([EMP_ID], "T", "B", event_key=ekey)
            r2 = await push_service.send_push([EMP_ID], "T", "B", event_key=ekey)
            return r1, r2

        try:
            r1, r2 = asyncio.run(_go())
            assert r2.get("skipped") == "duplicate", r2
            assert r1.get("skipped") != "duplicate", r1
        finally:
            db.push_events.delete_one({"_id": ekey})
            db.push_log.delete_many({"event_key": ekey})


# ---------- 4. nudge cron ----------
class TestNudgeCron:
    def test_run_twice_no_duplicates(self, ist_date):
        headers = {"Authorization": f"Bearer {CRON_SECRET}", "Content-Type": "application/json"}
        r1 = requests.post(f"{BASE_URL}/api/cron/attendance-nudges", headers=headers, json={}, timeout=15)
        assert r1.status_code == 202, r1.text
        rid1 = r1.json()["run_id"]
        time.sleep(10)
        r2 = requests.post(f"{BASE_URL}/api/cron/attendance-nudges", headers=headers, json={}, timeout=15)
        assert r2.status_code == 202, r2.text
        rid2 = r2.json()["run_id"]
        assert rid1 != rid2
        time.sleep(12)
        # Confirm cron_runs rows finished
        cr1 = db.cron_runs.find_one({"run_id": rid1})
        cr2 = db.cron_runs.find_one({"run_id": rid2})
        assert cr1 and cr1.get("finished_at")
        assert cr2 and cr2.get("finished_at")
        # at most one reminders row + one push_log nudge row per (employee, kind) for today
        for kind in ("checkin", "checkout"):
            c_rem = db.attendance_reminders.count_documents({"employee_id": EMP_ID, "date": ist_date, "kind": kind})
            assert c_rem <= 1, f"duplicate reminder for {kind}"
            key = f"nudge:{EMP_ID}:{ist_date}:{kind}"
            c_push = db.push_log.count_documents({"event_key": key})
            assert c_push <= 1, f"duplicate nudge push_log for {kind}"


# ---------- 5. admin endpoints ----------
class TestAdminEndpoints:
    def test_push_log_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/push-log", timeout=15)
        assert r.status_code == 401

    def test_attendance_events_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-events", timeout=15)
        assert r.status_code == 401

    def test_push_log_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/push-log",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert len(data["items"]) >= 2
        row = data["items"][0]
        for f in ("devices", "sent", "failed", "gone"):
            assert f in row, f"missing field {f} in push-log item"

    def test_attendance_events_ok(self, admin_token, ist_date):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-events",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        # find today's rahul event
        hit = [i for i in items if i.get("id", "").startswith(f"punch:{EMP_ID}:{ist_date}:")]
        assert hit, "today's event missing"
        row = hit[0]
        assert "employee_name" in row and "push" in row and "emails" in row


# ---------- 6. campaign toggle must not create bulk emails ----------
class TestNoBulkEmails:
    def test_campaign_status_toggle_no_bulk(self, admin_token):
        # count before
        before = db.email_outbox.count_documents({"priority": "bulk"})
        h = {"Authorization": f"Bearer {admin_token}"}
        r1 = requests.patch(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/status?status=paused",
                            headers=h, timeout=15)
        assert r1.status_code in (200, 204), r1.text
        r2 = requests.patch(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/status?status=live",
                            headers=h, timeout=15)
        assert r2.status_code in (200, 204), r2.text
        time.sleep(3)
        after = db.email_outbox.count_documents({"priority": "bulk"})
        assert after == before, f"bulk emails created: {before}->{after}"


# ---------- cleanup ----------
def teardown_module(module):
    rx = re.compile(f"^(punch|nudge):{EMP_ID}:")
    db.attendance.delete_many({"employee_id": EMP_ID})
    db.attendance_events.delete_many({"_id": rx})
    db.attendance_reminders.delete_many({"employee_id": EMP_ID})
    db.attendance_push_log.delete_many({"employee_id": EMP_ID})
    db.push_events.delete_many({"_id": rx})
    db.push_log.delete_many({"event_key": rx})
    db.email_outbox.delete_many({
        "subject": {"$regex": "Check-?In|Check-?Out|checked in|checked out", "$options": "i"},
        "created_at": {"$gte": (dt.datetime.utcnow() - dt.timedelta(hours=2)).isoformat()},
    })
