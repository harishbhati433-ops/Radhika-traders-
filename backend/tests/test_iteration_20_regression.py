"""Iteration 20 full regression: contact settings, signup bonus, password reset, logout-all, admin devices, employee 403."""
import os
import time
import requests
import pytest
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://radhika-connect.preview.emergentagent.com"
API = f"{BASE}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PW = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PW = "Test@1234"

ORIG_CONTACT = {
    "owner_mobile": "6376541191",
    "support_mobile": "6376541191",
    "whatsapp_number": "6376541191",
    "support_email": "radhikatradersofficial@gmail.com",
    "owner_email": "bhatiharish276@gmail.com",
}

mongo = MongoClient(os.environ["MONGO_URL"])
db = mongo[os.environ["DB_NAME"]]


def _admin_login(ua="pytest-ua/1.0"):
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "portal": "admin"},
                      headers={"User-Agent": ua})
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


def _cust_login():
    r = requests.post(f"{API}/auth/login", json={"email": CUST_EMAIL, "password": CUST_PW})
    assert r.status_code == 200, r.text
    j = r.json()
    return j.get("access_token") or j.get("token")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- CONTACT SETTINGS ----------
class TestContact:
    def test_public_no_store(self):
        r = requests.get(f"{API}/contact/public")
        assert r.status_code == 200
        cc = r.headers.get("cache-control", "").lower()
        assert "no-store" in cc, f"Cache-Control missing no-store: {cc}"
        data = r.json()
        for k in ("support_mobile", "whatsapp_number", "support_email"):
            assert k in data
        # owner_email should NOT be exposed publicly (only 4 public fields)
        assert "owner_email" not in data, "owner_email leaked in /contact/public"

    def test_admin_get_and_no_change_400(self):
        tok = _admin_login()
        r = requests.get(f"{API}/admin/contact", headers=_h(tok))
        assert r.status_code == 200
        current = r.json()
        # no-change PUT
        payload = {k: current[k] for k in ORIG_CONTACT.keys() if k in current}
        r2 = requests.put(f"{API}/admin/contact", headers=_h(tok), json=payload)
        assert r2.status_code == 400, f"expected 400 on no-change, got {r2.status_code}: {r2.text}"

    def test_admin_put_validation_and_history(self):
        tok = _admin_login()
        # invalid mobile (9 digits)
        r = requests.put(f"{API}/admin/contact", headers=_h(tok),
                         json={**ORIG_CONTACT, "support_mobile": "123456789"})
        assert r.status_code in (400, 422), r.text
        # invalid email
        r = requests.put(f"{API}/admin/contact", headers=_h(tok),
                         json={**ORIG_CONTACT, "support_email": "not-an-email"})
        assert r.status_code in (400, 422), r.text
        # valid change
        r = requests.put(f"{API}/admin/contact", headers=_h(tok),
                         json={**ORIG_CONTACT, "support_mobile": "9876543210"})
        assert r.status_code == 200, r.text
        # history
        h = requests.get(f"{API}/admin/contact/history", headers=_h(tok))
        assert h.status_code == 200
        rows = h.json() if isinstance(h.json(), list) else h.json().get("items", [])
        assert len(rows) > 0
        # REVERT
        r = requests.put(f"{API}/admin/contact", headers=_h(tok), json=ORIG_CONTACT)
        assert r.status_code == 200
        # confirm public reflects revert
        pub = requests.get(f"{API}/contact/public").json()
        assert pub.get("support_mobile") == "6376541191"

    def test_employee_forbidden(self):
        er = requests.post(f"{API}/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})
        assert er.status_code == 200, er.text
        etok = er.json().get("access_token") or er.json().get("token")
        assert etok
        r = requests.get(f"{API}/admin/contact", headers=_h(etok))
        assert r.status_code == 403, f"employee should get 403, got {r.status_code}"


# ---------- SIGNUP BONUS ----------
class TestSignupBonus:
    def test_wallet_has_signup_bonus_frozen(self):
        ctok = _cust_login()
        w = requests.get(f"{API}/wallet", headers=_h(ctok))
        assert w.status_code == 200, w.text
        wd = w.json()
        sb = wd.get("signup_bonus")
        assert sb is not None, f"signup_bonus missing in /wallet: {wd}"
        assert "status" in sb and "amount" in sb
        assert sb["status"] in ("credited", "locked", "not_eligible"), sb["status"]
        original_amount = float(sb["amount"])

        atok = _admin_login()
        # Read current setting via /settings/public
        cur = requests.get(f"{API}/settings/public").json()
        cur_bonus = float(cur.get("signup_bonus") or 20)
        # Change to 100
        r = requests.put(f"{API}/admin/settings", headers=_h(atok), json={"signup_bonus": 100, "signup_bonus_enabled": True})
        assert r.status_code == 200, r.text
        # Re-fetch customer wallet
        w2 = requests.get(f"{API}/wallet", headers=_h(ctok)).json()
        sb2 = w2.get("signup_bonus")
        assert float(sb2["amount"]) == original_amount, f"bonus amount changed: {original_amount} -> {sb2['amount']}"
        # Restore to 20
        r = requests.put(f"{API}/admin/settings", headers=_h(atok), json={"signup_bonus": 20, "signup_bonus_enabled": True})
        assert r.status_code == 200

    def test_backfill_idempotent(self):
        atok = _admin_login()
        r1 = requests.post(f"{API}/admin/signup-bonus/backfill", headers=_h(atok))
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        r2 = requests.post(f"{API}/admin/signup-bonus/backfill", headers=_h(atok))
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("locked", 0) == 0 and d2.get("credited", 0) == 0, f"second run not idempotent: {d2}"


# ---------- PASSWORD RESET (safe / no admin reset) ----------
class TestPasswordReset:
    def test_generic_nonexistent(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": "nonexistent@x.com", "portal": "admin"})
        assert r.status_code == 200, r.text
        assert "message" in r.json()

    def test_generic_wrong_portal_for_admin(self):
        # admin email but customer portal: no send, generic 200
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL, "portal": "customer"})
        assert r.status_code == 200

    def test_admin_forgot_cooldown_and_wrong_otp_lock(self):
        # ONE legitimate forgot for admin portal — verify expires_in=300, resend_in=60
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL, "portal": "admin"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("expires_in") == 300, data
        assert data.get("resend_in") == 60, data
        # immediate second call → 429 cooldown
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL, "portal": "admin"})
        assert r2.status_code == 429, f"expected 429, got {r2.status_code}: {r2.text}"

        # Wrong OTP x5 → 4x 400 then 429 lock
        statuses = []
        for i in range(5):
            rr = requests.post(f"{API}/auth/reset-password",
                               json={"email": ADMIN_EMAIL, "portal": "admin", "code": "000000", "new_password": "DoesNot@Matter1"})
            statuses.append(rr.status_code)
        # Expect first 4 to be 400, last one 429 (lock)
        assert statuses[:4] == [400, 400, 400, 400], f"unexpected: {statuses}"
        assert statuses[4] == 429, f"expected lock 429 on 5th, got {statuses[4]}"

    def test_cleanup_otp_and_lock(self):
        # cleanup so owner is not locked out
        db.pwd_reset_otps.delete_many({"email": ADMIN_EMAIL})
        db.otp_locks.delete_many({"email": ADMIN_EMAIL})
        assert db.pwd_reset_otps.count_documents({"email": ADMIN_EMAIL}) == 0
        assert db.otp_locks.count_documents({"email": ADMIN_EMAIL}) == 0


