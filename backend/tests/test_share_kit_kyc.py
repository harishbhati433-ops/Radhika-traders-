"""Backend tests for Share Kit (poster/QR) + strict KYC IFSC/UPI validation.

Coverage:
- GET /api/share/qr (auth, valid/invalid URL)
- GET /api/share/poster/{slug} (auth, unknown slug -> 404, PNG 1080x1080 >10KB)
- PUT /api/profile/kyc rejects invalid IFSC / UPI with 400
"""
import io
import os
import pytest
import requests
from PIL import Image

def _read_env():
    p = "/app/frontend/.env"
    with open(p) as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or _read_env()
CUST_EMAIL = "testcust@example.com"
CUST_PASS = "Test@1234"
SLUG = "axis-mutual-fund-sip"


@pytest.fixture(scope="module")
def cust_token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_headers(cust_token):
    return {"Authorization": f"Bearer {cust_token}"}


@pytest.fixture(scope="module")
def current_kyc(cust_headers):
    r = requests.get(f"{BASE}/api/auth/me", headers=cust_headers)
    assert r.status_code == 200, r.text
    me = r.json()
    return {"kyc": me.get("kyc", {}), "bank": me.get("bank", {})}


@pytest.fixture(scope="module")
def live_slug(cust_headers):
    # Prefer axis-mutual-fund-sip; fall back to first live campaign
    r = requests.get(f"{BASE}/api/campaigns/{SLUG}")
    if r.status_code == 200:
        return SLUG
    r = requests.get(f"{BASE}/api/campaigns")
    if r.status_code == 200 and r.json():
        return r.json()[0]["slug"]
    return SLUG


# ---------- Share QR ----------
class TestShareQR:
    def test_qr_requires_auth(self):
        r = requests.get(f"{BASE}/api/share/qr", params={"url": "https://example.com/x"})
        assert r.status_code in (401, 403)

    def test_qr_ok(self, cust_headers):
        r = requests.get(f"{BASE}/api/share/qr", params={"url": "https://example.com/x", "size": 400}, headers=cust_headers)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/png")
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (400, 400)

    def test_qr_invalid_url(self, cust_headers):
        r = requests.get(f"{BASE}/api/share/qr", params={"url": "notaurl"}, headers=cust_headers)
        assert r.status_code == 400


# ---------- Share Poster ----------
class TestSharePoster:
    def test_poster_requires_auth(self, live_slug):
        r = requests.get(f"{BASE}/api/share/poster/{live_slug}")
        assert r.status_code in (401, 403)

    def test_poster_unknown_slug_404(self, cust_headers):
        r = requests.get(f"{BASE}/api/share/poster/does-not-exist-xyz", headers=cust_headers)
        assert r.status_code == 404

    def test_poster_ok(self, cust_headers, live_slug):
        r = requests.get(f"{BASE}/api/share/poster/{live_slug}", headers=cust_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/png")
        assert len(r.content) > 10_000, f"Poster too small: {len(r.content)} bytes"
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (1080, 1080), f"Unexpected poster size {img.size}"


# ---------- KYC strict IFSC / UPI ----------
class TestKycValidation:
    def _payload(self, current_kyc, **override):
        kyc = current_kyc["kyc"] or {}
        bank = current_kyc["bank"] or {}
        base = {
            "pan": kyc.get("pan") or "TSTCU1234F",
            "aadhaar": kyc.get("aadhaar") or "",
            "account_holder": bank.get("account_holder") or "Test Customer",
            "bank_account": bank.get("bank_account") or "123456789012",
            "bank_account_confirm": bank.get("bank_account") or "123456789012",
            "ifsc": bank.get("ifsc") or "HDFC0001234",
            "upi": bank.get("upi") or "",
        }
        base.update(override)
        return base

    def test_short_ifsc_rejected(self, cust_headers, current_kyc):
        body = self._payload(current_kyc, ifsc="HDFC")
        r = requests.put(f"{BASE}/api/profile/kyc", json=body, headers=cust_headers)
        assert r.status_code == 400
        assert "IFSC" in r.json().get("detail", "")

    def test_bad_ifsc_rejected(self, cust_headers, current_kyc):
        body = self._payload(current_kyc, ifsc="HDFC1001234")  # 5th char must be 0
        r = requests.put(f"{BASE}/api/profile/kyc", json=body, headers=cust_headers)
        assert r.status_code == 400
        assert "IFSC" in r.json().get("detail", "")

    def test_bad_upi_rejected(self, cust_headers, current_kyc):
        body = self._payload(current_kyc, upi="abc")
        r = requests.put(f"{BASE}/api/profile/kyc", json=body, headers=cust_headers)
        assert r.status_code == 400
        assert "UPI" in r.json().get("detail", "")
