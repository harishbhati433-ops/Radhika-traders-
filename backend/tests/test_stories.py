# Stories feature: admin CRUD/upload, customer feed/view tracking, expiry, campaign auto-stories, cron cleanup
import io
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")
BENV = dotenv_values("/app/backend/.env")
mdb = MongoClient(BENV["MONGO_URL"])[BENV["DB_NAME"]]
CREATED = []


def _login(payload):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text[:200]}")
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_login({'email': 'bhatiharish276@gmail.com', 'password': 'Radhika@2023', 'portal': 'admin'})}"
    return s


@pytest.fixture(scope="module")
def cust():
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_login({'email': 'testcust@example.com', 'password': 'Test@1234'})}"
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {_login({'email': 'bhatiharish276@gmail.com', 'password': 'Radhika@2023', 'portal': 'admin'})}"
    for sid in CREATED:
        s.delete(f"{BASE_URL}/api/admin/stories/{sid}")


def _jpeg():
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (600, 400), (200, 30, 30)).save(b, "JPEG")
    return b.getvalue()


def _mk(admin, **kw):
    body = {"title": "TEST_text story", "caption": "TEST caption", "category": "Office Celebrations", "media_type": "text", "auto_expire": False, **kw}
    r = admin.post(f"{BASE_URL}/api/admin/stories", json=body)
    assert r.status_code == 201, r.text
    CREATED.append(r.json()["id"])
    return r.json()


def _admin_find(admin, sid):
    d = admin.get(f"{BASE_URL}/api/admin/stories").json()
    return next((s for s in d["manual"] + d["campaign"] if s["id"] == sid), None)


def _cust_ids(cust):
    r = cust.get(f"{BASE_URL}/api/stories")
    assert r.status_code == 200
    return [s["id"] for s in r.json()]


