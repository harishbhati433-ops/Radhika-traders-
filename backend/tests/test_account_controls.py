"""
Phase 4 tests — signup OTP, duplicate reg blocking, admin account controls,
disabled-partner referral attribution.
"""
import os
import re
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"


def _grep_otp(email: str, purpose: str = "signup", wait: float = 6.0):
    deadline = time.time() + wait
    pattern = re.compile(rf"\[OTP {re.escape(purpose)}\] {re.escape(email)} -> (\d+)")
    while time.time() < deadline:
        try:
            out = subprocess.run(
                ["bash", "-lc", "tail -n 800 /var/log/supervisor/backend.*.log 2>/dev/null"],
                capture_output=True, text=True, timeout=5,
            ).stdout
            m = pattern.findall(out)
            if m:
                return m[-1]
        except Exception:
            pass
        time.sleep(0.5)
    return None


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _mk_gmail_alias():
    return f"harishbhati4581+qa{uuid.uuid4().hex[:8]}@gmail.com"


def _register_and_verify(email, mobile=None, pw="Passw0rd!", name="QA User"):
    mobile = mobile or f"9{uuid.uuid4().int % 1000000000:09d}"
    r = requests.post(f"{API}/auth/register",
                      json={"name": name, "email": email, "mobile": mobile, "password": pw})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    code = _grep_otp(email, "signup", wait=8)
    assert code, f"OTP for {email} not in logs"
    v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
    assert v.status_code == 200, v.text
    j = v.json()
    return {"email": email, "mobile": mobile, "password": pw,
            "token": j["token"], "id": j["user"]["id"]}


# ---------- 1. Signup OTP sends & log line format ----------
class TestSignupOtp:
    def test_register_gmail_alias_sends_otp(self):
        email = _mk_gmail_alias()
        r = requests.post(f"{API}/auth/register", json={
            "name": "QA", "email": email, "mobile": f"9{uuid.uuid4().int % 1000000000:09d}",
            "password": "Passw0rd!"})
        assert r.status_code == 200, r.text
        assert "OTP" in r.json().get("message", "")
        # Log line: [OTP signup] <email> -> <code> (sent=True)
        time.sleep(1)
        out = subprocess.run(
            ["bash", "-lc", "tail -n 400 /var/log/supervisor/backend.*.log"],
            capture_output=True, text=True, timeout=5).stdout
        line = re.search(rf"\[OTP signup\] {re.escape(email)} -> (\d+) \(sent=(True|False)\)", out)
        assert line, "log line with sent=True/False missing"
        assert line.group(2) == "True", f"OTP delivery failed sent={line.group(2)}"
        code = line.group(1)
        v = requests.post(f"{API}/auth/verify-otp", json={"email": email, "code": code})
        assert v.status_code == 200
        assert "token" in v.json()


