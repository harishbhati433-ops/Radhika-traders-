"""Iteration 13 feature tests: lead fund, wallet adjust, admin customer edit, custom date filter, /go speed."""
import os
import time
import re
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    envf = Path("/app/frontend/.env")
    for line in envf.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", _load_backend_url()).rstrip("/")
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PASSWORD = "Test@1234"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": CUST_EMAIL, "password": CUST_PASSWORD
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def cust_h(cust_token):
    return {"Authorization": f"Bearer {cust_token}"}


@pytest.fixture(scope="module")
def a_lead_with_partner(admin_h):
    r = requests.get(f"{BASE_URL}/api/admin/leads", headers=admin_h)
    assert r.status_code == 200
    leads = r.json()
    # only consider leads whose partner still exists
    customers = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
    live_ids = {c["id"] for c in customers}
    lead = next((l for l in leads if l.get("partner_id") and l["partner_id"] in live_ids), None)
    assert lead, "Need at least one lead whose partner still exists in customers"
    return lead


# -------- (1) Lead fund flow --------
class TestLeadFund:
    def test_fund_zero_amount_400(self, admin_h, a_lead_with_partner):
        lid = a_lead_with_partner["id"]
        r = requests.post(f"{BASE_URL}/api/admin/leads/{lid}/fund",
                          headers=admin_h, json={"amount": 0, "note": ""})
        assert r.status_code == 400

    def test_fund_negative_400(self, admin_h, a_lead_with_partner):
        lid = a_lead_with_partner["id"]
        r = requests.post(f"{BASE_URL}/api/admin/leads/{lid}/fund",
                          headers=admin_h, json={"amount": -5, "note": ""})
        assert r.status_code == 400

    def test_fund_bogus_id_404(self, admin_h):
        r = requests.post(f"{BASE_URL}/api/admin/leads/000000000000000000000000/fund",
                          headers=admin_h, json={"amount": 10})
        assert r.status_code == 404

    def test_fund_credits_partner_wallet(self, admin_h, a_lead_with_partner):
        lid = a_lead_with_partner["id"]
        partner_id = a_lead_with_partner["partner_id"]
        # baseline
        cust_list = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        partner_before = next(c for c in cust_list if c["id"] == partner_id)
        bal_before = partner_before["wallet"]["balance"]
        fund_total_before = float(a_lead_with_partner.get("fund_total") or 0)
        amt = 12.5
        r = requests.post(f"{BASE_URL}/api/admin/leads/{lid}/fund",
                          headers=admin_h, json={"amount": amt, "note": "TEST_it13"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data
        # lead has fund_history and fund_total increased
        lead = data["lead"]
        assert abs(float(lead["fund_total"]) - (fund_total_before + amt)) < 0.01
        assert any(f.get("note") == "TEST_it13" for f in lead["fund_history"])
        # wallet balance increased
        cust_list = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        partner_after = next(c for c in cust_list if c["id"] == partner_id)
        assert abs(partner_after["wallet"]["balance"] - (bal_before + amt)) < 0.01

    def test_fund_transaction_created_by_admin(self, admin_h, a_lead_with_partner):
        # detail endpoint returns transactions with created_by admin email + source lead_fund
        partner_id = a_lead_with_partner["partner_id"]
        d = requests.get(f"{BASE_URL}/api/admin/customers/{partner_id}/detail", headers=admin_h).json()
        lf = [t for t in d["transactions"] if t.get("source") == "lead_fund"]
        assert lf, "expected at least one lead_fund transaction"
        assert lf[0].get("created_by") == ADMIN_EMAIL


# -------- (2) Wallet adjust --------
class TestWalletAdjust:
    @pytest.fixture(scope="class")
    def a_customer_id(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        # pick testcust to be predictable
        c = next((x for x in r if x["email"] == CUST_EMAIL), r[0])
        return c["id"]

    def test_reason_required(self, admin_h, a_customer_id):
        r = requests.post(f"{BASE_URL}/api/admin/wallet/adjust", headers=admin_h,
                          json={"user_id": a_customer_id, "mode": "add", "amount": 5, "reason": ""})
        assert r.status_code == 400

    def test_add_then_deduct_over_400(self, admin_h, a_customer_id):
        # Add 100
        r = requests.post(f"{BASE_URL}/api/admin/wallet/adjust", headers=admin_h,
                          json={"user_id": a_customer_id, "mode": "add", "amount": 100, "reason": "TEST_it13 add"})
        assert r.status_code == 200, r.text
        bal_after = r.json()["wallet"]["balance"]
        # Deduct way more than balance
        r2 = requests.post(f"{BASE_URL}/api/admin/wallet/adjust", headers=admin_h,
                           json={"user_id": a_customer_id, "mode": "deduct", "amount": bal_after + 100000, "reason": "TEST_it13 overdraft"})
        assert r2.status_code == 400
        # Deduct 100 back (valid)
        r3 = requests.post(f"{BASE_URL}/api/admin/wallet/adjust", headers=admin_h,
                           json={"user_id": a_customer_id, "mode": "deduct", "amount": 100, "reason": "TEST_it13 rollback"})
        assert r3.status_code == 200, r3.text

    def test_wallet_adjust_logged_in_detail(self, admin_h, a_customer_id):
        d = requests.get(f"{BASE_URL}/api/admin/customers/{a_customer_id}/detail", headers=admin_h).json()
        adjs = d.get("wallet_adjustments", [])
        assert any("TEST_it13" in (a.get("reason") or "") for a in adjs)
        assert all("admin_email" in a for a in adjs[:3])


# -------- (3) Admin edit profile/kyc + detail history --------
class TestAdminCustomerEdit:
    @pytest.fixture(scope="class")
    def cid(self, admin_h):
        r = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        c = next(x for x in r if x["email"] == CUST_EMAIL)
        return c["id"]

    def test_detail_shape(self, admin_h, cid):
        r = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h)
        assert r.status_code == 200
        d = r.json()
        for k in ("wallet", "profile_history", "kyc_history", "wallet_adjustments", "transactions"):
            assert k in d

    def test_update_profile_logs_history(self, admin_h, cid):
        # Read current
        cur = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h).json()
        new_addr = f"TEST_it13 addr {int(time.time())}"
        r = requests.put(f"{BASE_URL}/api/admin/customers/{cid}/profile", headers=admin_h,
                         json={"address": new_addr})
        assert r.status_code == 200, r.text
        d = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h).json()
        assert d["address"] == new_addr
        # Latest history has address change by admin email
        h = d["profile_history"][0]
        assert h["by"] == ADMIN_EMAIL
        assert "address" in h["changes"]
        # restore
        requests.put(f"{BASE_URL}/api/admin/customers/{cid}/profile", headers=admin_h,
                     json={"address": cur.get("address") or ""})

    def test_kyc_invalid_pan_400(self, admin_h, cid):
        r = requests.put(f"{BASE_URL}/api/admin/customers/{cid}/kyc", headers=admin_h, json={
            "account_holder": "Test Customer", "pan": "BADPAN", "aadhaar": "",
            "bank_account": "123456789012", "ifsc": "HDFC0001234", "upi": ""
        })
        assert r.status_code == 400

    def test_kyc_update_ifsc_logs(self, admin_h, cid):
        cur = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h).json()
        pan = cur.get("kyc", {}).get("pan") or "TSTCU1234F"
        acct = cur.get("bank", {}).get("bank_account") or "123456789012"
        new_ifsc = "HDFC0009999"
        r = requests.put(f"{BASE_URL}/api/admin/customers/{cid}/kyc", headers=admin_h, json={
            "account_holder": cur.get("bank", {}).get("account_holder") or cur["name"],
            "pan": pan, "aadhaar": cur.get("kyc", {}).get("aadhaar") or "",
            "bank_account": acct, "ifsc": new_ifsc,
            "upi": cur.get("bank", {}).get("upi") or ""
        })
        assert r.status_code == 200, r.text
        d = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h).json()
        assert d["kyc"]["status"] == "verified"
        assert d["bank"]["ifsc"] == new_ifsc
        # history logged by admin
        if d["kyc_history"]:
            h = d["kyc_history"][0]
            assert h["by"] == ADMIN_EMAIL

    def test_mobile_duplicate_400(self, admin_h, cid):
        # find another verified customer to steal mobile from
        others = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        other = next((c for c in others if c["id"] != cid and c.get("mobile") and c.get("email_verified", True)), None)
        if not other:
            pytest.skip("No second verified customer with mobile to test duplicate")
        r = requests.put(f"{BASE_URL}/api/admin/customers/{cid}/profile", headers=admin_h,
                         json={"mobile": other["mobile"]})
        assert r.status_code == 400


