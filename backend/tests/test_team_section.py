"""Tests for admin-editable Team Photos homepage section."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASS = "Radhika@2023"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS, "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_public_no_auth():
    r = requests.get(f"{API}/team/public")
    assert r.status_code == 200
    data = r.json()
    for k in ("visible", "eyebrow", "heading", "description", "photos"):
        assert k in data
    assert isinstance(data["photos"], list)


def test_admin_get_requires_auth():
    r = requests.get(f"{API}/admin/team")
    assert r.status_code in (401, 403)


def test_admin_put_requires_auth():
    r = requests.put(f"{API}/admin/team", json={"heading": "Hack", "photos": []})
    assert r.status_code in (401, 403)


def test_admin_get(admin_headers):
    r = requests.get(f"{API}/admin/team", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert "heading" in data
    assert isinstance(data["photos"], list)


def test_visible_true_empty_photos_rejected(admin_headers):
    r = requests.put(
        f"{API}/admin/team",
        headers=admin_headers,
        json={"visible": True, "eyebrow": "Our People", "heading": "T", "description": "", "photos": []},
    )
    assert r.status_code == 400


def test_update_persists_and_public_reads(admin_headers):
    # Save a modified team
    payload = {
        "visible": True,
        "eyebrow": "Our People",
        "heading": "Hamari Team TEST",
        "description": "Testing team section",
        "photos": [
            {"url": "/images/team-1.jpeg", "caption": "Captain"},
            {"url": "/images/team-2.jpeg", "caption": ""},
            {"url": "/images/team-3.jpeg", "caption": "Finance"},
        ],
    }
    r = requests.put(f"{API}/admin/team", headers=admin_headers, json=payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["heading"] == "Hamari Team TEST"
    assert len(body["photos"]) == 3
    assert body["photos"][0]["caption"] == "Captain"

    # Public reads should reflect it
    pub = requests.get(f"{API}/team/public").json()
    assert pub["heading"] == "Hamari Team TEST"
    assert len(pub["photos"]) == 3
    assert pub["photos"][0]["caption"] == "Captain"


def test_hide_section(admin_headers):
    # Hidden with empty photos should be allowed
    r = requests.put(
        f"{API}/admin/team",
        headers=admin_headers,
        json={"visible": False, "eyebrow": "", "heading": "Hidden", "description": "", "photos": []},
    )
    assert r.status_code == 200, r.text
    pub = requests.get(f"{API}/team/public").json()
    assert pub["visible"] is False


def test_max_photos_limit(admin_headers):
    photos = [{"url": f"/images/team-{i%4 + 1}.jpeg", "caption": ""} for i in range(13)]
    r = requests.put(
        f"{API}/admin/team",
        headers=admin_headers,
        json={"visible": True, "eyebrow": "", "heading": "X", "description": "", "photos": photos},
    )
    assert r.status_code in (400, 422)


def test_cleanup_restore_defaults(admin_headers):
    # Restore via setting visible True with defaults — not possible via API without photos.
    # Instead, use a reasonable "default-like" setup via API, and rely on mongosh delete afterward.
    payload = {
        "visible": True,
        "eyebrow": "Our People",
        "heading": "Radhika Traders Team",
        "description": "The team behind every campaign, payout and celebration at our Agar (M.P.) office.",
        "photos": [{"url": f"/images/team-{i}.jpeg", "caption": ""} for i in range(1, 5)],
    }
    r = requests.put(f"{API}/admin/team", headers=admin_headers, json=payload)
    assert r.status_code == 200
