"""
Retest of PATCH /api/admin/customers/{uid}/status after implementation.
Creates users directly via pymongo (bypasses rate-limited email OTP).
"""
import os
import re
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

_client = MongoClient(MONGO_URL)
_db = _client[DB_NAME]
_created_ids = []

# Seed hash so login password will be "Test@1234"
SEED_HASH = _db.users.find_one({"email": "testcust@example.com"}, {"password_hash": 1})["password_hash"]
SEED_PW = "Test@1234"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _mk_user(role="customer", email_verified=True):
    email = f"qa+retest_{uuid.uuid4().hex[:8]}@example.com"
    mobile = f"9{uuid.uuid4().int % 1000000000:09d}"
    ref = "QA" + uuid.uuid4().hex[:6].upper()
    doc = {
        "name": "QA Retest",
        "email": email,
        "mobile": mobile,
        "password_hash": SEED_HASH,
        "role": role,
        "email_verified": email_verified,
        "referral_code": ref,
        "created_at": now_iso(),
        "kyc": {"status": "not_submitted"},
        "bank": {},
    }
    r = _db.users.insert_one(doc)
    _created_ids.append(r.inserted_id)
    return {"id": str(r.inserted_id), "email": email, "mobile": mobile, "password": SEED_PW, "referral_code": ref}


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _login(u):
    return requests.post(f"{API}/auth/login",
                         json={"email": u["email"], "password": u["password"], "portal": "customer"})


def _cust_token(u):
    r = _login(u)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    if _created_ids:
        _db.users.delete_many({"_id": {"$in": _created_ids}})
        _created_ids.clear()


# ---------- Deactivate ----------
class TestDeactivate:
    def test_reason_required(self, admin_headers):
        u = _mk_user()
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deactivated", "reason": ""}, headers=admin_headers)
        assert r.status_code == 400
        assert "reason" in r.json()["detail"].lower()

    def test_deactivate_blocks_login_and_existing_token(self, admin_headers):
        u = _mk_user()
        token = _cust_token(u)
        h = {"Authorization": f"Bearer {token}"}
        assert requests.get(f"{API}/wallet", headers=h).status_code == 200

        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deactivated", "reason": "policy check"},
                           headers=admin_headers)
        assert r.status_code == 200, r.text

        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        row = next((c for c in lst if c["id"] == u["id"]), None)
        assert row is not None
        assert row.get("account_status") == "deactivated"
        assert row.get("account_status_reason") == "policy check"

        lg = _login(u)
        assert lg.status_code == 403
        assert "temporarily deactivated" in lg.json()["detail"].lower()

        w = requests.get(f"{API}/wallet", headers=h)
        assert w.status_code == 403


# ---------- Disabled / Active ----------
class TestDisabledAndActive:
    def test_disabled_then_active(self, admin_headers):
        u = _mk_user()
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "disabled", "reason": "abuse"}, headers=admin_headers)
        assert r.status_code == 200
        lg = _login(u)
        assert lg.status_code == 403
        assert "disabled" in lg.json()["detail"].lower()

        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "active", "reason": ""}, headers=admin_headers)
        assert r.status_code == 200
        lg = _login(u)
        assert lg.status_code == 200


# ---------- Deleted (soft) ----------
class TestSoftDelete:
    def test_deleted_hides_and_blocks_login_and_blocks_reregister(self, admin_headers):
        u = _mk_user()
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deleted", "reason": "user request"}, headers=admin_headers)
        assert r.status_code == 200

        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        assert not any(c["id"] == u["id"] for c in lst), "deleted user should be hidden"

        lst2 = requests.get(f"{API}/admin/customers", params={"include_deleted": "true"},
                            headers=admin_headers).json()
        assert any(c["id"] == u["id"] for c in lst2), "deleted user should be visible with include_deleted"

        lg = _login(u)
        assert lg.status_code == 401

        # Re-register with same email must be blocked as already registered
        rr = requests.post(f"{API}/auth/register", json={
            "name": "Retry", "email": u["email"], "mobile": f"9{uuid.uuid4().int % 1000000000:09d}",
            "password": "Passw0rd!"})
        assert rr.status_code == 400, rr.text
        assert "already registered" in rr.json()["detail"].lower()


# ---------- Purge (hard) ----------
class TestPurge:
    def test_purge_removes_user_and_transactions(self, admin_headers):
        u = _mk_user()
        # seed a transaction + withdrawal so we can assert cascade
        _db.transactions.insert_one({"user_id": u["id"], "amount": 100, "type": "credit",
                                     "description": "seed", "status": "completed", "created_at": now_iso()})
        _db.withdrawals.insert_one({"user_id": u["id"], "amount": 100, "status": "pending",
                                    "created_at": now_iso()})
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "purge", "reason": "gdpr"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        lst = requests.get(f"{API}/admin/customers", params={"include_deleted": "true"},
                           headers=admin_headers).json()
        assert not any(c["id"] == u["id"] for c in lst)
        assert _db.users.find_one({"_id": ObjectId(u["id"])}) is None
        assert _db.transactions.count_documents({"user_id": u["id"]}) == 0
        assert _db.withdrawals.count_documents({"user_id": u["id"]}) == 0


# ---------- Disabled partner referrals ----------
class TestDisabledPartnerReferral:
    def test_go_302_but_lead_has_no_partner(self, admin_headers):
        p = _mk_user()
        ref = p["referral_code"]
        r = requests.patch(f"{API}/admin/customers/{p['id']}/status",
                           json={"status": "disabled", "reason": "fraud"}, headers=admin_headers)
        assert r.status_code == 200

        rr = requests.get(f"{API}/go/choice-trade-test", params={"ref": ref}, allow_redirects=False)
        assert rr.status_code == 302, rr.text

        mobile = f"9{uuid.uuid4().int % 1000000000:09d}"
        lead_r = requests.post(f"{API}/leads/choice-trade-test",
                               json={"ref": ref,
                                     "data": {"name": "Neutral QA", "mobile": mobile,
                                              "email": f"neutralqa_{uuid.uuid4().hex[:6]}@example.com",
                                              "pan": "ABCDE1234F"}})
        assert lead_r.status_code == 200, lead_r.text
        lid = lead_r.json()["id"]

        lead_doc = _db.leads.find_one({"lead_id": lid}) or _db.leads.find_one({"_id": ObjectId(lid) if ObjectId.is_valid(lid) else lid})
        # try find by any lead identifier fields
        if not lead_doc:
            lead_doc = _db.leads.find_one({"data.mobile": mobile})
        assert lead_doc is not None
        assert not lead_doc.get("partner_id"), f"Expected no partner_id, got {lead_doc.get('partner_id')}"
        # cleanup
        _db.leads.delete_one({"_id": lead_doc["_id"]})
