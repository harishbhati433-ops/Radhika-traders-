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


def _rand_pan() -> str:
    """Generate a unique valid PAN: 5 letters + 4 digits + 1 letter."""
    # Use uuid to ensure cross-run + cross-worker uniqueness. Map hex→letters.
    hx = uuid.uuid4().hex
    letters = "".join(chr(ord("A") + (int(hx[i], 16) + i * 3) % 26) for i in range(5))
    digits = f"{(int(hx[5:9], 16) % 9000) + 1000}"
    tail = chr(ord("A") + int(hx[9], 16) % 26)
    return f"{letters}{digits}{tail}"


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
            # Public list is now live-only (paused/closed hidden)
            assert c.get("status") == "live", f"non-live campaign in public list: {c.get('slug')} status={c.get('status')}"

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

    def test_submit_kyc(self, cust_headers, customer):
        # Use unique PAN so re-runs don't collide
        pan = _rand_pan()
        customer["pan"] = pan
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": pan, "aadhaar": "111122223333",
            "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "Test User", "upi": "test@upi"
        }, headers=cust_headers)
        assert r.status_code == 200, r.text
        # Phase 3: KYC auto-verifies on submit
        assert r.json()["kyc"]["status"] == "verified"
        assert r.json()["kyc"].get("verified_mode") == "auto"
        # Set transaction PIN for subsequent withdrawal tests
        sp = requests.post(f"{API}/security/transaction-password",
                           json={"login_password": customer["password"], "new_password": "9182"},
                           headers=cust_headers)
        assert sp.status_code == 200, sp.text
        customer["pin"] = "9182"

    def test_kyc_invalid_pan_400(self, admin_headers):
        # Fresh customer just to test validation without polluting main one
        email = f"test_kycval_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "V", "email": email, "mobile": "9111000222", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        h = {"Authorization": f"Bearer {v.json()['token']}"}
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": "BADPAN", "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "V"}, headers=h)
        assert r.status_code == 400 and "PAN" in r.json()["detail"]
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": "ABCDE1234F", "bank_account": "1234567890", "ifsc": "BADIFSC",
            "account_holder": "V"}, headers=h)
        assert r.status_code == 400 and "IFSC" in r.json()["detail"]

    def test_kyc_duplicate_pan_rejected(self, admin_headers, customer):
        # customer already has a unique PAN set by test_submit_kyc → try duplicating it
        dup_pan = customer.get("pan", "ABCDE1234F")
        email = f"test_kycdup_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "D", "email": email, "mobile": "9111000333", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        h = {"Authorization": f"Bearer {v.json()['token']}"}
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": dup_pan, "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "D"}, headers=h)
        assert r.status_code == 400 and "already registered" in r.json()["detail"].lower()

    def test_withdraw_below_min_rejected(self, cust_headers, customer):
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 50, "method": "UPI", "details": "x@upi",
                                "transaction_password": customer.get("pin", "9182")},
                          headers=cust_headers)
        assert r.status_code == 400

    def test_withdraw_without_pin_rejected(self, admin_headers):
        # Fresh KYC-verified customer with NO pin should be blocked at withdrawal
        email = f"test_nopin_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "NP", "email": email, "mobile": "9101010101", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]; uid = v.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}
        requests.put(f"{API}/profile/kyc", json={
            "pan": _rand_pan(), "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "NP", "upi": "np@ybl"}, headers=h)
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "t"}, headers=admin_headers)
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 200, "method": "UPI", "details": "np@ybl"}, headers=h)
        assert r.status_code == 400
        assert "Transaction Password" in r.json()["detail"]
        # Wrong PIN after setting one
        requests.post(f"{API}/security/transaction-password",
                      json={"login_password": "Passw0rd!", "new_password": "4321"}, headers=h)
        r2 = requests.post(f"{API}/withdrawals",
                           json={"amount": 200, "method": "UPI", "details": "np@ybl",
                                 "transaction_password": "0000"}, headers=h)
        assert r2.status_code == 400 and "Incorrect" in r2.json()["detail"]

    def test_withdraw_success_and_admin_flow(self, cust_headers, admin_headers, customer):
        w0 = requests.get(f"{API}/wallet", headers=cust_headers).json()
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 200, "method": "UPI", "details": "x@upi",
                                "transaction_password": customer.get("pin", "9182")},
                          headers=cust_headers)
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

    def test_withdraw_over_balance(self, cust_headers, customer):
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 999999, "method": "UPI", "details": "x@upi",
                                "transaction_password": customer.get("pin", "9182")},
                          headers=cust_headers)
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
        # A freshly-registered customer may have zero transactions when this test races
        # ahead of TestWalletAndWithdrawals::test_admin_credit_and_wallet under xdist.
        # A valid statement must at least contain the format header/prefix bytes.
        assert len(r.content) >= 40


