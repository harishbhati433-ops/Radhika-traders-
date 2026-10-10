"""Tests for User Unique ID (token) passing feature on campaigns & leads."""
import os
import re
import random
import io
import csv
import pytest
import requests
from dotenv import dotenv_values

_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _env.get("REACT_APP_BACKEND_URL")).rstrip("/")
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"
CUSTOMER_EMAIL = "testcust@example.com"
CUSTOMER_PASSWORD = "Test@1234"
CAMPAIGN_SLUG = "axis-mutual-fund-sip"
REF_CODE = "RTA12499"

UA = {"User-Agent": "Mozilla/5.0 (QA-Test)"}
TOKEN_RE = re.compile(r"^RT-[A-Z2-9]{8}$")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"},
                      headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {**UA, "Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD, "portal": "customer"},
                      headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def campaign(admin_headers):
    r = requests.get(f"{BASE_URL}/api/campaigns", headers=UA, timeout=30)
    assert r.status_code == 200
    camps = r.json()
    camp = next((c for c in camps if c.get("slug") == CAMPAIGN_SLUG), None)
    assert camp is not None, f"Campaign {CAMPAIGN_SLUG} not found"
    return camp


def _get_campaign_full(admin_headers, cid):
    r = requests.get(f"{BASE_URL}/api/campaigns/{cid}", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _put_campaign(admin_headers, cid, data):
    r = requests.put(f"{BASE_URL}/api/campaigns/{cid}", headers=admin_headers, json=data, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _toggle_token(admin_headers, cid, on, param="user_id"):
    full = _get_campaign_full(admin_headers, cid)
    # Build payload with required fields; preserve all existing
    payload = {k: v for k, v in full.items() if k not in ("id", "_id", "created_at", "updated_at")}
    payload["token_passing"] = on
    payload["token_param"] = param
    return _put_campaign(admin_headers, cid, payload)


def test_admin_login(admin_token):
    assert admin_token


def test_toggle_token_on(admin_headers, campaign):
    cid = campaign["id"]
    _toggle_token(admin_headers, cid, True, "sub_id")
    full = _get_campaign_full(admin_headers, cid)
    assert full.get("token_passing") is True
    assert full.get("token_param") == "sub_id"


def test_submit_lead_with_token_on(admin_headers, campaign):
    cid = campaign["id"]
    _toggle_token(admin_headers, cid, True, "sub_id")
    mobile1 = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
    email1 = f"qa_token_{random.randint(10000,99999)}@x.com"
    r = requests.post(f"{BASE_URL}/api/leads/{CAMPAIGN_SLUG}",
                      json={"ref": REF_CODE, "data": {"name": "QA Token", "mobile": mobile1, "email": email1}},
                      headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("lead_id", "").startswith("LD-")
    tok1 = body.get("token")
    assert tok1 and TOKEN_RE.match(tok1), f"bad token {tok1}"
    assert body.get("redirect_url") and f"sub_id={tok1}" in body["redirect_url"]

    # 2nd submission different token
    mobile2 = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
    email2 = f"qa_token_{random.randint(10000,99999)}@x.com"
    r2 = requests.post(f"{BASE_URL}/api/leads/{CAMPAIGN_SLUG}",
                       json={"ref": REF_CODE, "data": {"name": "QA Token", "mobile": mobile2, "email": email2}},
                       headers=UA, timeout=30)
    assert r2.status_code == 200, r2.text
    tok2 = r2.json().get("token")
    assert tok2 and TOKEN_RE.match(tok2)
    assert tok1 != tok2
    pytest.saved_tokens = [tok1, tok2]


def test_submit_lead_with_token_off(admin_headers, campaign):
    cid = campaign["id"]
    _toggle_token(admin_headers, cid, False, "user_id")
    mobile = "9" + "".join(str(random.randint(0, 9)) for _ in range(9))
    email = f"qa_token_off_{random.randint(10000,99999)}@x.com"
    r = requests.post(f"{BASE_URL}/api/leads/{CAMPAIGN_SLUG}",
                      json={"ref": REF_CODE, "data": {"name": "QA Token", "mobile": mobile, "email": email}},
                      headers=UA, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    tok = body.get("token")
    assert tok and TOKEN_RE.match(tok), f"token missing with OFF: {body}"
    ru = body.get("redirect_url") or ""
    assert "sub_id=" not in ru and "user_id=RT-" not in ru, f"token leaked: {ru}"


def test_export_csv_has_user_unique_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/leads/export",
                     params={"format": "csv", "search": "QA Token"},
                     headers=admin_headers, timeout=60)
    assert r.status_code == 200, r.text
    text = r.text
    first_line = text.splitlines()[0]
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    header = rows[0]
    assert header[0] == "Lead ID"
    assert header[1] == "User Unique ID", f"header: {header}"
    # at least one data row contains an RT- token
    data_rows = rows[1:]
    assert any(TOKEN_RE.match((r_[1] or "").strip()) for r_ in data_rows if len(r_) > 1), f"no RT- token in csv rows (sample={data_rows[:2]})"


def test_export_xlsx_has_user_unique_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/admin/leads/export",
                     params={"format": "xlsx", "search": "QA Token"},
                     headers=admin_headers, timeout=60)
    assert r.status_code == 200
    assert r.content[:2] == b"PK", "not a valid xlsx (zip) file"
    try:
        from openpyxl import load_workbook
    except ImportError:
        pytest.skip("openpyxl not installed")
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb.active
    headers = [c.value for c in ws[1]]
    assert headers[0] == "Lead ID"
    assert headers[1] == "User Unique ID", f"xlsx header: {headers}"


def test_admin_search_by_token(admin_headers):
    toks = getattr(pytest, "saved_tokens", [])
    if not toks:
        pytest.skip("no saved tokens from previous test")
    tok = toks[0]
    r = requests.get(f"{BASE_URL}/api/admin/leads",
                     params={"search": tok}, headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert items and any((it.get("token") == tok) for it in items), f"token not found in search: {body}"


def test_customer_my_leads_has_token(customer_token):
    headers = {**UA, "Authorization": f"Bearer {customer_token}"}
    r = requests.get(f"{BASE_URL}/api/my-leads", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    # Not all customers may have leads; just assert the field is present on items when present
    if items:
        for it in items:
            assert "token" in it, f"token field missing: {it.keys()}"


def test_cleanup_reset_campaign(admin_headers, campaign):
    cid = campaign["id"]
    _toggle_token(admin_headers, cid, False, "user_id")
    full = _get_campaign_full(admin_headers, cid)
    assert full.get("token_passing") is False
    assert full.get("token_param") == "user_id"
