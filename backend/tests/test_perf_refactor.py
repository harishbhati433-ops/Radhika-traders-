"""Backend regression tests for Jan 2026 performance refactor.

Covers:
- GET /api/admin/kyc paginated shape + counts + status filter + out-of-range + limit clamp
- GET /api/wallet keys for customer
- GET /api/admin/dashboard keys
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"}
CUSTOMER = {"email": "testcust@example.com", "password": "Test@1234"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_token():
    r = requests.post(f"{API}/auth/login", json=CUSTOMER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def cust_h(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


# ---------- /api/admin/kyc pagination ----------
class TestAdminKycPagination:
    def test_kyc_default_shape(self, admin_h):
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["items", "page", "pages", "total", "limit", "counts"]:
            assert k in d, f"missing key {k}"
        # Backend returns only statuses with >0; treat missing as 0.
        assert isinstance(d["counts"], dict)
        assert isinstance(d["items"], list)
        assert d["page"] == 1
        assert d["limit"] == 25

    def test_kyc_status_verified_total_matches_count(self, admin_h):
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, params={"status": "verified"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == d["counts"]["verified"]

    def test_kyc_status_pending(self, admin_h):
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, params={"status": "pending"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == d["counts"].get("pending", 0)

    def test_kyc_page_out_of_range(self, admin_h):
        base = requests.get(f"{API}/admin/kyc", headers=admin_h, timeout=15).json()
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, params={"page": 999}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["items"] == []
        assert d["total"] == base["total"]

    def test_kyc_limit_clamped_low(self, admin_h):
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, params={"limit": 1}, timeout=15)
        assert r.status_code == 200
        assert r.json()["limit"] == 10

    def test_kyc_limit_clamped_high(self, admin_h):
        r = requests.get(f"{API}/admin/kyc", headers=admin_h, params={"limit": 500}, timeout=15)
        assert r.status_code == 200
        assert r.json()["limit"] == 200


# ---------- /api/wallet ----------
class TestWallet:
    def test_wallet_keys(self, cust_h):
        r = requests.get(f"{API}/wallet", headers=cust_h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["balance", "total_earnings", "total_credited", "total_withdrawn", "pending_withdrawal", "bonus_locked"]:
            assert k in d, f"missing wallet key {k}"


# ---------- /api/admin/dashboard ----------
class TestAdminDashboard:
    def test_admin_dashboard_keys(self, admin_h):
        r = requests.get(f"{API}/admin/dashboard", headers=admin_h, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "total_campaigns", "total_customers", "total_wallet_balance",
            "total_pending_withdrawal_amount", "total_paid_amount", "total_payable",
            "total_earnings", "withdrawals_total", "recent_campaigns",
        ]:
            assert k in d, f"missing dashboard key {k}"
