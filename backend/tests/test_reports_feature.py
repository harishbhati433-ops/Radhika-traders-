"""
Backend tests for admin -> publishers Reports feature.
Covers: admin_send_report, admin_list_reports, admin_delete_report,
my_reports, download_report, _purge_expired_reports.
"""
import os
import io
import csv
import pytest
import requests
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://radhika-connect.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PASSWORD = "Radhika@2023"
CUST_EMAIL = "testcust@example.com"
CUST_PASSWORD = "Test@1234"

state = {}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": CUST_EMAIL, "password": CUST_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cust_id(cust_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {cust_token}"})
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def throwaway_user(cust_token, admin_token):
    """Create throwaway customer copying testcust password_hash and email_verified true."""
    async def _create():
        cli = AsyncIOMotorClient(MONGO_URL)
        d = cli[DB_NAME]
        src = await d.users.find_one({"email": CUST_EMAIL})
        assert src, "testcust source not found"
        email = "test_throwaway_reports@example.com"
        await d.users.delete_many({"email": email})
        doc = {"email": email, "name": "TEST Throwaway", "password_hash": src["password_hash"],
               "email_verified": True, "role": "customer", "mobile": "9000099000",
               "referral_code": "RTATHRW1", "account_status": "active", "kyc_status": "none",
               "created_at": datetime.now(timezone.utc).isoformat()}
        res = await d.users.insert_one(doc)
        cli.close()
        return str(res.inserted_id), email
    uid, email = asyncio.get_event_loop().run_until_complete(_create())
    yield {"id": uid, "email": email, "password": CUST_PASSWORD}
    # cleanup
    async def _del():
        cli = AsyncIOMotorClient(MONGO_URL)
        await cli[DB_NAME].users.delete_many({"email": email})
        cli.close()
    asyncio.get_event_loop().run_until_complete(_del())


@pytest.fixture(scope="module")
def throwaway_token(throwaway_user):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": throwaway_user["email"], "password": throwaway_user["password"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _csv_bytes():
    buf = io.StringIO()
    w = csv.writer(buf); w.writerow(["a", "b"]); w.writerow(["1", "2"])
    return buf.getvalue().encode()