# ---- upload ----
class TestUpload:
    def test_upload_jpeg(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/stories/upload", files={"file": ("a.jpg", _jpeg(), "image/jpeg")})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["media_type"] == "image" and d["url"].endswith(".webp") and d["path"]
        g = requests.get(f"{BASE_URL}{d['url']}")
        print("media GET", g.status_code, g.headers.get("content-type"))
        assert g.status_code == 200

    def test_upload_text_rejected(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/stories/upload", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 400

    def test_upload_too_large(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/stories/upload", files={"file": ("big.jpg", b"\xff" * (9 * 1024 * 1024), "image/jpeg")})
        assert r.status_code == 413, r.status_code


# ---- create ----
class TestCreate:
    def test_text_story(self, admin):
        d = _mk(admin)
        assert d["visible"] is True and d["expires_at"] is None and d["kind"] == "manual"

    def test_image_story_24h(self, admin):
        up = admin.post(f"{BASE_URL}/api/admin/stories/upload", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}).json()
        d = _mk(admin, title="TEST_img", media_type="image", media_url=up["url"], media_path=up["path"], auto_expire=True, category="Offers")
        exp = datetime.fromisoformat(d["expires_at"])
        delta = (exp - datetime.now(timezone.utc)).total_seconds()
        assert 23.9 * 3600 < delta < 24.1 * 3600

    def test_invalid_category(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/stories", json={"title": "TEST_x", "category": "Bogus", "media_type": "text"})
        assert r.status_code == 400

    def test_image_without_media(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/stories", json={"title": "TEST_x", "category": "Offers", "media_type": "image"})
        assert r.status_code == 400


# ---- customer feed + views ----
class TestCustomerFeed:
    def test_unauth(self):
        assert requests.get(f"{BASE_URL}/api/stories").status_code == 401

    def test_feed_fields_no_leak(self, cust, admin):
        d = _mk(admin, title="TEST_feed")
        r = cust.get(f"{BASE_URL}/api/stories").json()
        s = next(x for x in r if x["id"] == d["id"])
        for k in ("id", "kind", "title", "media_type", "media_url", "link", "seen"):
            assert k in s
        for k in ("total_views", "unique_viewers", "viewers", "created_by", "active"):
            assert k not in s
        cids = [x["campaign_id"] for x in r if x["kind"] == "campaign"]
        assert len(cids) == len(set(cids))

    def test_view_dedupe_and_viewers(self, cust, admin):
        d = _mk(admin, title="TEST_views")
        r1 = cust.post(f"{BASE_URL}/api/stories/{d['id']}/view").json()
        r2 = cust.post(f"{BASE_URL}/api/stories/{d['id']}/view").json()
        assert r1.get("ok") is True and r2.get("deduped") is True
        a = _admin_find(admin, d["id"])
        assert a["total_views"] == 1 and a["unique_viewers"] == 1
        v = admin.get(f"{BASE_URL}/api/admin/stories/{d['id']}/viewers").json()
        it = v["items"][0]
        for k in ("name", "customer_id", "viewed_at", "count", "mobile"):
            assert k in it
        assert it["mobile"]  # admin role sees mobile
        assert {"page", "limit", "has_more"} <= set(v)
        name = it["name"]
        assert len(admin.get(f"{BASE_URL}/api/admin/stories/{d['id']}/viewers", params={"q": name[:3]}).json()["items"]) == 1
        assert len(admin.get(f"{BASE_URL}/api/admin/stories/{d['id']}/viewers", params={"q": "zzqqxx"}).json()["items"]) == 0
        seen = next(x for x in cust.get(f"{BASE_URL}/api/stories").json() if x["id"] == d["id"])["seen"]
        assert seen is True

    def test_customer_forbidden_admin(self, cust):
        assert cust.get(f"{BASE_URL}/api/admin/stories").status_code == 403
        assert cust.post(f"{BASE_URL}/api/admin/stories", json={"title": "TEST_x", "media_type": "text"}).status_code == 403


# ---- update ----
class TestUpdate:
    def test_toggle_active_and_republish(self, admin, cust):
        d = _mk(admin, title="TEST_toggle")
        assert admin.put(f"{BASE_URL}/api/admin/stories/{d['id']}", json={"active": False}).status_code == 200
        assert d["id"] not in _cust_ids(cust)
        time.sleep(1)
        u = admin.put(f"{BASE_URL}/api/admin/stories/{d['id']}", json={"active": True}).json()
        assert u["published_at"] > d["published_at"]
        assert d["id"] in _cust_ids(cust)
        time.sleep(1)
        u2 = admin.put(f"{BASE_URL}/api/admin/stories/{d['id']}", json={"republish": True}).json()
        assert u2["published_at"] > u["published_at"]
        u3 = admin.put(f"{BASE_URL}/api/admin/stories/{d['id']}", json={"auto_expire": True}).json()
        assert u3["auto_expire"] is True and u3["expires_at"]

    def test_campaign_story_title_locked(self, admin):
        camp = admin.get(f"{BASE_URL}/api/admin/stories").json()["campaign"]
        assert camp
        s = camp[0]
        u = admin.put(f"{BASE_URL}/api/admin/stories/{s['id']}", json={"title": "TEST_hacked", "auto_expire": s["auto_expire"]}).json()
        assert u["title"] == s["title"]
        assert mdb.stories.find_one({"_id": ObjectId(s["id"])}).get("title") is None


# ---- expiry ----
class TestExpiry:
    def test_expired(self, admin, cust):
        d = _mk(admin, title="TEST_expiry", auto_expire=True)
        old = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        mdb.stories.update_one({"_id": ObjectId(d["id"])}, {"$set": {"published_at": old}})
        assert d["id"] not in _cust_ids(cust)
        a = _admin_find(admin, d["id"])
        assert a["expired"] is True and a["visible"] is False
        assert cust.post(f"{BASE_URL}/api/stories/{d['id']}/view").json()["ok"] is False
        mdb.stories.update_one({"_id": ObjectId(d["id"])}, {"$set": {"auto_expire": False}})
        assert d["id"] in _cust_ids(cust)


# ---- campaign auto stories ----
class TestCampaignStories:
    def test_one_per_live_campaign_and_pause(self, admin, cust):
        d = admin.get(f"{BASE_URL}/api/admin/stories").json()
        cids = [s["campaign_id"] for s in d["campaign"]]
        assert len(cids) == len(set(cids))
        live = {str(c["_id"]) for c in mdb.campaigns.find({"status": "live"}, {"_id": 1})}
        assert live <= set(cids)
        assert mdb.stories.count_documents({"kind": "campaign"}) == len(set(mdb.stories.distinct("campaign_id", {"kind": "campaign"})))
        target = next(s for s in d["campaign"] if s["visible"])
        cid = target["campaign_id"]
        r = admin.patch(f"{BASE_URL}/api/campaigns/{cid}/status", params={"status": "paused"})
        assert r.status_code == 200, r.text
        try:
            a = _admin_find(admin, target["id"])
            assert a["visible"] is False
            assert target["id"] not in _cust_ids(cust)
        finally:
            r = admin.patch(f"{BASE_URL}/api/campaigns/{cid}/status", params={"status": "live"})
            assert r.status_code == 200
        a = _admin_find(admin, target["id"])
        assert a["visible"] is True
        assert target["id"] in _cust_ids(cust)

    def test_delete_campaign_story_400(self, admin):
        s = admin.get(f"{BASE_URL}/api/admin/stories").json()["campaign"][0]
        assert admin.delete(f"{BASE_URL}/api/admin/stories/{s['id']}").status_code == 400


# ---- delete + cron ----
class TestDeleteCron:
    def test_delete_manual(self, admin, cust):
        d = _mk(admin, title="TEST_del")
        cust.post(f"{BASE_URL}/api/stories/{d['id']}/view")
        assert admin.delete(f"{BASE_URL}/api/admin/stories/{d['id']}").status_code == 200
        assert _admin_find(admin, d["id"]) is None
        assert mdb.story_views.count_documents({"story_id": d["id"]}) == 0
        v = admin.get(f"{BASE_URL}/api/admin/stories/{d['id']}/viewers")
        assert v.status_code == 404 or v.json()["items"] == []

    def test_cron(self):
        assert requests.post(f"{BASE_URL}/api/cron/stories-cleanup").status_code == 401
        r = requests.post(f"{BASE_URL}/api/cron/stories-cleanup", headers={"Authorization": f"Bearer {BENV['WEBHOOK_CRON_SECRET']}"})
        assert r.status_code == 202