# ---------- Upload ----------
class TestUpload:
    def test_customer_can_upload_image(self, cust_headers):
        # NEW: customers are allowed to upload images (for KYC UPI QR)
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 40, "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/files/")

    def test_customer_cannot_upload_non_image(self, cust_headers):
        # non-image should be rejected with 400 for customers
        files = {"file": ("bad.txt", b"not an image", "text/plain")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 400

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
        # choice-trade-test has lead_fields enabled → redirect goes to /join/<slug>?ref=...
        # (external primary URL is only used when no lead fields are enabled)
        assert (f"/join/choice-trade-test" in loc and "ref=RTA12499" in loc), \
            f"Unexpected /go redirect for choice-trade-test: {loc}"

    def test_go_unknown_slug_redirects_to_offer_ended(self):
        r = requests.get(f"{API}/go/no-such-slug-xyz", allow_redirects=False)
        assert r.status_code == 302
        # Unknown slug now goes to /offer-ended (was /campaigns)
        assert "/offer-ended" in r.headers.get("location", "")

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
        # KYC auto-verifies on submit (Phase 3)
        pan = _rand_pan()
        requests.put(f"{API}/profile/kyc", json={
            "pan": pan, "aadhaar": "111122223333",
            "bank_account": "50100123456789", "ifsc": "HDFC0000123",
            "account_holder": "WPayout Test", "upi": "wpayout@ybl"
        }, headers=h)
        # Set transaction PIN (required Phase 3)
        requests.post(f"{API}/security/transaction-password",
                      json={"login_password": pw, "new_password": "1122"}, headers=h)
        # credit
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "test"},
                      headers=admin_headers)
        # withdraw empty details
        r = requests.post(f"{API}/withdrawals",
                          json={"amount": 150, "method": "UPI", "details": "",
                                "transaction_password": "1122"},
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
        assert pi["pan"] == pan


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
            "pan": _rand_pan(), "bank_account": "501009991", "ifsc": "HDFC0000123",
            "account_holder": "Paid User", "upi": "paid@ybl"}, headers=h)
        requests.post(f"{API}/security/transaction-password",
                      json={"login_password": pw, "new_password": "3344"}, headers=h)
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "test"},
                      headers=admin_headers)
        wr = requests.post(f"{API}/withdrawals",
                           json={"amount": 200, "method": "UPI", "details": "paid@ybl",
                                 "transaction_password": "3344"},
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


# ---------- NEW: Login portal separation ----------
class TestLoginPortalSeparation:
    def test_admin_on_customer_portal_blocked(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "customer"})
        assert r.status_code == 403
        assert "Admin accounts cannot log in here" in r.json().get("detail", "")

    def test_admin_default_portal_blocked(self):
        # No portal in payload defaults to 'customer' → admin should be blocked
        r = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 403

    def test_customer_on_admin_portal_blocked(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "testcust@example.com", "password": "Test@1234", "portal": "admin"})
        if r.status_code == 401:
            pytest.skip("seeded testcust login failed")
        assert r.status_code == 403
        assert "admin only" in r.json().get("detail", "").lower()

    def test_admin_correct_portal_ok(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_customer_correct_portal_ok(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "testcust@example.com", "password": "Test@1234", "portal": "customer"})
        if r.status_code == 401:
            pytest.skip("seeded testcust login failed")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "customer"


