"""
Radhika Traders — Backend regression tests
Covers: auth (admin+customer), campaigns CRUD, categories, wallet,
withdrawals+KYC, statements, uploads, data isolation.
"""
import os
import re
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"


# ---------- helpers ----------
def _grep_otp(email: str, purpose: str = "signup", wait: float = 3.0) -> str | None:
    """Grep backend supervisor logs for [OTP <purpose>] <email> -> <code>"""
    deadline = time.time() + wait
    pattern = re.compile(rf"\[OTP {re.escape(purpose)}\] {re.escape(email)} -> (\d+)")
    while time.time() < deadline:
        try:
            out = subprocess.run(
                ["bash", "-lc", "tail -n 400 /var/log/supervisor/backend.*.log 2>/dev/null"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            matches = pattern.findall(out)
            if matches:
                return matches[-1]
        except Exception:
            pass
        time.sleep(0.5)
    return None


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    assert isinstance(data["token"], str) and len(data["token"]) > 20
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer():
    """Register+verify a fresh customer, return dict(email,password,token,id)."""
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "Passw0rd!"
    r = requests.post(f"{API}/auth/register", json={
        "name": "Test User", "email": email, "mobile": "9999999999", "password": password
    })
    assert r.status_code == 200, r.text
    code = _grep_otp(email, "signup", wait=4)
    assert code, f"OTP for {email} not found in logs"
    v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
    assert v.status_code == 200, v.text
    data = v.json()
    return {"email": email, "password": password, "token": data["token"], "id": data["user"]["id"]}


@pytest.fixture(scope="session")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert admin_token

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong", "portal": "admin"})
        assert r.status_code == 401

    def test_login_before_verify_blocked(self):
        email = f"unverif_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "X", "email": email, "mobile": "1", "password": "Passw0rd!"
        })
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        assert r.status_code == 403

    def test_me(self, cust_headers, customer):
        r = requests.get(f"{API}/auth/me", headers=cust_headers)
        assert r.status_code == 200
        assert r.json()["email"] == customer["email"]
        assert r.json()["email_verified"] is True

    def test_forgot_reset_password(self, customer):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]})
        assert r.status_code == 200
        code = _grep_otp(customer["email"], "reset", wait=4)
        assert code, "reset OTP not found"
        new_pw = "NewPass1!"
        r2 = requests.post(f"{API}/auth/reset-password", json={
            "email": customer["email"], "code": code, "new_password": new_pw
        })
        assert r2.status_code == 200
        # verify old fails, new works
        assert requests.post(f"{API}/auth/login", json={"email": customer["email"], "password": customer["password"]}).status_code == 401
        r3 = requests.post(f"{API}/auth/login", json={"email": customer["email"], "password": new_pw})
        assert r3.status_code == 200
        customer["password"] = new_pw
        customer["token"] = r3.json()["token"]


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard(self, admin_headers):
        r = requests.get(f"{API}/admin/dashboard", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_campaigns", "live", "paused", "closed", "total_customers",
                  "total_wallet_balance", "withdrawals_total"]:
            assert k in d

    def test_customer_cannot_access_admin(self, cust_headers):
        r = requests.get(f"{API}/admin/dashboard", headers=cust_headers)
        assert r.status_code == 403


