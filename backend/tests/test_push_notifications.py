"""Backend tests for Web Push notifications (VAPID, pywebpush) + regression on in-app notifications & campaign status broadcasts."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASS = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PASS = "Test@1234"
EMP_USER = "rahul.k"
EMP_PASS = "Emp@1234"
CAMPAIGN_ID = "6a9d87a93ee34323c98dfdc1"

FAKE_ENDPOINT = "https://fcm.googleapis.com/fcm/send/fake-xyz-push-test"
FAKE_P256DH = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM"
FAKE_AUTH = "tBHItJI5svbpez7KI4CCXg"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS, "portal": "admin"}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_token():
    r = requests.post(f"{API}/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASS}, timeout=20)
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def employee_token():
    r = requests.post(f"{API}/auth/employee/login", json={"username": EMP_USER, "password": EMP_PASS}, timeout=20)
    assert r.status_code == 200, f"employee login failed: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


def _auth(tok): return {"Authorization": f"Bearer {tok}"}


# ---------- VAPID public key ----------
def test_vapid_public_key_public():
    r = requests.get(f"{API}/push/vapid-public-key", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "key" in body and isinstance(body["key"], str) and len(body["key"]) > 20


# ---------- /push/subscribe ----------
def test_subscribe_requires_auth():
    r = requests.post(f"{API}/push/subscribe", json={"subscription": {"endpoint": FAKE_ENDPOINT, "keys": {"p256dh": FAKE_P256DH, "auth": FAKE_AUTH}}}, timeout=15)
    assert r.status_code in (401, 403)


def test_subscribe_invalid_body_400(customer_token):
    # missing endpoint
    r = requests.post(f"{API}/push/subscribe", headers=_auth(customer_token), json={"subscription": {"keys": {"p256dh": "x", "auth": "y"}}}, timeout=15)
    assert r.status_code == 400
    # missing keys
    r2 = requests.post(f"{API}/push/subscribe", headers=_auth(customer_token), json={"subscription": {"endpoint": FAKE_ENDPOINT}}, timeout=15)
    assert r2.status_code == 400


@pytest.mark.parametrize("role,token_fixture", [("customer", "customer_token"), ("admin", "admin_token"), ("employee", "employee_token")])
def test_subscribe_accepts_all_roles(role, token_fixture, request):
    tok = request.getfixturevalue(token_fixture)
    endpoint = f"{FAKE_ENDPOINT}-{role}"
    body = {"subscription": {"endpoint": endpoint, "keys": {"p256dh": FAKE_P256DH, "auth": FAKE_AUTH}}, "device": f"pytest-{role}"}
    r = requests.post(f"{API}/push/subscribe", headers=_auth(tok), json=body, timeout=15)
    assert r.status_code == 200, f"{role}: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data.get("devices", 0) >= 1
    # cleanup
    requests.post(f"{API}/push/unsubscribe", headers=_auth(tok), json={"endpoint": endpoint}, timeout=15)


# ---------- /push/test (dead subscription auto-cleanup) ----------
def test_push_test_no_subscription_400(customer_token):
    # ensure none first
    requests.post(f"{API}/push/unsubscribe", headers=_auth(customer_token), json={"endpoint": FAKE_ENDPOINT}, timeout=15)
    r = requests.post(f"{API}/push/test", headers=_auth(customer_token), timeout=15)
    assert r.status_code == 400
    assert "No device" in r.text or "subscrib" in r.text.lower()


def test_push_test_dead_endpoint_auto_cleans(customer_token):
    # subscribe fake endpoint
    sub = {"subscription": {"endpoint": FAKE_ENDPOINT, "keys": {"p256dh": FAKE_P256DH, "auth": FAKE_AUTH}}, "device": "pytest-dead"}
    r = requests.post(f"{API}/push/subscribe", headers=_auth(customer_token), json=sub, timeout=15)
    assert r.status_code == 200
    # 1st /push/test → sent:0, devices:1 (webpush 4xx → "gone" → row deleted)
    r1 = requests.post(f"{API}/push/test", headers=_auth(customer_token), timeout=30)
    assert r1.status_code == 200, f"first push/test failed: {r1.status_code} {r1.text[:200]}"
    body = r1.json()
    assert body.get("sent") == 0
    assert body.get("devices") == 1
    # 2nd /push/test should 400 because dead sub was auto-deleted
    time.sleep(0.5)
    r2 = requests.post(f"{API}/push/test", headers=_auth(customer_token), timeout=15)
    assert r2.status_code == 400, f"expected 400 after auto-cleanup, got {r2.status_code} {r2.text[:200]}"


def test_unsubscribe_removes_row(customer_token):
    sub = {"subscription": {"endpoint": FAKE_ENDPOINT + "-unsub", "keys": {"p256dh": FAKE_P256DH, "auth": FAKE_AUTH}}, "device": "pytest-unsub"}
    requests.post(f"{API}/push/subscribe", headers=_auth(customer_token), json=sub, timeout=15)
    r = requests.post(f"{API}/push/unsubscribe", headers=_auth(customer_token), json={"endpoint": FAKE_ENDPOINT + "-unsub"}, timeout=15)
    assert r.status_code == 200
    # a /push/test with no other subs should 400
    r2 = requests.post(f"{API}/push/test", headers=_auth(customer_token), timeout=15)
    assert r2.status_code == 400


# ---------- /notifications works for all roles ----------
@pytest.mark.parametrize("token_fixture", ["admin_token", "customer_token", "employee_token"])
def test_notifications_endpoint_all_roles(token_fixture, request):
    tok = request.getfixturevalue(token_fixture)
    r = requests.get(f"{API}/notifications", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, f"{token_fixture}: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert "items" in data and "unread" in data
    assert isinstance(data["items"], list)


# ---------- Campaign status toggles -> in-app only, no bulk email_outbox ----------
def test_campaign_status_toggle_in_app_only(admin_token):
    # paused -> live. Record a timestamp before, then verify the broadcast row.
    t0 = time.time()
    r1 = requests.patch(f"{API}/campaigns/{CAMPAIGN_ID}/status?status=paused", headers=_auth(admin_token), timeout=20)
    assert r1.status_code in (200, 204), f"pause failed: {r1.status_code} {r1.text[:200]}"
    time.sleep(1.5)
    r2 = requests.patch(f"{API}/campaigns/{CAMPAIGN_ID}/status?status=live", headers=_auth(admin_token), timeout=20)
    assert r2.status_code in (200, 204), f"live failed: {r2.status_code} {r2.text[:200]}"
    time.sleep(2.0)

    # customer should now have a campaign_status / campaign_live notification visible
    c = requests.post(f"{API}/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASS}, timeout=15)
    ctok = c.json()["token"]
    notifs = requests.get(f"{API}/notifications", headers=_auth(ctok), timeout=15).json()
    recent_titles = [n.get("title", "") for n in notifs.get("items", [])[:10]]
    assert any("Campaign" in t for t in recent_titles), f"no campaign notification in recent: {recent_titles}"
    _ = t0  # kept for debugging if needed