# ---------- SESSION REVOCATION ----------
class TestLogoutAll:
    def test_logout_all_revokes_others_keeps_new(self):
        tok_a = _admin_login(ua="pytest-ua-A/1.0")
        tok_b = _admin_login(ua="pytest-ua-B/1.0")
        # both valid initially
        assert requests.get(f"{API}/auth/me", headers=_h(tok_a)).status_code == 200
        assert requests.get(f"{API}/auth/me", headers=_h(tok_b)).status_code == 200
        # logout-all using A → returns fresh token
        r = requests.post(f"{API}/security/logout-all", headers=_h(tok_a))
        assert r.status_code == 200, r.text
        new_tok = r.json().get("access_token") or r.json().get("token")
        assert new_tok, r.json()
        # A and B now invalid
        assert requests.get(f"{API}/auth/me", headers=_h(tok_a)).status_code == 401
        assert requests.get(f"{API}/auth/me", headers=_h(tok_b)).status_code == 401
        # new token works
        assert requests.get(f"{API}/auth/me", headers=_h(new_tok)).status_code == 200


# ---------- ADMIN DEVICES ----------
class TestAdminDevices:
    def test_devices_and_remove(self):
        # Two distinct UAs
        tok1 = _admin_login(ua="Mozilla/5.0 pytest-UA-One")
        _admin_login(ua="Mozilla/5.0 pytest-UA-Two")
        r = requests.get(f"{API}/security/status", headers=_h(tok1))
        assert r.status_code == 200, r.text
        data = r.json()
        devices = data.get("devices") or []
        assert len(devices) >= 1
        # remove one non-current device
        target = None
        for d in devices:
            if not d.get("current"):
                target = d
                break
        target = target or devices[0]
        fp = target.get("fingerprint")
        assert fp
        rd = requests.delete(f"{API}/security/devices/{fp}", headers=_h(tok1))
        assert rd.status_code == 200, rd.text
        # again -> 404
        rd2 = requests.delete(f"{API}/security/devices/{fp}", headers=_h(tok1))
        assert rd2.status_code == 404, rd2.text


# ---------- EMPLOYEE ----------
class TestEmployee:
    def test_employee_login_and_contact_403(self):
        r = requests.post(f"{API}/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})
        assert r.status_code == 200, r.text
        tok = r.json().get("access_token") or r.json().get("token")
        assert tok
        c = requests.get(f"{API}/admin/contact", headers=_h(tok))
        assert c.status_code == 403, c.status_code