# ---------- Campaigns ----------
class TestCampaigns:
    def test_public_list_filters_enabled(self):
        r = requests.get(f"{API}/campaigns")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        for c in items:
            assert c.get("offer_enabled") is True
            assert c.get("status") != "closed"

    def test_search_and_filter(self):
        items = requests.get(f"{API}/campaigns").json()
        if not items:
            pytest.skip("no seeded campaigns")
        needle = items[0]["offer_name"].split()[0]
        r = requests.get(f"{API}/campaigns", params={"search": needle})
        assert r.status_code == 200
        assert any(needle in c["offer_name"] for c in r.json())
        r2 = requests.get(f"{API}/campaigns", params={"category": "Demat"})
        assert all(c["category"] == "Demat" for c in r2.json())
        r3 = requests.get(f"{API}/campaigns", params={"campaign_type": "First Trade"})
        assert all(c["campaign_type"] == "First Trade" for c in r3.json())

    def test_slug_endpoint(self):
        # Use a seeded campaign slug
        items = requests.get(f"{API}/campaigns").json()
        slug = items[0]["slug"]
        r = requests.get(f"{API}/campaigns/slug/{slug}")
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_full_campaign_crud(self, admin_headers):
        # CREATE
        payload = {"offer_name": f"TEST_Offer_{uuid.uuid4().hex[:6]}", "company": "Acme",
                   "category": "Demat", "payout_amount": 200, "campaign_type": "First Trade",
                   "status": "live", "offer_enabled": True}
        r = requests.post(f"{API}/campaigns", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        c = r.json()
        cid = c["id"]
        assert c["offer_name"] == payload["offer_name"]
        assert c["slug"]
        # GET by id
        assert requests.get(f"{API}/campaigns/{cid}").status_code == 200
        # UPDATE
        payload["payout_amount"] = 500
        r2 = requests.put(f"{API}/campaigns/{cid}", json=payload, headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["payout_amount"] == 500
        # PATCH status
        r3 = requests.patch(f"{API}/campaigns/{cid}/status", params={"status": "paused"}, headers=admin_headers)
        assert r3.status_code == 200
        assert requests.get(f"{API}/campaigns/{cid}").json()["status"] == "paused"
        # toggle offer
        r4 = requests.patch(f"{API}/campaigns/{cid}/toggle-offer", params={"enabled": False}, headers=admin_headers)
        assert r4.status_code == 200
        # should not appear in public listing
        pub_ids = [x["id"] for x in requests.get(f"{API}/campaigns").json()]
        assert cid not in pub_ids
        # archive
        r5 = requests.delete(f"{API}/campaigns/{cid}", headers=admin_headers)
        assert r5.status_code == 200
        archived_ids = [x["id"] for x in requests.get(f"{API}/campaigns/archived", headers=admin_headers).json()]
        assert cid in archived_ids
        # restore
        r6 = requests.post(f"{API}/campaigns/{cid}/restore", headers=admin_headers)
        assert r6.status_code == 200
        # cleanup archive
        requests.delete(f"{API}/campaigns/{cid}", headers=admin_headers)

    def test_archived_requires_admin(self):
        assert requests.get(f"{API}/campaigns/archived").status_code in (401, 403)


# ---------- Categories ----------
class TestCategories:
    def test_category_crud(self, admin_headers):
        name = f"TEST_Cat_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/categories", json={"name": name, "enabled": True}, headers=admin_headers)
        assert r.status_code == 200
        cid = r.json()["id"]
        # update disable
        r2 = requests.put(f"{API}/categories/{cid}", json={"enabled": False}, headers=admin_headers)
        assert r2.status_code == 200 and r2.json()["enabled"] is False
        # not in public list
        names = [c["name"] for c in requests.get(f"{API}/categories").json()]
        assert name not in names
        # in admin all list
        names_all = [c["name"] for c in requests.get(f"{API}/categories", params={"all": True}).json()]
        assert name in names_all
        # delete soft
        r3 = requests.delete(f"{API}/categories/{cid}", headers=admin_headers)
        assert r3.status_code == 200


# ---------- Wallet + Withdrawals ----------
class TestWalletAndWithdrawals:
    def test_wallet_initial(self, cust_headers):
        r = requests.get(f"{API}/wallet", headers=cust_headers)
        assert r.status_code == 200
        assert r.json()["balance"] == 0

    def test_admin_credit_and_wallet(self, admin_headers, cust_headers, customer):
        r = requests.post(f"{API}/admin/credit", json={
            "user_id": customer["id"], "amount": 500, "description": "test credit"
        }, headers=admin_headers)
        assert r.status_code == 200
        w = requests.get(f"{API}/wallet", headers=cust_headers).json()
        assert w["balance"] == 500
        assert w["total_earnings"] == 500
        txns = requests.get(f"{API}/wallet/transactions", headers=cust_headers).json()
        assert len(txns) >= 1 and txns[0]["type"] == "credit"

    def test_withdraw_requires_kyc(self, cust_headers):
        r = requests.post(f"{API}/withdrawals", json={"amount": 200, "method": "UPI", "details": "x@upi"}, headers=cust_headers)
        assert r.status_code == 400
        assert "KYC" in r.json().get("detail", "")

    def test_submit_kyc(self, cust_headers):
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": "ABCDE1234F", "aadhaar": "111122223333",
            "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "Test User", "upi": "test@upi"
        }, headers=cust_headers)
        assert r.status_code == 200
        assert r.json()["kyc"]["status"] == "pending"

    def test_withdraw_below_min_rejected(self, cust_headers):
        r = requests.post(f"{API}/withdrawals", json={"amount": 50, "method": "UPI", "details": "x@upi"}, headers=cust_headers)
        assert r.status_code == 400

    def test_withdraw_success_and_admin_flow(self, cust_headers, admin_headers, customer):
        w0 = requests.get(f"{API}/wallet", headers=cust_headers).json()
        r = requests.post(f"{API}/withdrawals", json={"amount": 200, "method": "UPI", "details": "x@upi"}, headers=cust_headers)
        assert r.status_code == 200, r.text
        wid = r.json()["id"]
        assert "_id" not in r.json()
        # wallet: pending should increase by 200, balance drop by 200
        w = requests.get(f"{API}/wallet", headers=cust_headers).json()
        assert w["pending_withdrawal"] == w0["pending_withdrawal"] + 200
        assert w["balance"] == w0["balance"] - 200
        # admin approves
        a = requests.patch(f"{API}/admin/withdrawals/{wid}", json={"status": "approved"}, headers=admin_headers)
        assert a.status_code == 200
        # admin marks paid → debit txn created; balance unchanged from approved-pending state
        p = requests.patch(f"{API}/admin/withdrawals/{wid}", json={"status": "paid"}, headers=admin_headers)
        assert p.status_code == 200
        w2 = requests.get(f"{API}/wallet", headers=cust_headers).json()
        assert w2["total_withdrawn"] == w0["total_withdrawn"] + 200
        assert w2["pending_withdrawal"] == w0["pending_withdrawal"]
        assert w2["balance"] == w0["balance"] - 200

    def test_withdraw_over_balance(self, cust_headers):
        r = requests.post(f"{API}/withdrawals", json={"amount": 999999, "method": "UPI", "details": "x@upi"}, headers=cust_headers)
        assert r.status_code == 400


