# About page content (leadership profiles + mission/vision) — admin-editable
import os
import copy
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOKEN = open("/tmp/jwt").read().strip()
H = {"Authorization": f"Bearer {TOKEN}"}
FOUNDER = "founder-harish-bhati"


def default_doc():
    r = requests.get(f"{BASE_URL}/api/admin/about", headers=H)
    d = r.json()
    return {"profiles": d["profiles"], "mission": d["mission"], "vision": d["vision"]}


@pytest.fixture(scope="module")
def original():
    d = default_doc()
    yield copy.deepcopy(d)
    # RESTORE: founder + Radha visible, mission & vision visible
    for p in d["profiles"]:
        p["visible"] = True
    d["profiles"] = [p for p in d["profiles"] if p["id"] in (FOUNDER, "radha-rajput")]
    d["mission"]["visible"] = True
    d["vision"]["visible"] = True
    r = requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d)
    assert r.status_code == 200


# Public endpoint
def test_public_no_auth():
    r = requests.get(f"{BASE_URL}/api/about/public")
    assert r.status_code == 200
    d = r.json()
    assert d["profiles"][0]["id"] == FOUNDER
    assert d["profiles"][0]["title"] == "Owner & Founder"
    radha = [p for p in d["profiles"] if p["name"] == "Radha Rajput"]
    assert radha and radha[0]["title"] == "Head of Operations & Management"
    assert d["mission"]["title"] and d["vision"]["title"]


# Auth required
def test_admin_requires_auth():
    assert requests.get(f"{BASE_URL}/api/admin/about").status_code == 401
    assert requests.put(f"{BASE_URL}/api/admin/about", json={}).status_code == 401


def test_admin_get(original):
    assert any(p["id"] == FOUNDER and p["locked"] for p in original["profiles"])


# Founder protection
def test_put_missing_founder_400(original):
    d = copy.deepcopy(original)
    d["profiles"] = [p for p in d["profiles"] if p["id"] != FOUNDER]
    r = requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d)
    assert r.status_code == 400
    assert "Founder" in r.json()["detail"]


def test_put_validation_422(original):
    d = copy.deepcopy(original)
    d["profiles"][1]["name"] = ""
    r = requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d)
    assert r.status_code == 422


# Save / hide / new id / mission hidden
def test_put_save_hide_and_new_id(original):
    d = copy.deepcopy(original)
    d["profiles"].append({"id": "", "name": "TEST_Leader", "title": "TEST_Title", "bio": "TEST bio", "visible": True})
    d["profiles"][1]["visible"] = False  # hide Radha
    d["mission"]["visible"] = False
    r = requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["ok"] is True and out["updated_at"] and "updated_by" in out
    new = [p for p in out["profiles"] if p["name"] == "TEST_Leader"][0]
    assert len(new["id"]) == 12 and new["locked"] is False
    pub = requests.get(f"{BASE_URL}/api/about/public").json()
    names = [p["name"] for p in pub["profiles"]]
    assert "Radha Rajput" not in names and "TEST_Leader" in names
    assert pub["mission"] is None and pub["vision"] is not None


def test_founder_lock_cannot_be_spoofed(original):
    d = copy.deepcopy(original)
    d["profiles"][1]["locked"] = True
    d["profiles"][0]["locked"] = False
    out = requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d).json()
    f = [p for p in out["profiles"] if p["id"] == FOUNDER][0]
    r = [p for p in out["profiles"] if p["id"] == "radha-rajput"][0]
    assert f["locked"] is True and r["locked"] is False


def test_founder_hidden(original):
    d = copy.deepcopy(original)
    d["profiles"][0]["visible"] = False
    assert requests.put(f"{BASE_URL}/api/admin/about", headers=H, json=d).status_code == 200
    pub = requests.get(f"{BASE_URL}/api/about/public").json()
    assert all(p["id"] != FOUNDER for p in pub["profiles"])
