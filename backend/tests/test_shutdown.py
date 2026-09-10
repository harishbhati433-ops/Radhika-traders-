"""Backend tests for Website Shutdown Switch (maintenance mode)."""
import os
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASS = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PASS = "Test@1234"
TEST_CAMPAIGN_SLUG = "axis-mutual-fund-sip"


def _login(email, password, portal="customer"):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password, "portal": portal}, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PASS, "admin")
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _set_shutdown(admin_headers, enabled, message="", reopen_at="", password=ADMIN_PASS):
    body = {"enabled": enabled, "message": message, "reopen_at": reopen_at, "password": password}
    return requests.put(f"{API}/admin/shutdown", json=body, headers=admin_headers, timeout=15)


@pytest.fixture(autouse=True)
def _ensure_open_before(admin_headers):
    # ensure open before each test
    _set_shutdown(admin_headers, False, password=ADMIN_PASS)
    yield
    # ensure open after each test
    _set_shutdown(admin_headers, False, password=ADMIN_PASS)


class TestShutdownCycle:
    def test_public_status_initial(self):
        r = requests.get(f"{API}/status/public", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["active"] is False
        for k in ("message", "reopen_at", "since"):
            assert k in d

    def test_admin_get_shutdown(self, admin_headers):
        r = requests.get(f"{API}/admin/shutdown", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert r.json()["active"] is False

    def test_wrong_password_403(self, admin_headers):
        r = _set_shutdown(admin_headers, True, message="X", password="WRONG_PASS")
        assert r.status_code == 403
        assert "Incorrect admin password" in r.json().get("detail", "")
        # state unchanged
        s = requests.get(f"{API}/status/public", timeout=10).json()
        assert s["active"] is False

    def test_reopen_in_past_400(self, admin_headers):
        past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        r = _set_shutdown(admin_headers, True, message="past", reopen_at=past)
        assert r.status_code == 400

    def test_full_shutdown_cycle(self, admin_headers):
        # Get customer token BEFORE shutdown
        r = _login(CUST_EMAIL, CUST_PASS)
        assert r.status_code == 200, f"pre-shutdown customer login failed: {r.text}"
        cust_token = r.json()["token"]
        cust_headers = {"Authorization": f"Bearer {cust_token}"}

        # Enable shutdown with reopen 2h ahead
        reopen = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        r = _set_shutdown(admin_headers, True, message="Test maintenance", reopen_at=reopen)
        assert r.status_code == 200, r.text

        # Public status active true
        s = requests.get(f"{API}/status/public", timeout=10).json()
        assert s["active"] is True
        assert s["message"] == "Test maintenance"
        assert s["reopen_at"]

        # Customer login 503 shutdown
        r = _login(CUST_EMAIL, CUST_PASS)
        assert r.status_code == 503
        assert r.json()["detail"]["code"] == "shutdown"

        # Customer token /api/auth/me → 503
        r = requests.get(f"{API}/auth/me", headers=cust_headers, timeout=10)
        assert r.status_code == 503
        assert r.json()["detail"]["code"] == "shutdown"

        # Register → 503
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST_SD", "email": "TEST_shutdown_new@example.com",
            "mobile": "9999900001", "password": "Test@1234"
        }, timeout=10)
        assert r.status_code == 503

        # POST /api/leads/<slug> → 503
        r = requests.post(f"{API}/leads/{TEST_CAMPAIGN_SLUG}", json={"ref": "", "data": {"name": "X", "mobile": "9999900002"}}, timeout=10)
        assert r.status_code == 503

        # GET /api/go/<slug> → 302 to /maintenance
        r = requests.get(f"{API}/go/{TEST_CAMPAIGN_SLUG}", allow_redirects=False, timeout=10)
        assert r.status_code == 302
        assert r.headers.get("location", "").endswith("/maintenance")

        # Admin GET /api/admin/customers → 200
        r = requests.get(f"{API}/admin/customers", headers=admin_headers, timeout=10)
        assert r.status_code == 200

        # Admin login unaffected
        r = _login(ADMIN_EMAIL, ADMIN_PASS, "admin")
        assert r.status_code == 200

        # Turn OFF
        r = _set_shutdown(admin_headers, False)
        assert r.status_code == 200
        s = requests.get(f"{API}/status/public", timeout=10).json()
        assert s["active"] is False

        # Customer login works again
        r = _login(CUST_EMAIL, CUST_PASS)
        assert r.status_code == 200


class TestAutoReopen:
    def test_auto_reopen(self, admin_headers):
        reopen = (datetime.now(timezone.utc) + timedelta(seconds=70)).isoformat()
        r = _set_shutdown(admin_headers, True, message="Auto reopen test", reopen_at=reopen)
        assert r.status_code == 200, r.text
        s = requests.get(f"{API}/status/public", timeout=10).json()
        assert s["active"] is True

        # Wait ~75s
        time.sleep(80)

        s = requests.get(f"{API}/status/public", timeout=10).json()
        assert s["active"] is False, f"expected auto-reopen, got: {s}"

        # Customer login works
        r = _login(CUST_EMAIL, CUST_PASS)
        assert r.status_code == 200


class TestRegression:
    def test_go_redirect_partner_link(self, admin_headers):
        # Ensure OFF
        _set_shutdown(admin_headers, False)
        r = requests.get(f"{API}/go/{TEST_CAMPAIGN_SLUG}", allow_redirects=False, timeout=10)
        # 302 to lead form or partner link (not /maintenance)
        assert r.status_code == 302
        loc = r.headers.get("location", "")
        assert "/maintenance" not in loc

    def test_customer_login_ok(self, admin_headers):
        r = _login(CUST_EMAIL, CUST_PASS)
        assert r.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