# ---------- Data isolation ----------
class TestIsolation:
    def test_no_token_unauth(self):
        assert requests.get(f"{API}/wallet").status_code in (401, 403)
        assert requests.get(f"{API}/admin/customers").status_code in (401, 403)

    def test_customer_cannot_create_campaign(self, cust_headers):
        r = requests.post(f"{API}/campaigns", json={"offer_name": "x"}, headers=cust_headers)
        assert r.status_code == 403


# ---------- Statements ----------
class TestStatements:
    @pytest.mark.parametrize("fmt,ctype", [
        ("csv", "text/csv"),
        ("excel", "spreadsheetml"),
        ("pdf", "application/pdf"),
    ])
    def test_statement_formats(self, cust_headers, fmt, ctype):
        r = requests.get(f"{API}/statement", params={"format": fmt}, headers=cust_headers)
        assert r.status_code == 200
        assert ctype in r.headers.get("content-type", "")
        assert len(r.content) > 50


# ---------- Upload ----------
class TestUpload:
    def test_upload_admin_only(self, cust_headers):
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\nfake", "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 403

    def test_upload_and_serve(self, admin_headers):
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 40, "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=admin_headers)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")
        g = requests.get(f"{BASE_URL}{url}")
        assert g.status_code == 200
        assert "image" in g.headers.get("content-type", "")