# ---------- Send report ----------
class TestSendReport:
    def test_missing_title(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/reports",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("t.csv", _csv_bytes(), "text/csv")},
                          data={"note": "x", "audience": "all", "send_email": "false"})
        assert r.status_code in (400, 422)

    def test_selected_empty_userids(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/reports",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("t.csv", _csv_bytes(), "text/csv")},
                          data={"title": "TEST empty sel", "audience": "selected", "user_ids": "", "send_email": "false"})
        assert r.status_code == 400

    def test_send_selected(self, admin_token, cust_id):
        payload = _csv_bytes()
        state["payload"] = payload
        r = requests.post(f"{BASE_URL}/api/admin/reports",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("qa_report.csv", payload, "text/csv")},
                          data={"title": "QA Report", "note": "hello", "audience": "selected", "user_ids": cust_id, "send_email": "false"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "Report sent to 1 publisher" == data["message"]
        assert data["recipients"] == 1
        assert "id" in data and "expires_at" in data
        exp = datetime.fromisoformat(data["expires_at"])
        diff = (exp - datetime.now(timezone.utc)).total_seconds()
        assert 6.5 * 86400 < diff < 7.5 * 86400
        state["rid"] = data["id"]
        state["expires_at"] = data["expires_at"]


class TestAdminList:
    def test_admin_list_contains(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        row = next((x for x in r.json() if x["id"] == state["rid"]), None)
        assert row is not None
        assert row["audience"] == "selected"
        assert row["recipient_count"] == 1
        assert row["download_count"] == 0


class TestCustomerViewAndDownload:
    def test_testcust_sees_report(self, cust_token):
        r = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {cust_token}"})
        assert r.status_code == 200
        row = next((x for x in r.json() if x["id"] == state["rid"]), None)
        assert row is not None
        assert row["downloaded"] is False
        assert row["title"] == "QA Report"

    def test_throwaway_does_not_see(self, throwaway_token):
        r = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {throwaway_token}"})
        assert r.status_code == 200
        assert not any(x["id"] == state["rid"] for x in r.json())

    def test_download_by_testcust(self, cust_token):
        r = requests.get(f"{BASE_URL}/api/reports/{state['rid']}/download", headers={"Authorization": f"Bearer {cust_token}"})
        assert r.status_code == 200
        assert r.content == state["payload"]
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        assert "qa_report.csv" in cd

    def test_report_downloaded_flag(self, cust_token):
        r = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {cust_token}"})
        row = next(x for x in r.json() if x["id"] == state["rid"])
        assert row["downloaded"] is True

    def test_admin_download_count_increment(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/reports", headers={"Authorization": f"Bearer {admin_token}"})
        row = next(x for x in r.json() if x["id"] == state["rid"])
        assert row["download_count"] == 1

    def test_throwaway_download_404(self, throwaway_token):
        r = requests.get(f"{BASE_URL}/api/reports/{state['rid']}/download", headers={"Authorization": f"Bearer {throwaway_token}"})
        assert r.status_code == 404

    def test_notification_for_testcust(self, cust_token):
        r = requests.get(f"{BASE_URL}/api/notifications", headers={"Authorization": f"Bearer {cust_token}"})
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert any("New report: QA Report" in n.get("title", "") for n in items)


class TestExpiryAndDelete:
    def test_expiry_purges(self, cust_token):
        async def _expire():
            cli = AsyncIOMotorClient(MONGO_URL); d = cli[DB_NAME]
            from bson import ObjectId
            await d.reports.update_one({"_id": ObjectId(state["rid"])}, {"$set": {"expires_at": "2020-01-01T00:00:00+00:00"}})
            cli.close()
        asyncio.get_event_loop().run_until_complete(_expire())
        r = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {cust_token}"})
        assert r.status_code == 200
        assert not any(x["id"] == state["rid"] for x in r.json())

        async def _check():
            cli = AsyncIOMotorClient(MONGO_URL); d = cli[DB_NAME]
            from bson import ObjectId
            rep = await d.reports.find_one({"_id": ObjectId(state["rid"])})
            # find file
            files_col_deleted = None
            cli.close()
            return rep
        rep = asyncio.get_event_loop().run_until_complete(_check())
        assert rep is None

    def test_file_marked_deleted(self):
        async def _q():
            cli = AsyncIOMotorClient(MONGO_URL); d = cli[DB_NAME]
            # find a file recently marked deleted
            cnt = await d.files.count_documents({"is_deleted": True})
            cli.close()
            return cnt
        assert asyncio.get_event_loop().run_until_complete(_q()) >= 1

    def test_delete_fresh_report(self, admin_token, cust_id, cust_token):
        r = requests.post(f"{BASE_URL}/api/admin/reports",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("t2.csv", _csv_bytes(), "text/csv")},
                          data={"title": "TEST del me", "audience": "selected", "user_ids": cust_id, "send_email": "false"})
        assert r.status_code == 200
        rid = r.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/admin/reports/{rid}", headers={"Authorization": f"Bearer {admin_token}"})
        assert r2.status_code == 200
        r3 = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {cust_token}"})
        assert not any(x["id"] == rid for x in r3.json())


class TestAudienceAll:
    def test_all_visible_to_both(self, admin_token, cust_token, throwaway_token):
        r = requests.post(f"{BASE_URL}/api/admin/reports",
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files={"file": ("all.csv", _csv_bytes(), "text/csv")},
                          data={"title": "TEST all audience", "audience": "all", "send_email": "false"})
        assert r.status_code == 200
        rid = r.json()["id"]
        for tok in (cust_token, throwaway_token):
            r2 = requests.get(f"{BASE_URL}/api/reports", headers={"Authorization": f"Bearer {tok}"})
            assert any(x["id"] == rid for x in r2.json())
        # cleanup
        requests.delete(f"{BASE_URL}/api/admin/reports/{rid}", headers={"Authorization": f"Bearer {admin_token}"})
