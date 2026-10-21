# Global Search (GET /api/search) — role scoping, paging, validation, isolation
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
S = f"{BASE_URL}/api/search"
FORBIDDEN = ["password_hash", "otp", "bank", "pan", "kyc", "aadhaar", "ifsc", "account_number", "token_version"]


def _login(url, payload):
    r = requests.post(url, json=payload, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"login failed {url}: {r.status_code} {r.text[:200]}")
    d = r.json()
    return d.get("token") or d.get("access_token")


@pytest.fixture(scope="module")
def admin():
    return {"Authorization": "Bearer " + _login(f"{BASE_URL}/api/auth/login", {"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})}


@pytest.fixture(scope="module")
def emp():
    return {"Authorization": "Bearer " + _login(f"{BASE_URL}/api/auth/employee/login", {"username": "rahul.k", "password": "Emp@1234"})}


@pytest.fixture(scope="module")
def cust():
    return {"Authorization": "Bearer " + _login(f"{BASE_URL}/api/auth/login", {"email": "testcust@example.com", "password": "Test@1234"})}


def g(h, q, **kw):
    r = requests.get(S, headers=h, params={"q": q, **kw}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def keys(d):
    return {x["key"] for x in d["groups"]}


def grp(d, k):
    return next((x for x in d["groups"] if x["key"] == k), None)


# --- validation ---
def test_anon_401():
    assert requests.get(S, params={"q": "test"}).status_code == 401


def test_one_char_empty(admin):
    assert g(admin, "t")["groups"] == []


def test_too_long_422(admin):
    assert requests.get(S, headers=admin, params={"q": "a" * 81}).status_code == 422


# --- admin ---
def test_admin_test_groups_and_shape(admin):
    d = g(admin, "test")
    ks = keys(d)
    print("admin test groups", {x["key"]: x["total"] for x in d["groups"]})
    assert {"customers", "leads", "withdrawals", "transactions"} <= ks
    for gr in d["groups"]:
        assert gr["total"] >= len(gr["items"])
        for it in gr["items"]:
            for f in ("id", "title", "subtitle", "badge", "tone", "link"):
                assert f in it
    blob = json.dumps(d).lower()
    for f in FORBIDDEN:
        assert f'"{f}' not in blob, f


def test_admin_numeric_500(admin):
    d = g(admin, "500")
    c = grp(d, "campaigns")
    t = grp(d, "transactions")
    assert c and any("500" in i["subtitle"] for i in c["items"])
    assert t and any("500" in i["title"] for i in t["items"])


def test_admin_rahul_employee(admin):
    e = grp(g(admin, "rahul"), "employees")
    assert e and e["items"]
    assert all(i["link"].startswith("/admin/employees?highlight=") for i in e["items"])


def test_admin_group_paging(admin):
    d = g(admin, "test", group="transactions", limit=50)
    assert keys(d) == {"transactions"}
    t = d["groups"][0]
    assert len(t["items"]) == min(50, t["total"])
    d2 = g(admin, "test", group="transactions", limit=50, skip=1)
    assert len(d2["groups"][0]["items"]) == len(t["items"]) - (1 if t["total"] <= 50 else 0)
    assert d2["groups"][0]["items"][0]["id"] == t["items"][1]["id"]


# --- employee gating ---
def test_employee_test_gating(emp):
    ks = keys(g(emp, "test"))
    print("emp groups", ks)
    assert ks <= {"customers", "leads", "withdrawals"}
    assert ks


def test_employee_500_gating(emp):
    ks = keys(g(emp, "500"))
    assert not ks & {"campaigns", "transactions", "employees", "reports"}


def test_employee_forced_group(emp):
    for k in ("employees", "campaigns", "transactions", "reports"):
        assert g(emp, "test", group=k)["groups"] == [], k


# --- customer isolation ---
@pytest.fixture(scope="module")
def own(cust):
    ld = requests.get(f"{BASE_URL}/api/my-leads", headers=cust).json()
    tx = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=cust).json()
    wd = requests.get(f"{BASE_URL}/api/withdrawals", headers=cust).json()
    def ids(x):
        x = x if isinstance(x, list) else (x.get("items") or x.get("leads") or x.get("transactions") or x.get("withdrawals") or [])
        return {str(i.get("id") or i.get("_id")) for i in x}, {i.get("lead_id") for i in x}
    return {"leads": ids(ld), "tx": ids(tx)[0], "wd": ids(wd)[0]}


def test_customer_sip(cust, own):
    d = g(cust, "sip")
    c, l = grp(d, "campaigns"), grp(d, "leads")
    assert c and all(i["link"].startswith("/campaign/") for i in c["items"])
    assert l and l["items"]
    for i in l["items"]:
        assert i["link"].startswith("/app/my-leads?q=LD-")
        lid = i["link"].split("q=")[1]
        assert lid in own["leads"][1], lid


def test_customer_bonus(cust, own):
    t = grp(g(cust, "bonus"), "transactions")
    assert t and t["items"]
    for i in t["items"]:
        assert i["link"] == f"/app/wallet?highlight={i['id']}"
        assert i["id"] in own["tx"], i["id"]


def test_customer_harish_no_users(cust):
    assert not keys(g(cust, "harish")) & {"customers", "employees"}


def test_customer_100_withdrawals(cust, own):
    w = grp(g(cust, "100"), "withdrawals")
    assert w and w["items"]
    for i in w["items"]:
        assert i["link"] == f"/app/withdrawals?highlight={i['id']}"
        assert i["id"] in own["wd"], i["id"]


def test_customer_forced_staff_group(cust):
    for k in ("customers", "employees"):
        assert g(cust, "test", group=k)["groups"] == []
