"""Tests for:
- Campaign live announcement: POST /api/campaigns with live -> in-app notif (type campaign_live), broadcast entry, live_announced_at flag
- PATCH /api/campaigns/{id}/status paused->live: NO duplicate notification (one-time only)
- GET /api/banners: auto-<campaignId> entry for live campaign without banner_url
- Reports: notification stores report_id; DELETE /api/admin/reports/{id} also removes the report notification
"""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASS = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PASS = "Test@1234"


def _login(email, password, portal=None):
    payload = {"email": email, "password": password}
    if portal:
        payload["portal"] = portal
    r = requests.post(f"{API}/auth/login", json=payload, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    # ensure not locked
    try:
        import pymongo
        mc = pymongo.MongoClient(os.environ.get("MONGO_URL") or "mongodb://localhost:27017")
        mc[os.environ.get("DB_NAME") or "test_database"]["login_attempts"].delete_many({})
    except Exception:
        pass
    return _login(ADMIN_EMAIL, ADMIN_PASS, portal="admin")


@pytest.fixture(scope="module")
def cust_token():
    return _login(CUST_EMAIL, CUST_PASS)


@pytest.fixture(scope="module")
def cust_id(cust_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


def _mk_campaign_payload(name):
    return {
        "offer_name": name,
        "company": "TestCo",
        "category": "Broking",
        "payout_amount": 500,
        "payout_type": "per_lead",
        "status": "live",
        "offer_enabled": True,
        "banner_url": "",
        "logo_url": "",
        "description": "Test campaign for live announce",
        "affiliate_links": [{"label": "Web", "url": "example.com"}],
        "lead_fields": [],
        "show_in_slider": True,
    }


class TestCampaignLiveAnnounce:
    created_ids = []

    def test_create_live_campaign_announces_and_records_flag(self, admin_token, cust_token, cust_id):
        H = {"Authorization": f"Bearer {admin_token}"}
        name = f"TEST_LiveAnnounce_{int(time.time())}"
        r = requests.post(f"{API}/campaigns", json=_mk_campaign_payload(name), headers=H, timeout=30)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        slug = r.json()["slug"]
        self.__class__.created_ids.append(cid)

        # let background task complete
        time.sleep(3)

        # live_announced_at flag set (via admin GET)
        r2 = requests.get(f"{API}/campaigns/{cid}", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("live_announced_at"), "live_announced_at not set on campaign doc"

        # Customer notifications contain campaign_live entry
        rn = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        assert rn.status_code == 200
        data = rn.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        matching = [n for n in items if n.get("type") == "campaign_live" and n.get("campaign_id") == cid]
        assert matching, f"No campaign_live notification for cid={cid}"

        # Store slug for banner test
        self.__class__._slug = slug
        self.__class__._cid = cid

    def test_broadcast_entry_recorded(self, admin_token):
        # Verify via Mongo (poll — email sending is sequential and may take time)
        import pymongo
        mc = pymongo.MongoClient(os.environ.get("MONGO_URL") or "mongodb://localhost:27017")
        db = mc[os.environ.get("DB_NAME") or "test_database"]
        cid = self.__class__._cid
        b = None
        for _ in range(30):
            b = db.broadcasts.find_one({"kind": "campaign_live", "campaign_id": cid})
            if b:
                break
            time.sleep(1)
        assert b is not None, "No broadcasts entry for campaign_live"
        assert b.get("audience") == "all"

    def test_pause_then_live_does_not_duplicate(self, admin_token, cust_token):
        H = {"Authorization": f"Bearer {admin_token}"}
        cid = self.__class__._cid
        # pause
        r = requests.patch(f"{API}/campaigns/{cid}/status", params={"status": "paused"}, headers=H, timeout=15)
        assert r.status_code == 200
        # count current
        rn = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        items = rn.json().get("items", rn.json()) if isinstance(rn.json(), dict) else rn.json()
        before = sum(1 for n in items if n.get("type") == "campaign_live" and n.get("campaign_id") == cid)

        # relive
        r = requests.patch(f"{API}/campaigns/{cid}/status", params={"status": "live"}, headers=H, timeout=15)
        assert r.status_code == 200
        time.sleep(3)
        rn = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        items = rn.json().get("items", rn.json()) if isinstance(rn.json(), dict) else rn.json()
        after = sum(1 for n in items if n.get("type") == "campaign_live" and n.get("campaign_id") == cid)
        assert after == before, f"Duplicate campaign_live notif emitted (before={before}, after={after})"

    def test_banner_auto_entry_when_no_image(self, cust_token):
        cid = self.__class__._cid
        slug = self.__class__._slug
        r = requests.get(f"{API}/banners", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        assert r.status_code == 200
        entries = r.json()
        match = [b for b in entries if b.get("id") == f"auto-{cid}"]
        assert match, f"No auto-{cid} banner entry. entries={[b.get('id') for b in entries]}"
        b = match[0]
        assert b.get("image_url") == ""
        assert b.get("campaign_slug") == slug
        assert b.get("company") == "TestCo"
        assert b.get("auto") is True

    def test_cleanup_campaigns(self, admin_token):
        import pymongo, bson
        mc = pymongo.MongoClient(os.environ.get("MONGO_URL") or "mongodb://localhost:27017")
        db = mc[os.environ.get("DB_NAME") or "test_database"]
        for cid in self.__class__.created_ids:
            db.campaigns.delete_one({"_id": bson.ObjectId(cid)})
            db.notifications.delete_many({"campaign_id": cid})
            db.broadcasts.delete_many({"campaign_id": cid})


class TestReportNotificationCleanup:
    def test_report_notif_has_report_id_and_delete_removes_notif(self, admin_token, cust_token, cust_id):
        H = {"Authorization": f"Bearer {admin_token}"}
        title = f"TEST_ReportNotif_{int(time.time())}"
        files = {"file": ("qa.csv", io.BytesIO(b"a,b\n1,2\n"), "text/csv")}
        data = {"title": title, "note": "test note", "audience": "all", "send_email": "false"}
        r = requests.post(f"{API}/admin/reports", headers=H, files=files, data=data, timeout=30)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]

        time.sleep(1)
        # customer notif has type=report and report_id
        rn = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        items = rn.json().get("items", rn.json()) if isinstance(rn.json(), dict) else rn.json()
        matching = [n for n in items if n.get("type") == "report" and n.get("report_id") == rid]
        assert matching, f"No report notif with report_id={rid}"

        # customer sees report
        rr = requests.get(f"{API}/reports", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        assert any(rep["id"] == rid for rep in rr.json())

        # delete report
        rd = requests.delete(f"{API}/admin/reports/{rid}", headers=H, timeout=15)
        assert rd.status_code == 200

        # customer no longer sees report
        rr2 = requests.get(f"{API}/reports", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        assert not any(rep["id"] == rid for rep in rr2.json())

        # notification removed
        rn2 = requests.get(f"{API}/notifications", headers={"Authorization": f"Bearer {cust_token}"}, timeout=15)
        items2 = rn2.json().get("items", rn2.json()) if isinstance(rn2.json(), dict) else rn2.json()
        matching2 = [n for n in items2 if n.get("type") == "report" and n.get("report_id") == rid]
        assert not matching2, "Report notification was NOT removed after DELETE /api/admin/reports/{id}"
