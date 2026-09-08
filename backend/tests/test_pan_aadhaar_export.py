"""Tests for PAN/Aadhaar validation in Lead API and Admin Leads Export (xlsx/csv)."""
import io
import os
import re
import pytest
import requests
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fall back to frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MONGO = MongoClient(os.environ["MONGO_URL"])
DB = MONGO[os.environ["DB_NAME"]]

SLUG = "axis-mutual-fund-sip"
REF = "RTA12499"
ADMIN_EMAIL = "bhatiharish276@gmail.com"
ADMIN_PW = "Radhika@2023"


@pytest.fixture(scope="module")
def admin_token():
    # Clear any lock for this admin
    DB.login_attempts.delete_many({"email": ADMIN_EMAIL})
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW, "portal": "admin"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def enable_aadhaar():
    """Temporarily enable aadhaar field on campaign, restore after."""
    yield
    # Nothing to do here; enabled/disabled per test


# --- Lead PAN validation ---
class TestLeadPan:
    def test_lowercase_pan_stored_uppercase(self):
        mobile = "9555500001"
        DB.leads.delete_many({"mobile": mobile})
        payload = {"ref": REF, "data": {"name": "X Test", "mobile": mobile, "email": "x@t.com", "pan": "abcde1234f"}}
        r = requests.post(f"{BASE_URL}/api/leads/{SLUG}", json=payload)
        assert r.status_code == 200, r.text
        lead = DB.leads.find_one({"mobile": mobile})
        assert lead is not None
        assert lead["data"]["pan"] == "ABCDE1234F"
        DB.leads.delete_many({"mobile": mobile})

    def test_invalid_pan_rejected(self):
        payload = {"ref": REF, "data": {"name": "X", "mobile": "9555500002", "email": "x@t.com", "pan": "ABC12"}}
        r = requests.post(f"{BASE_URL}/api/leads/{SLUG}", json=payload)
        assert r.status_code == 400
        assert "PAN" in r.json().get("detail", "")


# --- Lead Aadhaar validation (enable field temporarily) ---
class TestLeadAadhaar:
    @pytest.fixture(autouse=True)
    def toggle_aadhaar(self):
        DB.campaigns.update_one(
            {"slug": SLUG},
            {"$set": {"lead_fields.$[f].enabled": True}},
            array_filters=[{"f.key": "aadhaar"}],
        )
        yield
        DB.campaigns.update_one(
            {"slug": SLUG},
            {"$set": {"lead_fields.$[f].enabled": False}},
            array_filters=[{"f.key": "aadhaar"}],
        )

    def test_aadhaar_5_digits_rejected(self):
        payload = {"ref": REF, "data": {"name": "X", "mobile": "9555500003", "email": "x@t.com", "pan": "ABCDE1234F", "aadhaar": "12345"}}
        r = requests.post(f"{BASE_URL}/api/leads/{SLUG}", json=payload)
        assert r.status_code == 400
        assert "12 digits" in r.json().get("detail", "")

    def test_aadhaar_12_digits_ok(self):
        mobile = "9555500004"
        DB.leads.delete_many({"mobile": mobile})
        payload = {"ref": REF, "data": {"name": "X", "mobile": mobile, "email": "x@t.com", "pan": "ABCDE1234F", "aadhaar": "123456789012"}}
        r = requests.post(f"{BASE_URL}/api/leads/{SLUG}", json=payload)
        assert r.status_code == 200, r.text
        lead = DB.leads.find_one({"mobile": mobile})
        assert lead["data"]["aadhaar"] == "123456789012"
        DB.leads.delete_many({"mobile": mobile})


# --- Admin Leads Export ---
class TestAdminLeadsExport:
    def test_export_xlsx_all(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/leads/export?format=xlsx", headers=h)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        cd = r.headers.get("Content-Disposition", "")
        assert "radhika_leads_all_to_all.xlsx" in cd, cd
        df = pd.read_excel(io.BytesIO(r.content))
        for col in ["Lead ID", "Date", "Campaign", "Lead Status", "Account Status", "Referred By (Partner)", "Full Name", "Mobile Number", "PAN Number"]:
            assert col in df.columns, f"Missing column: {col} in {list(df.columns)}"
        # Row count matches GET /admin/leads
        r2 = requests.get(f"{BASE_URL}/api/admin/leads", headers=h)
        assert r2.status_code == 200
        assert len(df) == len(r2.json()), f"xlsx rows {len(df)} vs api {len(r2.json())}"

    def test_export_csv_all(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/leads/export?format=csv", headers=h)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        first_line = r.text.splitlines()[0]
        for col in ["Lead ID", "Date", "Campaign", "Lead Status", "Account Status", "Referred By (Partner)"]:
            assert col in first_line, f"Missing column {col}"

    def test_export_date_range_no_leads(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/admin/leads/export?format=xlsx&date_from=2020-01-01&date_to=2020-01-02", headers=h)
        assert r.status_code == 200
        df = pd.read_excel(io.BytesIO(r.content))
        assert len(df) == 0

    def test_export_date_range_specific(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        # find any date that has leads
        r_all = requests.get(f"{BASE_URL}/api/admin/leads", headers=h).json()
        if not r_all:
            pytest.skip("No leads to test date filter")
        target_date = (r_all[0].get("created_at") or "")[:10]
        r_api = requests.get(f"{BASE_URL}/api/admin/leads?date_from={target_date}&date_to={target_date}", headers=h).json()
        r_exp = requests.get(f"{BASE_URL}/api/admin/leads/export?format=xlsx&date_from={target_date}&date_to={target_date}", headers=h)
        df = pd.read_excel(io.BytesIO(r_exp.content))
        assert len(df) == len(r_api)
        for d in df["Date"].astype(str).tolist():
            assert d == target_date, f"Row date {d} != {target_date}"
