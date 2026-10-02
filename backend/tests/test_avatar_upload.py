"""Avatar upload backend tests (profile avatar_url, /api/upload image guard, HEIC accept)."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CUST_EMAIL = "testcust@example.com"
CUST_PASS = "Test@1234"


@pytest.fixture(scope="module")
def cust_token():
    r = requests.post(f"{API}/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASS})
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def cust_headers(cust_token):
    return {"Authorization": f"Bearer {cust_token}"}


PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00"
    b"\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x8d\x8d|"
    b"\xcb\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestAvatar:
    def test_login_me(self, cust_headers):
        r = requests.get(f"{API}/auth/me", headers=cust_headers)
        assert r.status_code == 200
        assert "avatar_url" in r.json()

    def test_profile_avatar_url_rejects_invalid_prefix(self, cust_headers):
        r = requests.put(f"{API}/profile", json={"avatar_url": "https://evil.com/x.png"}, headers=cust_headers)
        assert r.status_code == 400, r.text
        assert "photo" in r.text.lower() or "invalid" in r.text.lower()

    def test_upload_non_image_rejected(self, cust_headers):
        files = {"file": ("hack.txt", io.BytesIO(b"not an image"), "text/plain")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 400, r.text
        assert "image" in r.text.lower()

    def test_upload_png_accepted_and_profile_persists(self, cust_headers):
        files = {"file": ("avatar.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/")

        # save to profile
        r2 = requests.put(f"{API}/profile", json={"avatar_url": url}, headers=cust_headers)
        assert r2.status_code == 200, r2.text
        assert r2.json()["avatar_url"] == url

        # verify persistence via /me
        me = requests.get(f"{API}/auth/me", headers=cust_headers)
        assert me.status_code == 200
        assert me.json()["avatar_url"] == url

        # verify file is served
        f = requests.get(f"{BASE_URL}{url}")
        assert f.status_code == 200
        assert f.headers.get("content-type", "").startswith("image/")

    def test_heic_content_type_accepted(self, cust_headers):
        files = {"file": ("photo.heic", io.BytesIO(b"\x00\x00\x00\x20ftypheic" + b"\x00" * 32), "image/heic")}
        r = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("/api/files/")

    def test_remove_avatar(self, cust_headers):
        r = requests.put(f"{API}/profile", json={"avatar_url": ""}, headers=cust_headers)
        assert r.status_code == 200
        # after removal, avatar_url should be empty
        me = requests.get(f"{API}/auth/me", headers=cust_headers)
        # Re-upload for the final state (task says: leave with uploaded avatar)
        files = {"file": ("final.png", io.BytesIO(PNG_BYTES), "image/png")}
        up = requests.post(f"{API}/upload", files=files, headers=cust_headers)
        assert up.status_code == 200
        requests.put(f"{API}/profile", json={"avatar_url": up.json()["url"]}, headers=cust_headers)


class TestAdminCustomersAvatar:
    @pytest.fixture(scope="class")
    def admin_headers(self):
        r = requests.post(f"{API}/auth/login", json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})
        assert r.status_code == 200, r.text
        tok = r.json().get("access_token") or r.json().get("token")
        return {"Authorization": f"Bearer {tok}"}

    def test_admin_customers_list_has_avatar_field(self, admin_headers):
        r = requests.get(f"{API}/admin/customers", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("items") or data.get("customers") or []
        assert items, "no customers"
        testcust = next((c for c in items if c.get("email") == CUST_EMAIL), None)
        assert testcust is not None, "testcust not in list"
        assert "avatar_url" in testcust, f"avatar_url missing in admin customer row: {testcust.keys()}"
