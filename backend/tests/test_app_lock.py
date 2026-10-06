"""Backend tests for App Lock feature (/api/app-lock/*)."""
import os
import pytest
import requests
from urllib.parse import urlparse

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ORIGIN = BASE_URL
HOST = urlparse(BASE_URL).hostname


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def emp_token():
    r = requests.post(f"{API}/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def cust_token():
    r = requests.post(f"{API}/auth/login", json={"email": "testcust@example.com", "password": "Test@1234", "portal": "customer"})
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("access_token")


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- employee: status, unlock, pin change, biometric options ----------
class TestEmployeeAppLock:
    def test_status(self, emp_token):
        r = requests.get(f"{API}/app-lock/status", headers=h(emp_token))
        assert r.status_code == 200
        d = r.json()
        assert d["configured"] is True
        assert d["enabled"] is True
        assert "biometric" in d and isinstance(d["biometric"], bool)
        assert d["email_masked"]

    def test_unlock_wrong_returns_400(self, emp_token):
        r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "1111"}, headers=h(emp_token))
        assert r.status_code == 400, r.text
        assert "attempt" in r.json()["detail"].lower() or "wrong" in r.json()["detail"].lower()

    def test_unlock_correct_resets_failures(self, emp_token):
        r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "2580"}, headers=h(emp_token))
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        s = requests.get(f"{API}/app-lock/status", headers=h(emp_token)).json()
        assert s["failures"] == 0

    def test_set_pin_too_easy_1234(self, emp_token):
        r = requests.post(f"{API}/app-lock/pin/set", json={"pin": "1234", "current_pin": "2580"}, headers=h(emp_token))
        assert r.status_code == 400
        assert "too easy" in r.json()["detail"].lower()

    def test_set_pin_too_easy_0000(self, emp_token):
        r = requests.post(f"{API}/app-lock/pin/set", json={"pin": "0000", "current_pin": "2580"}, headers=h(emp_token))
        assert r.status_code == 400

    def test_set_pin_wrong_current(self, emp_token):
        r = requests.post(f"{API}/app-lock/pin/set", json={"pin": "3690", "current_pin": "wrong"}, headers=h(emp_token))
        assert r.status_code == 400
        assert "current pin" in r.json()["detail"].lower()

    def test_change_pin_flow_and_restore(self, emp_token):
        # Change 2580 -> 3690
        r = requests.post(f"{API}/app-lock/pin/set", json={"pin": "3690", "current_pin": "2580"}, headers=h(emp_token))
        assert r.status_code == 200, r.text
        # Unlock with new
        r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "3690"}, headers=h(emp_token))
        assert r.status_code == 200
        # Restore 3690 -> 2580
        r = requests.post(f"{API}/app-lock/pin/set", json={"pin": "2580", "current_pin": "3690"}, headers=h(emp_token))
        assert r.status_code == 200
        r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "2580"}, headers=h(emp_token))
        assert r.status_code == 200

    def test_bio_register_options_no_origin(self, emp_token):
        # requests default has no Origin; endpoint should refuse
        r = requests.post(f"{API}/app-lock/biometric/register/options", headers=h(emp_token))
        assert r.status_code == 400

    def test_bio_register_options_with_origin(self, emp_token):
        hdr = h(emp_token)
        hdr["Origin"] = ORIGIN
        r = requests.post(f"{API}/app-lock/biometric/register/options", headers=hdr)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rp"]["id"] == HOST
        assert d.get("challenge")
        assert d.get("user")

    def test_me_includes_app_lock(self, emp_token):
        r = requests.get(f"{API}/auth/me", headers=h(emp_token))
        assert r.status_code == 200
        me = r.json()
        assert "app_lock" in me
        assert me["app_lock"]["configured"] is True
        assert me["app_lock"]["enabled"] is True


# ---------- customer: lockout + recovery ----------
class TestCustomerLockout:
    def test_lockout_after_5_wrong(self, cust_token):
        # Ensure clean state
        import pymongo
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        mc = pymongo.MongoClient(os.environ["MONGO_URL"])
        db = mc[os.environ["DB_NAME"]]
        db.users.update_one({"email": "testcust@example.com"}, {"$set": {"app_lock.failures": 0, "app_lock.locked_until": ""}})

        statuses = []
        for i in range(5):
            r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "0001"}, headers=h(cust_token))
            statuses.append((r.status_code, r.json().get("detail", "")))
        # 5th should be 400 mentioning locked / minutes
        assert statuses[-1][0] == 400, statuses
        last_msg = statuses[-1][1].lower()
        assert ("30" in last_msg) or ("locked" in last_msg) or ("minute" in last_msg), statuses

        # 6th -> 429
        r6 = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "0001"}, headers=h(cust_token))
        assert r6.status_code == 429, r6.text

        # Status shows locked_until
        s = requests.get(f"{API}/app-lock/status", headers=h(cust_token)).json()
        assert s["locked_until"], s

    def test_reset_with_wrong_otp(self, cust_token):
        # Try forgot (may 502 for @example.com)
        f = requests.post(f"{API}/app-lock/forgot", headers=h(cust_token))
        if f.status_code == 200:
            # Wrong code should be 400
            r = requests.post(f"{API}/app-lock/reset", json={"pin": "2468", "code": "000000"}, headers=h(cust_token))
            assert r.status_code == 400
            assert "invalid" in r.json()["detail"].lower() or "expired" in r.json()["detail"].lower()
        else:
            # 502 expected for @example.com in preview
            assert f.status_code in (502, 429), f.text

    def test_cleanup_customer_state(self, cust_token):
        # Reset to known state: PIN 2468, failures 0, unlocked
        import pymongo
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        mc = pymongo.MongoClient(os.environ["MONGO_URL"])
        db = mc[os.environ["DB_NAME"]]
        db.users.update_one({"email": "testcust@example.com"}, {"$set": {"app_lock.failures": 0, "app_lock.locked_until": ""}})
        db.app_lock_otps.delete_many({})
        # Confirm unlock works
        r = requests.post(f"{API}/app-lock/pin/unlock", json={"pin": "2468"}, headers=h(cust_token))
        assert r.status_code == 200, r.text
