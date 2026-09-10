"""Iteration 15: Auto Campaign Banner & Slider tests.

Covers:
- POST /api/campaigns without banner_url -> auto-<cid> appears in customer GET /api/banners with all fields
- PUT /api/campaigns/{id} title/payout -> banner subtitle/title updates
- Status paused / offer_enabled=false / DELETE -> auto banner disappears
- PATCH /api/admin/campaigns/{cid}/slider show_in_slider / headline / tagline / order / errors
- Non-admin -> 403, empty body -> 400
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PW = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PW = "Test@1234"
AXIS_CID = "6a9d87a93ee34323c98dfdc1"  # existing axis-mutual-fund-sip


def _login(email, pw, portal):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw, "portal": portal})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PW, "admin")


@pytest.fixture(scope="module")
def customer_token():
    return _login(CUST_EMAIL, CUST_PW, "customer")


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Campaign lifecycle fixture ----------
CREATED = {}


@pytest.fixture(scope="module")
def created_campaign(admin_token):
    """Create a live campaign without banner_url; teardown = archive."""
    payload = {
        "offer_name": "TEST_AutoBanner Campaign",
        "company": "TestCo",
        "category": "Investment",
        "payout_amount": 300,
        "payout_type": "Fixed",
        "customer_benefit": "Free demat account",
        "investment": "₹1000",
        "campaign_type": "Non-Trade",
        "description": "TestCo desc",
        "min_requirement": "Complete KYC",
        "status": "live",
        "offer_enabled": True,
        "show_in_slider": True,
        "slider_order": 50,
    }
    r = requests.post(f"{BASE_URL}/api/campaigns", json=payload, headers=_h(admin_token))
    assert r.status_code in (200, 201), r.text
    c = r.json()
    cid = c.get("id") or c.get("_id")
    CREATED["cid"] = cid
    CREATED["slug"] = c.get("slug")
    yield c
    # teardown: archive
    try:
        requests.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=_h(admin_token))
    except Exception:
        pass


def test_customer_sees_new_auto_banner(created_campaign, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    time.sleep(0.5)
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    assert r.status_code == 200
    items = r.json()
    match = [b for b in items if b.get("id") == auto_id]
    assert len(match) == 1, f"auto banner {auto_id} not found; got {[b.get('id') for b in items]}"
    a = match[0]
    assert a["auto"] is True
    assert a["title"] == "TEST_AutoBanner Campaign"
    assert a["subtitle"] == "Earn ₹300 per approved account"
    assert a["image_url"] == ""  # no banner_url -> generated slide
    assert a["company"] == "TestCo"
    assert a["campaign_type"] == "Non-Trade"
    assert a["payout_amount"] == 300
    assert a["investment"] == "₹1000"
    assert a["requirement"] == "Complete KYC"
    assert a["customer_benefit"] == "Free demat account"
    assert a["campaign_slug"] == CREATED["slug"]
    assert a["campaign_live"] is True
    assert a["enabled"] is True


def test_update_campaign_refreshes_banner(created_campaign, admin_token, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    # fetch full doc & update name + payout
    r = requests.get(f"{BASE_URL}/api/campaigns/{cid}", headers=_h(admin_token))
    assert r.status_code == 200
    camp = r.json()
    exclude = {"id", "_id", "created_at", "updated_at", "is_deleted", "clicks", "stats", "slug"}
    body = {k: v for k, v in camp.items() if k not in exclude}
    body["offer_name"] = "TEST_AutoBanner Updated"
    body["payout_amount"] = 450
    r = requests.put(f"{BASE_URL}/api/campaigns/{cid}", json=body, headers=_h(admin_token))
    assert r.status_code == 200, r.text
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    a = next(b for b in r.json() if b.get("id") == auto_id)
    assert a["title"] == "TEST_AutoBanner Updated"
    assert a["subtitle"] == "Earn ₹450 per approved account"
    assert a["payout_amount"] == 450


def test_pause_removes_auto_banner(created_campaign, admin_token, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status",
                       params={"status": "paused"}, headers=_h(admin_token))
    assert r.status_code == 200, r.text
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert auto_id not in ids
    # back live
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/status",
                       params={"status": "live"}, headers=_h(admin_token))
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert auto_id in ids


def test_toggle_offer_removes_auto_banner(created_campaign, admin_token, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/toggle-offer",
                       params={"enabled": False}, headers=_h(admin_token))
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert auto_id not in ids
    r = requests.patch(f"{BASE_URL}/api/campaigns/{cid}/toggle-offer",
                       params={"enabled": True}, headers=_h(admin_token))
    assert r.status_code == 200


def test_slider_patch_show_in_slider(created_campaign, admin_token, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={"show_in_slider": False}, headers=_h(admin_token))
    assert r.status_code == 200, r.text
    # customer excluded
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert auto_id not in ids
    # admin all=true shows enabled=false
    r = requests.get(f"{BASE_URL}/api/banners?all=true", headers=_h(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "auto" in data and "manual" in data
    a = next((b for b in data["auto"] if b.get("id") == auto_id), None)
    assert a is not None, f"admin all=true missing hidden auto {auto_id}"
    assert a["enabled"] is False
    # re-enable
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={"show_in_slider": True}, headers=_h(admin_token))
    assert r.status_code == 200


def test_slider_patch_headline_tagline(created_campaign, admin_token, customer_token):
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={"banner_headline": "Custom Head", "banner_tagline": "Custom tag"},
                       headers=_h(admin_token))
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    a = next(b for b in r.json() if b.get("id") == auto_id)
    assert a["title"] == "Custom Head"
    assert a["subtitle"] == "Custom tag"


def test_slider_order_respected(created_campaign, admin_token, customer_token):
    """Set new campaign order=1 vs axis order=2, verify order."""
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    # our campaign order=1
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={"slider_order": 1}, headers=_h(admin_token))
    assert r.status_code == 200
    # axis order=2
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{AXIS_CID}/slider",
                       json={"slider_order": 2}, headers=_h(admin_token))
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    auto_only = [b for b in r.json() if b.get("auto")]
    ids_ordered = [b["id"] for b in auto_only]
    assert ids_ordered.index(auto_id) < ids_ordered.index(f"auto-{AXIS_CID}"), \
        f"order not respected: {ids_ordered}"
    # restore axis to slider_order 1 (per agent note)
    requests.patch(f"{BASE_URL}/api/admin/campaigns/{AXIS_CID}/slider",
                   json={"slider_order": 1}, headers=_h(admin_token))


def test_slider_patch_non_admin_403(created_campaign, customer_token):
    cid = CREATED["cid"]
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={"show_in_slider": True}, headers=_h(customer_token))
    assert r.status_code == 403, f"expected 403, got {r.status_code}"


def test_slider_patch_empty_body_400(created_campaign, admin_token):
    cid = CREATED["cid"]
    r = requests.patch(f"{BASE_URL}/api/admin/campaigns/{cid}/slider",
                       json={}, headers=_h(admin_token))
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"


def test_delete_removes_auto_banner(created_campaign, admin_token, customer_token):
    """Run last: archive campaign and check it disappears."""
    cid = CREATED["cid"]
    auto_id = f"auto-{cid}"
    r = requests.delete(f"{BASE_URL}/api/campaigns/{cid}", headers=_h(admin_token))
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/banners", headers=_h(customer_token))
    ids = [b.get("id") for b in r.json()]
    assert auto_id not in ids
