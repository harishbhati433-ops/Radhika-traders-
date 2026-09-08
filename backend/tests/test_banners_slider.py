"""Test auto campaign banners in slider (Axis Mutual Fund SIP)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
CAMPAIGN_ID = "6a9d87a93ee34323c98dfdc1"
AUTO_ID = f"auto-{CAMPAIGN_ID}"
EXPECTED_IMAGE = "/api/files/radhika-traders/uploads/eed8c02e482e4e3d8bccd639405480b8.jpeg"


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "testcust@example.com", "password": "Test@1234", "portal": "customer"})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


def _h(t):
    return {"Authorization": f"Bearer {t}"}


def test_customer_banners_contains_auto(customer_token):
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    assert r.status_code == 200
    items = r.json()
    auto = [b for b in items if b.get("id") == AUTO_ID]
    assert len(auto) == 1, f"auto banner not found; got ids={[b.get('id') for b in items]}"
    a = auto[0]
    assert a["auto"] is True
    assert a["title"] == "Axis Mutual Fund SIP"
    assert a["subtitle"] == "Earn ₹500 per approved account"
    # slug may vary; earlier notes said 'choice-trade-test' but current is 'axis-mutual-fund-sip'
    assert a["campaign_slug"] in ("choice-trade-test", "axis-mutual-fund-sip")
    assert a["campaign_live"] is True
    assert a["image_url"] == EXPECTED_IMAGE


def test_banner_image_accessible():
    r = requests.get(f"{BASE_URL}{EXPECTED_IMAGE}")
    assert r.status_code == 200
    assert "image" in r.headers.get("content-type", "")


def test_pause_and_live_toggle(customer_token, admin_token):
    # pause
    r = requests.patch(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/status",
                       params={"status": "paused"}, headers=_h(admin_token))
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert AUTO_ID not in ids, "auto banner should be gone when paused"

    # back to live
    r = requests.patch(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/status",
                       params={"status": "live"}, headers=_h(admin_token))
    assert r.status_code == 200

    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert AUTO_ID in ids, "auto banner should reappear when live"


def test_show_in_slider_toggle(customer_token, admin_token):
    # fetch campaign
    r = requests.get(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}", headers=_h(admin_token))
    assert r.status_code == 200, r.text
    camp = r.json()
    # build PUT body
    exclude = {"id", "_id", "created_at", "updated_at", "is_deleted", "clicks", "stats"}
    body = {k: v for k, v in camp.items() if k not in exclude}

    # untick
    body["show_in_slider"] = False
    r = requests.put(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}", json=body, headers=_h(admin_token))
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert AUTO_ID not in ids, f"auto banner should be hidden when show_in_slider=False. ids={ids}"

    # re-tick
    body["show_in_slider"] = True
    r = requests.put(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}", json=body, headers=_h(admin_token))
    assert r.status_code == 200

    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert AUTO_ID in ids, "auto banner should return when show_in_slider=True"