# ---------- NEW: UPI QR upload + KYC snapshot in withdrawals ----------
class TestUpiQrUpload:
    def test_customer_upload_qr_and_kyc_and_withdrawal_snapshot(self, admin_headers):
        # Fresh customer
        email = f"test_qr_{uuid.uuid4().hex[:8]}@example.com"
        pw = "Passw0rd!"
        requests.post(f"{API}/auth/register", json={
            "name": "QRUser", "email": email, "mobile": "9111222333", "password": pw})
        code = _grep_otp(email, "signup", wait=5)
        assert code
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        assert v.status_code == 200
        tok = v.json()["token"]; uid = v.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}

        # Step 1: customer uploads QR image
        files = {"file": ("qr.png", b"\x89PNG\r\n\x1a\n" + b"0" * 60, "image/png")}
        up = requests.post(f"{API}/upload", files=files, headers=h)
        assert up.status_code == 200, up.text
        qr_url = up.json()["url"]
        assert qr_url.startswith("/api/files/")

        # Step 2: submit KYC with upi_qr_url
        r = requests.put(f"{API}/profile/kyc", json={
            "pan": _rand_pan(), "aadhaar": "111122223333",
            "bank_account": "50100987654321", "ifsc": "HDFC0000123",
            "account_holder": "QR User", "upi": "qr@ybl", "upi_qr_url": qr_url
        }, headers=h)
        assert r.status_code == 200, r.text
        # verify persisted in bank.upi_qr_url via /auth/me
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me.get("bank", {}).get("upi_qr_url") == qr_url

        # Set txn PIN (required Phase 3)
        requests.post(f"{API}/security/transaction-password",
                      json={"login_password": pw, "new_password": "5566"}, headers=h)

        # Step 3: admin credits and customer requests withdrawal
        requests.post(f"{API}/admin/credit",
                      json={"user_id": uid, "amount": 500, "description": "qr test"},
                      headers=admin_headers)
        wr = requests.post(f"{API}/withdrawals",
                           json={"amount": 150, "method": "UPI", "details": "qr@ybl",
                                 "transaction_password": "5566"},
                           headers=h)
        assert wr.status_code == 200, wr.text
        data = wr.json()
        pi = data.get("payout_info") or {}
        assert pi.get("upi_qr_url") == qr_url, f"payout_info.upi_qr_url missing: {pi}"

    def test_customer_upload_non_image_rejected(self, cust_headers):
        files = {"file": ("bad.pdf", b"%PDF-1.4 fake", "application/pdf")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 400



# =====================================================================
# PHASE 1+2 NEW FEATURES: campaign status sync, notifications,
# KYC admin, broadcast, leads, offer-ended redirect
# =====================================================================

# ---------- Campaign status → /offer-ended redirect ----------
class TestCampaignStatusSync:
    def test_public_list_hides_paused_and_closed(self, admin_headers):
        # Create a live campaign, then flip to paused and closed
        payload = {"offer_name": f"TEST_Status_{uuid.uuid4().hex[:6]}", "company": "X",
                   "category": "Demat", "payout_amount": 100, "status": "live", "offer_enabled": True,
                   "affiliate_links": [{"id": "a", "label": "Primary", "url": "https://example.com/x",
                                        "is_primary": True, "is_active": True}]}
        c = requests.post(f"{API}/campaigns", json=payload, headers=admin_headers).json()
        cid, slug = c["id"], c["slug"]
        try:
            # live → present
            pub_ids = [x["id"] for x in requests.get(f"{API}/campaigns").json()]
            assert cid in pub_ids
            # paused → hidden, /go redirects /offer-ended?s=paused
            assert requests.patch(f"{API}/campaigns/{cid}/status",
                                  params={"status": "paused"}, headers=admin_headers).status_code == 200
            pub_ids = [x["id"] for x in requests.get(f"{API}/campaigns").json()]
            assert cid not in pub_ids
            # admin_view=true still shows
            adm_ids = [x["id"] for x in requests.get(f"{API}/campaigns",
                                                    params={"admin_view": "true"},
                                                    headers=admin_headers).json()]
            assert cid in adm_ids
            r = requests.get(f"{API}/go/{slug}", allow_redirects=False)
            assert r.status_code == 302
            loc = r.headers.get("location", "")
            assert "/offer-ended" in loc and "s=paused" in loc and f"c={slug}" in loc
            # closed → also hidden, s=closed
            requests.patch(f"{API}/campaigns/{cid}/status",
                           params={"status": "closed"}, headers=admin_headers)
            r = requests.get(f"{API}/go/{slug}", allow_redirects=False)
            assert "s=closed" in r.headers.get("location", "")
            # live again → back in public list
            requests.patch(f"{API}/campaigns/{cid}/status",
                           params={"status": "live"}, headers=admin_headers)
            pub_ids = [x["id"] for x in requests.get(f"{API}/campaigns").json()]
            assert cid in pub_ids
        finally:
            requests.delete(f"{API}/campaigns/{cid}", headers=admin_headers)


# ---------- Campaign LIVE announcement + notifications API ----------
class TestCampaignLiveAnnouncement:
    def test_pause_to_live_creates_notification_and_broadcast(self, admin_headers):
        # Fresh verified customer
        email = f"test_notif_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "Notif User", "email": email, "mobile": "9111000111", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}

        # Create campaign as paused
        payload = {"offer_name": f"TEST_Live_{uuid.uuid4().hex[:6]}", "company": "L",
                   "category": "Demat", "payout_amount": 300, "status": "paused", "offer_enabled": True}
        c = requests.post(f"{API}/campaigns", json=payload, headers=admin_headers).json()
        cid = c["id"]
        try:
            # flip → live triggers announce_campaign_live
            r = requests.patch(f"{API}/campaigns/{cid}/status",
                               params={"status": "live"}, headers=admin_headers)
            assert r.status_code == 200
            # Poll up to ~20s for the broadcast row (fan-out is serial across all customers)
            row_found = False
            for _ in range(20):
                time.sleep(1)
                bs = requests.get(f"{API}/admin/broadcasts", headers=admin_headers).json()
                if any(b.get("kind") == "campaign_live" and b.get("campaign_id") == cid for b in bs):
                    row_found = True
                    break
            assert row_found, "campaign_live broadcast row not inserted after 20s"
            n = requests.get(f"{API}/notifications", headers=h).json()
            assert "unread" in n and "items" in n
            live_items = [x for x in n["items"] if x.get("type") == "campaign_live"
                          and x.get("campaign_id") == cid]
            assert live_items, f"campaign_live notif not fanned out: {n['items'][:3]}"
        finally:
            requests.delete(f"{API}/campaigns/{cid}", headers=admin_headers)

    def test_mark_read_specific_and_all(self, cust_headers):
        # trigger at least one notif for customer via admin credit? use existing.
        n = requests.get(f"{API}/notifications", headers=cust_headers).json()
        if not n["items"]:
            pytest.skip("no notifications for this customer")
        # mark first specifically
        first_id = n["items"][0]["id"]
        r = requests.post(f"{API}/notifications/read", json=[first_id], headers=cust_headers)
        assert r.status_code == 200
        # mark all with empty list
        r2 = requests.post(f"{API}/notifications/read", json=[], headers=cust_headers)
        assert r2.status_code == 200
        n2 = requests.get(f"{API}/notifications", headers=cust_headers).json()
        assert n2["unread"] == 0


# ---------- Admin KYC management ----------
class TestAdminKyc:
    def test_kyc_list_and_transitions(self, admin_headers):
        # Fresh customer submits KYC
        email = f"test_kyc_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "KYC User", "email": email, "mobile": "9002002002", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]; uid = v.json()["user"]["id"]
        h = {"Authorization": f"Bearer {tok}"}
        requests.put(f"{API}/profile/kyc", json={
            "pan": _rand_pan(), "aadhaar": "999988887777",
            "bank_account": "5555555555", "ifsc": "HDFC0000123",
            "account_holder": "KYC User", "upi": "kyc@ybl"}, headers=h)
        # Phase 3: auto-verified on submit → appears in verified list
        verified = requests.get(f"{API}/admin/kyc", params={"status": "verified"}, headers=admin_headers).json()
        assert any(u["id"] == uid for u in verified)
        me0 = requests.get(f"{API}/auth/me", headers=h).json()
        assert me0["kyc"]["status"] == "verified"
        # unknown status rejected
        bad = requests.patch(f"{API}/admin/kyc/{uid}", json={"status": "bogus"}, headers=admin_headers)
        assert bad.status_code == 400
        # verify → still ok (idempotent)
        v1 = requests.patch(f"{API}/admin/kyc/{uid}", json={"status": "verified", "note": "ok"}, headers=admin_headers)
        assert v1.status_code == 200 and v1.json()["status"] == "verified"
        # confirm via /auth/me
        me = requests.get(f"{API}/auth/me", headers=h).json()
        assert me["kyc"]["status"] == "verified"
        # reject with reason
        r = requests.patch(f"{API}/admin/kyc/{uid}",
                           json={"status": "rejected", "note": "bad docs"},
                           headers=admin_headers)
        assert r.status_code == 200
        me2 = requests.get(f"{API}/auth/me", headers=h).json()
        assert me2["kyc"]["status"] == "rejected"
        # deactivate → activate (pending)
        requests.patch(f"{API}/admin/kyc/{uid}", json={"status": "deactivated"}, headers=admin_headers)
        assert requests.get(f"{API}/auth/me", headers=h).json()["kyc"]["status"] == "deactivated"
        # withdrawal blocked (not verified)
        requests.post(f"{API}/admin/credit", json={"user_id": uid, "amount": 500, "description": "t"},
                      headers=admin_headers)
        wr = requests.post(f"{API}/withdrawals",
                           json={"amount": 200, "method": "UPI", "details": "kyc@ybl"},
                           headers=h)
        assert wr.status_code == 400
        assert "verified" in wr.json().get("detail", "").lower()

    def test_kyc_requires_admin(self, cust_headers):
        r = requests.get(f"{API}/admin/kyc", headers=cust_headers)
        assert r.status_code == 403


# ---------- Admin Broadcast ----------
class TestAdminBroadcast:
    def test_broadcast_all_creates_in_app_notifs_and_row(self, admin_headers):
        # fresh customer to receive the broadcast
        email = f"test_bcast_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "B User", "email": email, "mobile": "9333444555", "password": "Passw0rd!"})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        tok = v.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        subj = f"TEST_BCAST_{uuid.uuid4().hex[:6]}"
        body = {"subject": subj, "message": "hello all", "audience": "all",
                "channels": ["in_app", "email"]}
        r = requests.post(f"{API}/admin/broadcast", json=body, headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Sending to" in data["message"] and data["recipients"] >= 1
        time.sleep(2.5)
        # in-app notif reached the customer
        n = requests.get(f"{API}/notifications", headers=h).json()
        assert any(x.get("title") == subj and x.get("type") == "broadcast" for x in n["items"])
        # broadcasts list has row
        bs = requests.get(f"{API}/admin/broadcasts", headers=admin_headers).json()
        assert any(b.get("subject") == subj for b in bs)

    def test_broadcast_empty_subject_rejected(self, admin_headers):
        r = requests.post(f"{API}/admin/broadcast",
                          json={"subject": "  ", "message": "x", "audience": "all"},
                          headers=admin_headers)
        assert r.status_code == 400

    def test_broadcast_selected_requires_ids(self, admin_headers):
        r = requests.post(f"{API}/admin/broadcast",
                          json={"subject": "s", "message": "m", "audience": "selected", "user_ids": []},
                          headers=admin_headers)
        assert r.status_code == 400

    def test_broadcast_requires_admin(self, cust_headers):
        r = requests.post(f"{API}/admin/broadcast",
                          json={"subject": "s", "message": "m"}, headers=cust_headers)
        assert r.status_code == 403


# ---------- Leads: lead_fields, /go redirect, create, admin list ----------
class TestLeadsFlow:
    def _mk_campaign(self, admin_headers, lead_fields):
        payload = {"offer_name": f"TEST_Lead_{uuid.uuid4().hex[:6]}", "company": "L",
                   "category": "Demat", "payout_amount": 100, "status": "live", "offer_enabled": True,
                   "lead_fields": lead_fields,
                   "affiliate_links": [{"id": "a", "label": "Primary", "url": "https://example.com/x",
                                        "is_primary": True, "is_active": True}]}
        return requests.post(f"{API}/campaigns", json=payload, headers=admin_headers).json()

    def test_lead_fields_normalized_to_10(self, admin_headers):
        c = self._mk_campaign(admin_headers, [{"key": "name", "enabled": True, "required": True}])
        try:
            fields = c["lead_fields"]
            assert len(fields) == 10
            keys = [f["key"] for f in fields]
            assert "name" in keys and "pan" in keys and "address" in keys
            name_f = next(f for f in fields if f["key"] == "name")
            assert name_f["enabled"] and name_f["required"]
            # required only if enabled — set required True on disabled 'pan' → must remain non-required
            c2 = requests.put(f"{API}/campaigns/{c['id']}",
                              json={"offer_name": c["offer_name"], "company": "L", "category": "Demat",
                                    "payout_amount": 100, "status": "live", "offer_enabled": True,
                                    "lead_fields": [{"key": "pan", "enabled": False, "required": True}]},
                              headers=admin_headers).json()
            pan_f = next(f for f in c2["lead_fields"] if f["key"] == "pan")
            assert pan_f["enabled"] is False and pan_f["required"] is False
        finally:
            requests.delete(f"{API}/campaigns/{c['id']}", headers=admin_headers)

    def test_go_redirects_to_join_when_lead_fields_enabled(self, admin_headers):
        c = self._mk_campaign(admin_headers, [{"key": "name", "enabled": True, "required": True},
                                              {"key": "mobile", "enabled": True, "required": True}])
        try:
            r = requests.get(f"{API}/go/{c['slug']}", params={"ref": "RTA12499"},
                             allow_redirects=False)
            assert r.status_code == 302
            loc = r.headers.get("location", "")
            assert f"/join/{c['slug']}" in loc and "ref=RTA12499" in loc
            # /join/<slug> returns campaign + fields + referred_by
            j = requests.get(f"{API}/join/{c['slug']}", params={"ref": "RTA12499"}).json()
            assert j["campaign"]["slug"] == c["slug"]
            assert len(j["fields"]) == 2
            assert j["ref"] == "RTA12499"
            assert j["referred_by"]  # masked name for testcust
        finally:
            requests.delete(f"{API}/campaigns/{c['id']}", headers=admin_headers)

    def test_lead_create_validation_and_admin_flow(self, admin_headers):
        c = self._mk_campaign(admin_headers, [{"key": "name", "enabled": True, "required": True},
                                              {"key": "mobile", "enabled": True, "required": True},
                                              {"key": "email", "enabled": True, "required": False},
                                              {"key": "pan", "enabled": True, "required": False}])
        cid, slug = c["id"], c["slug"]
        try:
            # missing required → 400
            r = requests.post(f"{API}/leads/{slug}",
                              json={"ref": "RTA12499", "data": {"name": "Amit"}})
            assert r.status_code == 400 and "Required" in r.json()["detail"]
            # bad mobile
            r = requests.post(f"{API}/leads/{slug}",
                              json={"ref": "RTA12499", "data": {"name": "A", "mobile": "12345"}})
            assert r.status_code == 400 and "10 digits" in r.json()["detail"]
            # bad PAN
            r = requests.post(f"{API}/leads/{slug}",
                              json={"ref": "RTA12499",
                                    "data": {"name": "A", "mobile": "9876543210", "pan": "BADPAN"}})
            assert r.status_code == 400 and "PAN" in r.json()["detail"]
            # success
            r = requests.post(f"{API}/leads/{slug}",
                              json={"ref": "RTA12499",
                                    "data": {"name": "Amit K", "mobile": "9876543210",
                                             "email": "a@b.com", "pan": "ABCDE1234F"}})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["lead_id"].startswith("LD-")
            assert data["redirect_url"]
            lid = data["id"]
            # Admin list filter by campaign
            adm = requests.get(f"{API}/admin/leads",
                               params={"campaign_id": cid}, headers=admin_headers).json()
            assert any(l["id"] == lid for l in adm)
            # search
            adm2 = requests.get(f"{API}/admin/leads",
                                params={"search": "Amit"}, headers=admin_headers).json()
            assert any(l["id"] == lid for l in adm2)
            # ref filter
            adm3 = requests.get(f"{API}/admin/leads",
                                params={"ref": "RTA12499"}, headers=admin_headers).json()
            assert any(l["id"] == lid for l in adm3)
            # summary
            s = requests.get(f"{API}/admin/leads/summary", headers=admin_headers).json()
            assert s["total"] >= 1 and s["pending"] >= 1
            # approve → reject → account_opened transitions
            u = requests.patch(f"{API}/admin/leads/{lid}",
                               json={"status": "approved"}, headers=admin_headers).json()
            assert u["status"] == "approved"
            u = requests.patch(f"{API}/admin/leads/{lid}",
                               json={"status": "rejected", "reject_reason": "dup"},
                               headers=admin_headers).json()
            assert u["status"] == "rejected" and u["reject_reason"] == "dup"
            u = requests.patch(f"{API}/admin/leads/{lid}",
                               json={"account_status": "account_opened"},
                               headers=admin_headers).json()
            assert u["account_status"] == "account_opened"
            # invalid status
            bad = requests.patch(f"{API}/admin/leads/{lid}",
                                 json={"status": "weird"}, headers=admin_headers)
            assert bad.status_code == 400
            # my-leads on partner (testcust)
            lr = requests.post(f"{API}/auth/login",
                               json={"email": "testcust@example.com", "password": "Test@1234",
                                     "portal": "customer"})
            if lr.status_code == 200:
                th = {"Authorization": f"Bearer {lr.json()['token']}"}
                mine = requests.get(f"{API}/my-leads", headers=th).json()
                assert any(l["id"] == lid for l in mine)
        finally:
            requests.delete(f"{API}/campaigns/{cid}", headers=admin_headers)


# ---------- Notifications endpoint auth ----------
class TestNotificationsAuth:
    def test_requires_auth(self):
        assert requests.get(f"{API}/notifications").status_code in (401, 403)
        assert requests.post(f"{API}/notifications/read", json=[]).status_code in (401, 403)


# ---------- 401 on invalid token ----------
class TestInvalidToken:
    def test_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer notavalidtoken"})
        assert r.status_code in (401, 403)



# =====================================================================
# PHASE 3: Security (login password change, transaction PIN, forgot email)
# =====================================================================
def _mk_verified_customer(pw="Passw0rd!", mobile="9997776655", dob=None):
    email = f"test_sec_{uuid.uuid4().hex[:8]}@example.com"
    requests.post(f"{API}/auth/register", json={
        "name": "Sec User", "email": email, "mobile": mobile, "password": pw})
    code = _grep_otp(email, "signup", wait=5)
    assert code, f"OTP for {email} not found"
    v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
    tok = v.json()["token"]; uid = v.json()["user"]["id"]
    h = {"Authorization": f"Bearer {tok}"}
    if dob is not None:
        requests.put(f"{API}/profile", json={"dob": dob}, headers=h)
    return {"email": email, "password": pw, "id": uid, "mobile": mobile, "h": h}


class TestSecurityChangePassword:
    def test_change_password_wrong_current_400(self):
        u = _mk_verified_customer()
        r = requests.post(f"{API}/security/change-password",
                          json={"current_password": "wrong", "new_password": "NewPass!23"},
                          headers=u["h"])
        assert r.status_code == 400
        assert "incorrect" in r.json()["detail"].lower()

    def test_change_password_success_then_login(self):
        u = _mk_verified_customer()
        r = requests.post(f"{API}/security/change-password",
                          json={"current_password": u["password"], "new_password": "NewPass!23"},
                          headers=u["h"])
        assert r.status_code == 200
        # old password no longer works
        old = requests.post(f"{API}/auth/login",
                            json={"email": u["email"], "password": u["password"], "portal": "customer"})
        assert old.status_code == 401
        # new works
        new = requests.post(f"{API}/auth/login",
                            json={"email": u["email"], "password": "NewPass!23", "portal": "customer"})
        assert new.status_code == 200


class TestTransactionPassword:
    def test_status_and_set_and_reset_via_otp(self):
        u = _mk_verified_customer()
        h = u["h"]
        # status: no pin yet
        s = requests.get(f"{API}/security/status", headers=h).json()
        assert s["has_txn_password"] is False
        assert "logs" in s
        # bad PIN format
        r = requests.post(f"{API}/security/transaction-password",
                          json={"login_password": u["password"], "new_password": "12"}, headers=h)
        assert r.status_code == 400 and "4" in r.json()["detail"]
        # PIN cannot equal login password
        r = requests.post(f"{API}/security/transaction-password",
                          json={"login_password": u["password"], "new_password": u["password"]}, headers=h)
        assert r.status_code == 400
        # wrong login password
        r = requests.post(f"{API}/security/transaction-password",
                          json={"login_password": "wrong", "new_password": "4321"}, headers=h)
        assert r.status_code == 400 and "Login password" in r.json()["detail"]
        # success set
        r = requests.post(f"{API}/security/transaction-password",
                          json={"login_password": u["password"], "new_password": "4321"}, headers=h)
        assert r.status_code == 200 and r.json()["has_txn_password"] is True
        # status shows set + logs contain event
        s2 = requests.get(f"{API}/security/status", headers=h).json()
        assert s2["has_txn_password"] is True
        assert any(l["event"] == "transaction_password_set" for l in s2["logs"])
        # Reset requires OTP now
        r = requests.post(f"{API}/security/transaction-password",
                          json={"new_password": "9999"}, headers=h)
        assert r.status_code == 400 and "OTP" in r.json()["detail"]
        # request OTP
        o = requests.post(f"{API}/security/transaction-password/otp", headers=h)
        assert o.status_code == 200
        code = _grep_otp(u["email"], "txn", wait=5)
        assert code, "txn OTP not logged"
        # wrong OTP
        r = requests.post(f"{API}/security/transaction-password",
                          json={"otp": "000000", "new_password": "9999"}, headers=h)
        assert r.status_code == 400
        # correct OTP resets
        r = requests.post(f"{API}/security/transaction-password",
                          json={"otp": code, "new_password": "9999"}, headers=h)
        assert r.status_code == 200


class TestForgotEmail:
    def test_recover_email_by_pan(self, admin_headers):
        # Create verified customer with unique mobile + KYC (PAN in kyc)
        pw = "Passw0rd!"
        mobile = f"90{uuid.uuid4().int % 100000000:08d}"
        email = f"test_fe_{uuid.uuid4().hex[:8]}@example.com"
        requests.post(f"{API}/auth/register", json={
            "name": "FE User", "email": email, "mobile": mobile, "password": pw})
        code = _grep_otp(email, "signup", wait=5)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        h = {"Authorization": f"Bearer {v.json()['token']}"}
        pan = f"FE{uuid.uuid4().hex[:3].upper()}1234K"
        # Ensure PAN matches format ^[A-Z]{5}\d{4}[A-Z]$
        pan = re.sub(r"[^A-Z]", "X", pan[:5]) + "1234K"
        requests.put(f"{API}/profile/kyc", json={
            "pan": pan, "bank_account": "1234567890", "ifsc": "HDFC0000123",
            "account_holder": "FE User", "upi": "fe@ybl"}, headers=h)
        requests.put(f"{API}/profile", json={"dob": "1990-01-15"}, headers=h)

        # Correct PAN → masked email returned
        r = requests.post(f"{API}/auth/recover-email",
                          json={"mobile": mobile, "pan": pan})
        assert r.status_code == 200, r.text
        masked = r.json().get("masked_email", "")
        assert "@example.com" in masked and "*" in masked
        # Correct DOB → also works
        r2 = requests.post(f"{API}/auth/recover-email",
                           json={"mobile": mobile, "dob": "1990-01-15"})
        assert r2.status_code == 200
        # Wrong PAN → 400
        r3 = requests.post(f"{API}/auth/recover-email",
                           json={"mobile": mobile, "pan": "ZZZZZ9999Z"})
        assert r3.status_code == 400 and "match" in r3.json()["detail"].lower()
        # Bad mobile format
        r4 = requests.post(f"{API}/auth/recover-email",
                           json={"mobile": "123", "pan": pan})
        assert r4.status_code == 400

    def test_recover_email_requires_pan_or_dob(self):
        # neither PAN nor DOB → 400 "Details do not match" (use unique mobile to avoid 429 lockout)
        mobile = f"98{uuid.uuid4().int % 100000000:08d}"
        r = requests.post(f"{API}/auth/recover-email",
                          json={"mobile": mobile})
        assert r.status_code == 400
