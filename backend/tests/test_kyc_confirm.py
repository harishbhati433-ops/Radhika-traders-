"""Backend tests for KYC Confirm Account Number feature + Welcome modal signup flag prep."""
import os
import re
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://radhika-connect.preview.emergentagent.com"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

client = MongoClient(MONGO_URL)
db = client[DB_NAME]


@pytest.fixture(scope="module")
def throwaway_customer():
    """Create a throwaway verified customer copying testcust's password_hash."""
    testcust = db.users.find_one({"email": "testcust@example.com"})
    assert testcust, "testcust@example.com must exist"
    email = f"test_kyc_{uuid.uuid4().hex[:8]}@example.com"  # lowercase — login lowercases before lookup
    doc = {
        "email": email,
        "name": "TEST KYC User",
        "mobile": "9000000001",
        "password_hash": testcust["password_hash"],
        "role": "customer",
        "email_verified": True,
        "active": True,
        "referral_code": "TSTKYC" + uuid.uuid4().hex[:4].upper(),
        "kyc": {"status": "not_submitted"},
        "bank": {},
        "created_at": "2026-01-01T00:00:00Z",
    }
    res = db.users.insert_one(doc)
    uid = str(res.inserted_id)
    yield {"id": uid, "email": email, "password": "Test@1234"}
    db.users.delete_one({"_id": ObjectId(uid)})
    db.notifications.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def customer_token(throwaway_customer):
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": throwaway_customer["email"], "password": throwaway_customer["password"]},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def test_kyc_mismatch_blocked(customer_token):
    body = {
        "pan": "ABCDE1234F",
        "bank_account": "123456789012",
        "bank_account_confirm": "999999999999",
        "ifsc": "HDFC0001234",
        "account_holder": "Test",
    }
    r = requests.put(f"{BASE_URL}/api/profile/kyc", json=body, headers=_hdr(customer_token), timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", "")
    assert "do not match" in detail.lower(), f"unexpected message: {detail}"


def test_kyc_match_not_mismatch_error(customer_token):
    """Matching confirm should not raise the mismatch error (may 200 or fail other validation)."""
    body = {
        "pan": "ABCDE1234F",
        "bank_account": "123456789012",
        "bank_account_confirm": "123456789012",
        "ifsc": "HDFC0001234",
        "account_holder": "Test",
    }
    r = requests.put(f"{BASE_URL}/api/profile/kyc", json=body, headers=_hdr(customer_token), timeout=15)
    if r.status_code == 400:
        assert "do not match" not in r.json().get("detail", "").lower()
    else:
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text}"


def test_kyc_confirm_omitted_backward_compat(customer_token):
    """Backward compat: if bank_account_confirm not provided, should not fail on that check."""
    body = {
        "pan": "ABCDE1234F",
        "bank_account": "123456789012",
        "ifsc": "HDFC0001234",
        "account_holder": "Test",
    }
    r = requests.put(f"{BASE_URL}/api/profile/kyc", json=body, headers=_hdr(customer_token), timeout=15)
    # Must not be the mismatch error
    if r.status_code == 400:
        assert "do not match" not in r.json().get("detail", "").lower()