# ---------- 2. Duplicate registration blocked ----------
class TestDuplicateRegistration:
    def test_same_email_blocked(self):
        u = _register_and_verify(_mk_gmail_alias())
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": u["email"], "mobile": f"9{uuid.uuid4().int % 1000000000:09d}",
            "password": "Passw0rd!"})
        assert r.status_code == 400
        assert "already registered" in r.json()["detail"].lower()

    def test_same_mobile_blocked_various_formats(self):
        u = _register_and_verify(_mk_gmail_alias())
        for m in [u["mobile"], f"+91{u['mobile']}", f"+91 {u['mobile'][:5]} {u['mobile'][5:]}"]:
            r = requests.post(f"{API}/auth/register", json={
                "name": "X", "email": _mk_gmail_alias(), "mobile": m, "password": "Passw0rd!"})
            assert r.status_code == 400, f"format {m!r} not blocked: {r.status_code} {r.text}"
            assert "mobile" in r.json()["detail"].lower()

    def test_invalid_mobile_lt_10_digits(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": _mk_gmail_alias(), "mobile": "12345", "password": "Passw0rd!"})
        assert r.status_code == 400
        assert "10" in r.json()["detail"]


# ---------- 3. Unverified users hidden from admin ----------
class TestUnverifiedHidden:
    def test_unverified_signup_not_in_admin_list(self, admin_headers):
        email = _mk_gmail_alias()
        r = requests.post(f"{API}/auth/register", json={
            "name": "Unver", "email": email,
            "mobile": f"9{uuid.uuid4().int % 1000000000:09d}", "password": "Passw0rd!"})
        assert r.status_code == 200
        # NOT verifying → should not show in customers
        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        assert not any(c.get("email") == email for c in lst)


# ---------- 4. Admin account status controls ----------
class TestAdminAccountControls:
    def test_status_reason_required(self, admin_headers):
        u = _register_and_verify(_mk_gmail_alias())
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deactivated", "reason": ""},
                           headers=admin_headers)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        assert "reason" in r.json().get("detail", "").lower()

    def test_deactivate_blocks_login_and_apis(self, admin_headers):
        u = _register_and_verify(_mk_gmail_alias())
        h = {"Authorization": f"Bearer {u['token']}"}
        # verify wallet works pre-deactivate
        assert requests.get(f"{API}/wallet", headers=h).status_code == 200
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deactivated", "reason": "policy check"},
                           headers=admin_headers)
        assert r.status_code == 200, r.text
        # list shows deactivated + reason
        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        row = next((c for c in lst if c["id"] == u["id"]), None)
        assert row and row.get("account_status") == "deactivated"
        assert row.get("account_status_reason") == "policy check"
        # login blocked
        lg = requests.post(f"{API}/auth/login",
                           json={"email": u["email"], "password": u["password"], "portal": "customer"})
        assert lg.status_code == 403
        assert "deactivated" in lg.json()["detail"].lower()
        # existing token → 403
        w = requests.get(f"{API}/wallet", headers=h)
        assert w.status_code == 403

    def test_disabled_and_active(self, admin_headers):
        u = _register_and_verify(_mk_gmail_alias())
        # disable
        requests.patch(f"{API}/admin/customers/{u['id']}/status",
                       json={"status": "disabled", "reason": "abuse"}, headers=admin_headers)
        lg = requests.post(f"{API}/auth/login",
                           json={"email": u["email"], "password": u["password"], "portal": "customer"})
        assert lg.status_code == 403
        assert "disabled" in lg.json()["detail"].lower()
        # activate
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "active", "reason": ""}, headers=admin_headers)
        assert r.status_code == 200
        lg = requests.post(f"{API}/auth/login",
                           json={"email": u["email"], "password": u["password"], "portal": "customer"})
        assert lg.status_code == 200

    def test_delete_soft_hides_and_blocks_login(self, admin_headers):
        u = _register_and_verify(_mk_gmail_alias())
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "deleted", "reason": "user request"}, headers=admin_headers)
        assert r.status_code == 200
        # hidden by default
        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        assert not any(c["id"] == u["id"] for c in lst)
        # visible with include_deleted
        lst2 = requests.get(f"{API}/admin/customers",
                            params={"include_deleted": "true"}, headers=admin_headers).json()
        assert any(c["id"] == u["id"] for c in lst2)
        # login → 401
        lg = requests.post(f"{API}/auth/login",
                           json={"email": u["email"], "password": u["password"], "portal": "customer"})
        assert lg.status_code == 401

    def test_purge_removes_from_db(self, admin_headers):
        u = _register_and_verify(_mk_gmail_alias())
        r = requests.patch(f"{API}/admin/customers/{u['id']}/status",
                           json={"status": "purge", "reason": "gdpr"}, headers=admin_headers)
        assert r.status_code == 200
        lst = requests.get(f"{API}/admin/customers",
                           params={"include_deleted": "true"}, headers=admin_headers).json()
        assert not any(c["id"] == u["id"] for c in lst)


# ---------- 5. Disabled partner referrals ----------
class TestDisabledPartnerReferral:
    def test_go_still_redirects_but_lead_has_no_partner(self, admin_headers):
        # Create a fresh partner, disable them
        p = _register_and_verify(_mk_gmail_alias())
        # get their referral_code from /admin/customers
        lst = requests.get(f"{API}/admin/customers", headers=admin_headers).json()
        row = next(c for c in lst if c["id"] == p["id"])
        ref = row["referral_code"]
        requests.patch(f"{API}/admin/customers/{p['id']}/status",
                       json={"status": "disabled", "reason": "fraud"}, headers=admin_headers)
        # /go still 302
        r = requests.get(f"{API}/go/choice-trade-test",
                         params={"ref": ref}, allow_redirects=False)
        assert r.status_code == 302
        # lead created has no partner_id
        lead_r = requests.post(f"{API}/leads/choice-trade-test",
                               json={"ref": ref, "data": {"name": "Neutral", "mobile": "9876500011"}})
        assert lead_r.status_code == 200, lead_r.text
        lid = lead_r.json()["id"]
        adm = requests.get(f"{API}/admin/leads",
                           params={"search": "Neutral"}, headers=admin_headers).json()
        row = next((l for l in adm if l["id"] == lid), None)
        assert row is not None
        assert not row.get("partner_id")
