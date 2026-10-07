"""Backend tests for reliability batch: email queue/log, campaign status cycle, admin email-log, attendance regression."""
import os
import time
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{BASE_URL}/api/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def emp_h(emp_token):
    return {"Authorization": f"Bearer {emp_token}"}


@pytest.fixture(scope="module")
def target_campaign(admin_h):
    r = requests.get(f"{BASE_URL}/api/campaigns?admin_view=true", headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    items = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert items, "no campaigns found"
    # Prefer a non-deleted one
    cand = next((c for c in items if not c.get("is_deleted")), items[0])
    return cand


# ================= CAMPAIGN STATUS LIFECYCLE =================

def _patch_status(admin_h, cid, status):
    return requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status?status={status}", headers=admin_h, timeout=30)


def test_campaign_status_auth(target_campaign):
    cid = target_campaign["id"]
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status?status=live", timeout=30)
    assert r.status_code == 401


def test_campaign_status_employee_forbidden(emp_h, target_campaign):
    cid = target_campaign["id"]
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status?status=live", headers=emp_h, timeout=30)
    assert r.status_code == 403, r.text


def test_campaign_status_invalid(admin_h, target_campaign):
    cid = target_campaign["id"]
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status?status=bogus", headers=admin_h, timeout=30)
    assert r.status_code == 400, r.text


def test_campaign_status_lifecycle(admin_h, db, target_campaign):
    """Live→Pause→Live→Close→Live. Verify notifications, broadcasts, email_log, activity_logs each cycle."""
    cid = target_campaign["id"]
    original_status = target_campaign.get("status", "live")

    # Ensure we start from 'live' baseline
    cur = db.campaigns.find_one({"_id": __import__("bson").ObjectId(cid)})
    if cur.get("status") != "live":
        r = _patch_status(admin_h, cid, "live")
        assert r.status_code == 200
        time.sleep(6)

    cycle = ["paused", "live", "closed", "live"]
    results = []
    for new_status in cycle:
        before_notif = db.notifications.count_documents({"campaign_id": cid, "status": new_status})
        before_bcast = db.broadcasts.count_documents({"campaign_id": cid, "kind": f"campaign_{new_status}"})
        before_email = db.email_log.count_documents({})
        before_act_fail = db.activity_logs.count_documents({"action": "email_failed", "campaign_id": cid})
        before_act_change = db.activity_logs.count_documents({"action": "campaign_status_changed", "campaign_id": cid})

        r = _patch_status(admin_h, cid, new_status)
        assert r.status_code == 200, f"{new_status}: {r.text}"
        data = r.json()
        assert data.get("status") == new_status
        assert data.get("notified") is True, f"{new_status} should notify: {data}"

        # Idempotent same-status
        r2 = _patch_status(admin_h, cid, new_status)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("notified") is False
        assert "Already" in d2.get("message", "")

        # Poll for background task completion (broadcast insert happens at end of loop; provider 429 retries can take ~60s/customer)
        deadline = time.time() + 240
        after_bcast = before_bcast
        while time.time() < deadline:
            after_bcast = db.broadcasts.count_documents({"campaign_id": cid, "kind": f"campaign_{new_status}"})
            if after_bcast > before_bcast:
                break
            time.sleep(2)

        after_notif = db.notifications.count_documents({"campaign_id": cid, "status": new_status})
        after_email = db.email_log.count_documents({})
        after_act_change = db.activity_logs.count_documents({"action": "campaign_status_changed", "campaign_id": cid})

        assert after_notif > before_notif, f"{new_status}: no new notifications ({before_notif}→{after_notif})"
        assert after_bcast == before_bcast + 1, f"{new_status}: broadcasts {before_bcast}→{after_bcast}"
        assert after_email > before_email, f"{new_status}: no new email_log rows"
        assert after_act_change == before_act_change + 1, f"{new_status}: no campaign_status_changed log"

        # Latest broadcast for this cycle
        bcast = db.broadcasts.find_one({"campaign_id": cid, "kind": f"campaign_{new_status}"}, sort=[("created_at", -1)])
        assert bcast is not None
        # Verify broadcast recipients == count of active verified customers
        active = db.users.count_documents({"role": "customer", "email_verified": True, "account_status": {"$nin": ["disabled", "deleted"]}})
        assert bcast["recipients"] == active
        # Expected failures (preview @example.com rejected 422)
        if bcast.get("failed", 0) > 0:
            after_act_fail = db.activity_logs.count_documents({"action": "email_failed", "campaign_id": cid})
            assert after_act_fail > before_act_fail, "email_failed activity log missing"

        # Verify a notification title
        word = {"live": "LIVE", "paused": "PAUSED", "closed": "CLOSED"}[new_status]
        latest_notif = db.notifications.find_one({"campaign_id": cid, "status": new_status}, sort=[("created_at", -1)])
        assert latest_notif is not None
        assert word in latest_notif.get("title", ""), f"title missing {word}: {latest_notif.get('title')}"

        # Verify @example.com preview rows: attempts==1 and no 429 (throttle must prevent)
        recent = list(db.email_log.find({"to": {"$regex": "example\\.com$"}}).sort("created_at", -1).limit(10))
        assert any(e.get("attempts", 0) == 1 for e in recent), "no example.com rows found"
        for e in recent[:5]:
            assert "429" not in (e.get("error") or ""), f"429 on preview recipient: {e.get('to')} {e.get('error')}"

        results.append((new_status, bcast["recipients"], bcast["sent"], bcast["failed"]))

    # Restore to original if different
    if original_status in ("live", "paused", "closed"):
        _patch_status(admin_h, cid, original_status)
        time.sleep(2)

    print("Cycle results:", results)


# ================= ADMIN EMAIL LOG =================

def test_email_log_shape(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/email-log", headers=admin_h, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "items" in d and "sent_24h" in d and "failed_24h" in d
    assert isinstance(d["items"], list)
    assert isinstance(d["sent_24h"], int)
    assert isinstance(d["failed_24h"], int)


def test_email_log_filter_failed(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/email-log?status=failed", headers=admin_h, timeout=30)
    assert r.status_code == 200
    for i in r.json()["items"]:
        assert i["status"] == "failed"


def test_email_log_filter_sent(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/email-log?status=sent", headers=admin_h, timeout=30)
    assert r.status_code == 200
    for i in r.json()["items"]:
        assert i["status"] == "sent"


def test_email_log_search(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/email-log?q=example.com", headers=admin_h, timeout=30)
    assert r.status_code == 200
    for i in r.json()["items"]:
        assert "example.com" in (i.get("to", "") + " " + i.get("subject", "")).lower()


def test_email_log_employee_forbidden(emp_h):
    r = requests.get(f"{BASE_URL}/api/admin/email-log", headers=emp_h, timeout=30)
    assert r.status_code == 403


# ================= ATTENDANCE REGRESSION =================

def test_employee_checkin_responds(emp_h):
    # Rahul likely already punched today → either 200 or 400 "Already"; endpoint must respond without 5xx
    r = requests.post(f"{BASE_URL}/api/employee/attendance/check-in", headers=emp_h, timeout=30)
    assert r.status_code in (200, 400), f"unexpected: {r.status_code} {r.text}"


def test_employee_checkout_responds(emp_h):
    r = requests.post(f"{BASE_URL}/api/employee/attendance/check-out", headers=emp_h, timeout=30)
    assert r.status_code in (200, 400), f"unexpected: {r.status_code} {r.text}"


def test_activity_logs_has_email_failed_system(admin_h, db):
    # The campaign lifecycle test above should have produced email_failed entries with actor System
    doc = db.activity_logs.find_one({"action": "email_failed"}, sort=[("created_at", -1)])
    assert doc is not None, "no email_failed activity_logs entry found"
    assert doc.get("actor_name") == "System" or doc.get("actor", {}).get("name") == "System"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