# ---------- Affiliate redirect ----------
class TestAffiliate:
    def test_go_redirect_with_ref_and_click_logged(self, cust_headers):
        r = requests.get(f"{API}/go/choice-trade-test", params={"ref": "RTA12499"},
                         allow_redirects=False)
        assert r.status_code == 302
        loc = r.headers.get("location", "")
        assert loc.startswith("https://offertracking.in/"), f"Expected external primary URL, got {loc}"

    def test_go_unknown_slug_redirects_to_campaigns_list(self):
        r = requests.get(f"{API}/go/no-such-slug-xyz", allow_redirects=False)
        assert r.status_code == 302
        assert r.headers.get("location", "").endswith("/campaigns")

    def test_my_clicks_counts_referrer(self):
        # login as the seeded referrer testcust
        lr = requests.post(f"{API}/auth/login",
                           json={"email": "testcust@example.com", "password": "Test@1234"})
        if lr.status_code != 200:
            pytest.skip("seeded testcust login failed")
        tok = lr.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        # hit the redirect using the referrer's code
        requests.get(f"{API}/go/choice-trade-test", params={"ref": "RTA12499"},
                     allow_redirects=False)
        time.sleep(0.5)
        r = requests.get(f"{API}/my-clicks", headers=h)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and "by_campaign" in data
        assert data["total"] >= 1


# ---------- Withdrawal payout details / user_mobile ----------
class TestWithdrawalPayout:
    def test_upi_empty_details_autofill_from_kyc(self, admin_headers):
        # Fresh customer with bank UPI, credit, submit withdrawal with empty details
        email = f"test_wpayout_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        requests.post(f"{API}/auth/register", json={
            "name": "WPayout", "email": email, "mobile": "9998887777", "password": pw
        })
        code = _grep_otp(email, "signup", wait=5)
        assert code
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]
        uid = v.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}
        # KYC with bank UPI
        requests.put(f"{API}/profile/kyc", json={
            "pan": "AAAPZ1234K", "aadhaar": "111122223333",
            "bank_account": "50100123456789", "ifsc": "HDFC0000123",
            "account_holder": "WPayout Test", "upi": "wpayout@ybl"
        }, headers=h)
        # credit
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "test"},
                      headers=admin_headers)
        # withdraw empty details
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 150, "method": "UPI", "details": ""},
                          headers=h)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["details"] == "wpayout@ybl", f"Expected auto-fill UPI, got {data.get('details')!r}"
        assert data.get("user_mobile") == "9998887777"
        pi = data.get("payout_info") or {}
        for k in ("account_holder", "bank_account", "ifsc", "upi", "pan"):
            assert k in pi, f"payout_info missing {k}"
        assert pi["upi"] == "wpayout@ybl"
        assert pi["bank_account"] == "50100123456789"
        assert pi["pan"] == "AAAPZ1234K"


# ---------- Mark paid with proof + UTR ----------
class TestMarkPaidWithProof:
    def test_mark_paid_with_proof_and_utr(self, admin_headers):
        email = f"test_paid_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        requests.post(f"{API}/auth/register", json={
            "name": "PaidUser", "email": email, "mobile": "9998887766", "password": pw})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]; uid = v.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}
        requests.put(f"{API}/profile/kyc", json={
            "pan": "ABCPZ1234K", "bank_account": "50100999", "ifsc": "HDFC0000123",
            "account_holder": "Paid User", "upi": "paid@ybl"}, headers=h)
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "test"},
                      headers=admin_headers)
        wr = requests.post(f"{API}/withdrawals",
                           json={"amount": 200, "method": "UPI", "details": "paid@ybl"},
                           headers=h)
        wid = wr.json()["id"]
        # upload proof (admin)
        files = {"file": ("proof.png", b"\x89PNG\r\n\x1a\n" + b"0" * 40, "image/png")}
        up = requests.post(f"{API}/upload", files=files, headers=admin_headers)
        assert up.status_code == 200
        proof_url = up.json()["url"]
        # mark paid
        p = requests.patch(f"{API}/admin/withdrawals/{wid}",
                           json={"status": "paid", "proof_url": proof_url, "utr": "UTR123ABC"},
                           headers=admin_headers)
        assert p.status_code == 200
        # customer sees proof + utr
        items = requests.get(f"{API}/withdrawals", headers=h).json()
        w = next(x for x in items if x["id"] == wid)
        assert w["status"] == "paid"
        assert w["utr"] == "UTR123ABC"
        assert w["proof_url"] == proof_url