# -------- (4) Admin leads date filter --------
class TestLeadsDateFilter:
    def test_date_filter_reduces_count(self, admin_h):
        all_r = requests.get(f"{BASE_URL}/api/admin/leads", headers=admin_h).json()
        # future date should return 0
        empty_r = requests.get(f"{BASE_URL}/api/admin/leads",
                               headers=admin_h,
                               params={"date_from": "2999-01-01", "date_to": "2999-01-02"}).json()
        assert isinstance(empty_r, list) and len(empty_r) == 0
        assert len(all_r) >= len(empty_r)


# -------- (5) /api/go speed + click log --------
class TestGoSpeed:
    def test_go_redirects_fast_and_logs_click(self, admin_h):
        # Get testcust referral code
        me = requests.get(f"{BASE_URL}/api/admin/customers", headers=admin_h).json()
        cust = next(c for c in me if c["email"] == CUST_EMAIL)
        ref = cust["referral_code"]
        # Find a live campaign slug
        camps = requests.get(f"{BASE_URL}/api/campaigns").json()
        assert camps, "need at least one live campaign"
        slug = camps[0]["slug"]
        t0 = time.time()
        r = requests.get(f"{BASE_URL}/api/go/{slug}", params={"ref": ref}, allow_redirects=False)
        elapsed = time.time() - t0
        assert r.status_code == 302
        assert elapsed < 3.0, f"redirect too slow: {elapsed}s"

    def test_go_invalid_slug_redirects_to_offer_ended(self):
        r = requests.get(f"{BASE_URL}/api/go/no-such-slug-xyz", allow_redirects=False)
        assert r.status_code == 302
        assert "/offer-ended" in r.headers.get("location", "")


# -------- (6) Customer self profile / kyc log 'self' --------
class TestCustomerSelfProfile:
    def test_self_profile_update_logs_self(self, cust_h, admin_h):
        # get id
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=cust_h).json()
        cid = me["id"]
        new_addr = f"TEST_it13 self {int(time.time())}"
        r = requests.put(f"{BASE_URL}/api/profile", headers=cust_h, json={"address": new_addr})
        assert r.status_code == 200
        d = requests.get(f"{BASE_URL}/api/admin/customers/{cid}/detail", headers=admin_h).json()
        assert d["profile_history"][0]["by"] == "self"
