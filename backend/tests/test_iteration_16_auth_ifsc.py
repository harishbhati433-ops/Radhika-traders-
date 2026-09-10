"""Iteration 16: Login speed pass (bcrypt rehash), IFSC lookup, change password regression."""
import os
import time
import pytest
import requests
from pymongo import MongoClient

def _load_frontend_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or _load_frontend_env()
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

CUSTOMER_EMAIL = "testcust@example.com"
CUSTOMER_PW = "Test@1234"
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PW = "Radhika@2023"


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(s, email, pw, portal="customer"):
    return s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw, "portal": portal})


# --- Auth: customer login + rehash ---
def test_customer_login_success_and_rehash(s, mongo):
    # clear lockout
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    t0 = time.time()
    r = _login(s, CUSTOMER_EMAIL, CUSTOMER_PW)
    dt = (time.time() - t0) * 1000
    print(f"Login latency: {dt:.0f} ms")
    assert r.status_code == 200, r.text
    j = r.json()
    assert "token" in j and j["user"]["email"] == CUSTOMER_EMAIL

    # Second login should be 200 and hash starts with $2b$10$
    r2 = _login(s, CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r2.status_code == 200
    user_doc = mongo.users.find_one({"email": CUSTOMER_EMAIL})
    ph = user_doc.get("password_hash", "")
    print(f"Stored hash prefix: {ph[:7]}")
    assert ph.startswith("$2b$10$"), f"Expected $2b$10$ prefix, got {ph[:10]}"


def test_customer_get_me(s):
    r = _login(s, CUSTOMER_EMAIL, CUSTOMER_PW)
    token = r.json()["token"]
    r2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert r2.json()["email"] == CUSTOMER_EMAIL


def test_customer_login_wrong_password_attempts_left(mongo):
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    r = _login(requests.Session(), CUSTOMER_EMAIL, "WrongPass123")
    assert r.status_code == 401
    assert "left" in r.json().get("detail", "").lower()
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})


def test_customer_lockout_after_5_wrong(mongo):
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    sess = requests.Session()
    last = None
    for _ in range(5):
        last = _login(sess, CUSTOMER_EMAIL, "WrongPass123")
    assert last.status_code == 429, last.text
    # 6th attempt still 429
    r6 = _login(sess, CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r6.status_code == 429
    # unlock by clearing
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    r7 = _login(sess, CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r7.status_code == 200


def test_admin_login_portal(mongo):
    mongo.login_attempts.delete_many({"email": ADMIN_EMAIL})
    r = _login(requests.Session(), ADMIN_EMAIL, ADMIN_PW, portal="admin")
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"


def test_customer_with_admin_portal_403(mongo):
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    r = _login(requests.Session(), CUSTOMER_EMAIL, CUSTOMER_PW, portal="admin")
    assert r.status_code == 403


# --- Change password roundtrip ---
def test_change_password_roundtrip(mongo):
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    r = _login(requests.Session(), CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r.status_code == 200
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    new_pw = "TempPw@9988"
    cp = requests.post(f"{BASE_URL}/api/security/change-password", headers=h,
                       json={"current_password": CUSTOMER_PW, "new_password": new_pw})
    assert cp.status_code == 200, cp.text
    # login with new pw
    r2 = _login(requests.Session(), CUSTOMER_EMAIL, new_pw)
    assert r2.status_code == 200
    token2 = r2.json()["token"]
    # change back
    h2 = {"Authorization": f"Bearer {token2}"}
    cp2 = requests.post(f"{BASE_URL}/api/security/change-password", headers=h2,
                        json={"current_password": new_pw, "new_password": CUSTOMER_PW})
    assert cp2.status_code == 200
    r3 = _login(requests.Session(), CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r3.status_code == 200


# --- IFSC lookup ---
@pytest.fixture(scope="module")
def cust_token(mongo):
    mongo.login_attempts.delete_many({"email": CUSTOMER_EMAIL})
    r = _login(requests.Session(), CUSTOMER_EMAIL, CUSTOMER_PW)
    assert r.status_code == 200
    return r.json()["token"]


def test_ifsc_unauth():
    r = requests.get(f"{BASE_URL}/api/ifsc/SBIN0005943")
    assert r.status_code == 401


def test_ifsc_sbin(cust_token):
    r = requests.get(f"{BASE_URL}/api/ifsc/SBIN0005943", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    j = r.json()
    print("SBIN:", j)
    if j.get("available"):
        assert "State Bank of India" in (j.get("bank") or "")
    else:
        assert j.get("reason") == "lookup_unavailable"


def test_ifsc_mahg(cust_token):
    r = requests.get(f"{BASE_URL}/api/ifsc/MAHG0004001", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    j = r.json()
    print("MAHG:", j)
    if j.get("available"):
        assert "Maharashtra" in (j.get("bank") or "")
    else:
        assert j.get("reason") == "lookup_unavailable"


def test_ifsc_notfound(cust_token):
    r = requests.get(f"{BASE_URL}/api/ifsc/ZZZZ0999999", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    j = r.json()
    print("ZZZZ:", j)
    assert j.get("available") is False
    assert j.get("reason") in ("not_found", "lookup_unavailable")


def test_ifsc_invalid_format(cust_token):
    r = requests.get(f"{BASE_URL}/api/ifsc/HDFC", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    j = r.json()
    assert j.get("available") is False
    assert j.get("reason") == "invalid_format"


# --- Regression ---
def test_go_redirect():
    r = requests.get(f"{BASE_URL}/api/go/axis-mutual-fund-sip?ref=RTA12499", allow_redirects=False)
    assert r.status_code in (301, 302, 307, 308)