# ---------- Banners CRUD + public filter ----------
class TestBanners:
    def test_banner_crud_and_visibility(self, admin_headers, cust_headers):
        # create
        r = requests.post(f"{API}/admin/banners",
                          json={"title": "TEST_Banner", "subtitle": "sub",
                                "image_url": "/api/files/x.png", "link": "/campaigns",
                                "enabled": True, "order": 1},
                          headers=admin_headers)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        assert "_id" not in r.json()
        # customer sees enabled
        pub = requests.get(f"{API}/banners", headers=cust_headers).json()
        assert any(b["id"] == bid for b in pub)
        # disable
        r2 = requests.put(f"{API}/admin/banners/{bid}",
                          json={"title": "TEST_Banner", "subtitle": "sub",
                                "image_url": "/api/files/x.png", "link": "/campaigns",
                                "enabled": False, "order": 1},
                          headers=admin_headers)
        assert r2.status_code == 200 and r2.json()["enabled"] is False
        # customer no longer sees it
        pub2 = requests.get(f"{API}/banners", headers=cust_headers).json()
        assert not any(b["id"] == bid for b in pub2)
        # admin all=true sees it
        adm = requests.get(f"{API}/banners", params={"all": "true"}, headers=admin_headers).json()
        assert any(b["id"] == bid for b in adm)
        # delete
        d = requests.delete(f"{API}/admin/banners/{bid}", headers=admin_headers)
        assert d.status_code == 200

    def test_banner_admin_only(self, cust_headers):
        r = requests.post(f"{API}/admin/banners",
                          json={"image_url": "/x.png"}, headers=cust_headers)
        assert r.status_code == 403


# ---------- Refer & Earn ----------
class TestReferAndEarn:
    def test_settings_public_and_admin_update(self, admin_headers):
        r = requests.get(f"{API}/settings/public")
        assert r.status_code == 200
        assert "referral_bonus" in r.json()
        # set 20
        u = requests.put(f"{API}/admin/settings",
                         json={"referral_bonus": 20}, headers=admin_headers)
        assert u.status_code == 200 and float(u.json()["referral_bonus"]) == 20.0
        assert requests.get(f"{API}/settings/public").json()["referral_bonus"] == 20.0
        # negative rejected
        n = requests.put(f"{API}/admin/settings",
                         json={"referral_bonus": -1}, headers=admin_headers)
        assert n.status_code == 400

    def test_signup_with_ref_credits_referrer(self, admin_headers):
        # ensure bonus = 20
        requests.put(f"{API}/admin/settings",
                     json={"referral_bonus": 20}, headers=admin_headers)
        # get testcust wallet + referrals baseline
        lr = requests.post(f"{API}/auth/login",
                           json={"email": "testcust@example.com", "password": "Test@1234"})
        if lr.status_code != 200:
            pytest.skip("seeded testcust login failed")
        tok = lr.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        ref0 = requests.get(f"{API}/my-referrals", headers=h).json()
        # new signup referred_by=RTA12499
        email = f"test_referred_{uuid.uuid4().hex[:8]}@example.com"
        rr = requests.post(f"{API}/auth/register", json={
            "name": "Refd", "email": email, "mobile": "9000000000",
            "password": "Passw0rd!", "referred_by": "RTA12499"})
        assert rr.status_code == 200, rr.text
        code = _grep_otp(email, "signup", wait=5)
        assert code, "referred signup OTP not found"
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        assert v.status_code == 200
        time.sleep(0.5)
        ref1 = requests.get(f"{API}/my-referrals", headers=h).json()
        assert ref1["count"] == ref0["count"] + 1
        assert round(ref1["earned"] - ref0["earned"], 2) == 20.0


# ---------- Campaign affiliate link normalization ----------
class TestAffiliateLinkNormalize:
    def test_missing_scheme_normalized_to_https(self, admin_headers):
        payload = {"offer_name": f"TEST_Norm_{uuid.uuid4().hex[:6]}",
                   "affiliate_links": [{"id": "a", "label": "Primary",
                                        "url": "example.com/track", "is_primary": True,
                                        "is_active": True}]}
        r = requests.post(f"{API}/campaigns", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["affiliate_links"][0]["url"].startswith("https://")
        # cleanup
        requests.delete(f"{API}/campaigns/{c['id']}", headers=admin_headers)
