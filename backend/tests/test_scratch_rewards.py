"""Scratch Card + Extra Bonus end-to-end tests (preview API)."""
import os
import json
import random
import time
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE_URL = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0]
HEADERS = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 qa-tests"}

ADMIN = {"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"}
CUST = {"email": "scratchtest@example.com", "password": "Test@1234"}
LEGACY = {"email": "testcust@example.com", "password": "Test@1234"}
SLUG = "axis-mutual-fund-sip"
REF = "RTSCR001"


def _env(k):
    for l in open("/app/backend/.env"):
        if l.startswith(k + "="):
            return l.split("=", 1)[1].strip().strip('"')
    return None


MONGO = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]


def api(method, path, body=None, token=None, allow_err=True):
    h = dict(HEADERS)
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = requests.request(method, BASE_URL + path, json=body, headers=h, timeout=30)
    if r.status_code >= 400:
        if allow_err:
            try:
                d = r.json()
            except Exception:
                d = {"text": r.text}
            return {"err": r.status_code, "detail": d.get("detail") if isinstance(d, dict) else d}
        r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def tokens():
    adm = api("POST", "/api/auth/login", ADMIN)
    cus = api("POST", "/api/auth/login", CUST)
    leg = api("POST", "/api/auth/login", LEGACY)
    assert "token" in adm, adm
    assert "token" in cus, cus
    return {"adm": adm["token"], "cus": cus["token"], "leg": leg.get("token")}


@pytest.fixture(scope="module")
def me(tokens):
    return {"cus": api("GET", "/api/auth/me", token=tokens["cus"]),
            "leg": api("GET", "/api/auth/me", token=tokens["leg"]) if tokens["leg"] else None}


@pytest.fixture(scope="module")
def campaign():
    cs = api("GET", "/api/campaigns")
    for c in cs:
        if c["slug"] == SLUG:
            return c
    pytest.skip(f"campaign {SLUG} not found")


def _reset_settings(tok):
    return api("PUT", "/api/admin/rewards/settings",
               {"extra_bonus_percent": 5, "scratch_enabled": True, "scratch_mode": "fixed", "scratch_amount": 20}, token=tok)


def _mk_lead(ref=REF):
    m = "9" + str(random.randint(100000000, 999999999))
    body = {"ref": ref, "data": {"name": "QA Scratch", "mobile": m, "email": f"qa{m}@x.com"}}
    r = api("POST", f"/api/leads/{SLUG}", body)
    assert "id" in r, r
    return r


# ---------------- settings ----------------
class TestSettings:
    def test_reset_defaults(self, tokens):
        s = _reset_settings(tokens["adm"])
        assert s["extra_bonus_percent"] == 5
        assert s["scratch_enabled"] is True
        assert s["scratch_mode"] == "fixed"
        assert s["scratch_amount"] == 20

    def test_invalid_percent(self, tokens):
        r = api("PUT", "/api/admin/rewards/settings", {"extra_bonus_percent": 150}, token=tokens["adm"])
        assert r.get("err") == 400, r

    def test_invalid_mode(self, tokens):
        r = api("PUT", "/api/admin/rewards/settings", {"scratch_mode": "xyz"}, token=tokens["adm"])
        assert r.get("err") == 400, r

    def test_negative_amount(self, tokens):
        r = api("PUT", "/api/admin/rewards/settings", {"scratch_amount": -5}, token=tokens["adm"])
        assert r.get("err") == 400, r


# ---------------- happy path ----------------
class TestHappyPath:
    @pytest.fixture(scope="class")
    def ctx(self, tokens, campaign):
        _reset_settings(tokens["adm"])
        w0 = api("GET", "/api/wallet", token=tokens["cus"])
        if w0.get("bonus_locked", 0) <= 0:
            pytest.skip("no locked bonus for scratchtest")
        return {"w0": w0, "camp": campaign}

    def test_wallet_shows_signup_bonus(self, ctx):
        w = ctx["w0"]
        assert w["bonus_total"] >= 200
        assert w["bonus_locked"] > 0
        assert w["signup_bonus"]["status"] in ("locked",)
        for k in ("total", "released", "remaining"):
            assert k in w["signup_bonus"]

    def test_approve_credits_extra_and_card(self, tokens, ctx):
        lead = _mk_lead()
        ctx["lead_id"] = lead["id"]
        r = api("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        exp = round(ctx["camp"]["payout_amount"] * 0.05, 2)
        assert rw.get("extra") == exp, rw
        assert rw.get("card"), rw
        ctx["expected_extra"] = exp
        w1 = api("GET", "/api/wallet", token=tokens["cus"])
        assert abs(w1["balance"] - ctx["w0"]["balance"] - exp) < 0.01
        ctx["w1"] = w1

    def test_idempotent_reapprove(self, tokens, ctx):
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("extra") in (0, 0.0, None)
        assert not rw.get("card")
        w = api("GET", "/api/wallet", token=tokens["cus"])
        assert abs(w["balance"] - ctx["w1"]["balance"]) < 0.01

    def test_scratch_card_release(self, tokens, ctx):
        cards = api("GET", "/api/scratch-cards", token=tokens["cus"])
        mine = [c for c in cards["cards"] if c["lead_id"] == ctx["lead_id"] and c["status"] == "issued"]
        assert len(mine) == 1
        card = mine[0]
        assert card["amount"] == 20
        ctx["card_id"] = card["id"]
        s = api("POST", f"/api/scratch-cards/{card['id']}/scratch", token=tokens["cus"])
        assert s.get("amount") == 20
        assert "bonus" in s
        s2 = api("POST", f"/api/scratch-cards/{card['id']}/scratch", token=tokens["cus"])
        assert s2.get("err") == 400
        assert "already" in str(s2.get("detail", "")).lower()
        w2 = api("GET", "/api/wallet", token=tokens["cus"])
        assert abs(w2["balance"] - ctx["w1"]["balance"] - 20) < 0.01
        assert abs(ctx["w1"]["bonus_locked"] - w2["bonus_locked"] - 20) < 0.01
        ctx["w2"] = w2

    def test_transactions_show_xb_and_sc(self, tokens, ctx):
        txns = api("GET", "/api/wallet/transactions", token=tokens["cus"])
        items = txns if isinstance(txns, list) else txns.get("transactions", txns.get("items", []))
        refs = [t.get("ref_id", "") for t in items]
        assert any(str(r).startswith("XB-") for r in refs), refs[:10]
        assert any(str(r).startswith("SC-") for r in refs), refs[:10]

    # reversal
    def test_reject_reverses_scratched_and_extra(self, tokens, ctx):
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "rejected", "reject_reason": "sim"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("reversed") == 20, rw
        assert rw.get("extra_reversed") == 25, rw
        assert rw.get("pending", 0) == 0
        w3 = api("GET", "/api/wallet", token=tokens["cus"])
        assert abs(w3["balance"] - ctx["w0"]["balance"]) < 0.01
        assert abs(w3["bonus_locked"] - ctx["w0"]["bonus_locked"]) < 0.01

    def test_idempotent_reject(self, tokens, ctx):
        before = api("GET", "/api/wallet", token=tokens["cus"])["balance"]
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "rejected"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        # No further debits/pending
        assert not rw.get("reversed")
        assert not rw.get("extra_reversed")
        after = api("GET", "/api/wallet", token=tokens["cus"])["balance"]
        assert abs(after - before) < 0.01

    def test_reapprove_fresh_card(self, tokens, ctx):
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("extra") == 25
        assert rw.get("card")
        cards = api("GET", "/api/scratch-cards", token=tokens["cus"])
        issued = [c for c in cards["cards"] if c["lead_id"] == ctx["lead_id"] and c["status"] == "issued"]
        assert len(issued) == 1

    def test_pending_cancels_card(self, tokens, ctx):
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "pending"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("cancelled", 0) >= 1 or rw.get("extra_reversed") == 25
        cards = api("GET", "/api/scratch-cards", token=tokens["cus"])
        # cancelled cards must NOT appear in customer list
        for c in cards["cards"]:
            assert c["status"] in ("issued", "scratched")
        w = api("GET", "/api/wallet", token=tokens["cus"])
        assert abs(w["balance"] - ctx["w0"]["balance"]) < 0.01


# ---------------- pending adjustment ----------------
class TestPendingAdjustment:
    @pytest.fixture(scope="class")
    def ctx(self, tokens, me):
        _reset_settings(tokens["adm"])
        uid = me["cus"]["id"]
        return {"uid": uid, "sim_debit_id": None, "lead_id": None, "lead2_id": None}

    def test_setup_approve_and_scratch(self, tokens, ctx):
        lead = _mk_lead()
        ctx["lead_id"] = lead["id"]
        r = api("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("card"), rw
        cards = api("GET", "/api/scratch-cards", token=tokens["cus"])
        card = [c for c in cards["cards"] if c["lead_id"] == lead["id"] and c["status"] == "issued"][0]
        s = api("POST", f"/api/scratch-cards/{card['id']}/scratch", token=tokens["cus"])
        assert s.get("amount") == 20
        ctx["pre_bal"] = api("GET", "/api/wallet", token=tokens["cus"])["balance"]

    def test_simulate_zero_balance_and_reject(self, tokens, ctx):
        bal = api("GET", "/api/wallet", token=tokens["cus"])["balance"]
        if bal > 0:
            r = MONGO.transactions.insert_one({
                "user_id": ctx["uid"], "amount": bal, "type": "debit", "status": "completed",
                "source": "qa_sim", "description": "QA sim withdraw", "ref_id": f"QA-{int(time.time())}",
                "created_at": "2026-01-01T00:00:00+00:00"})
            ctx["sim_debit_id"] = r.inserted_id
        w = api("GET", "/api/wallet", token=tokens["cus"])
        assert w["balance"] <= 0.01
        r = api("PATCH", f"/api/admin/leads/{ctx['lead_id']}", {"status": "rejected", "reject_reason": "sim"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        assert rw.get("pending", 0) > 0, rw
        ctx["pending"] = rw["pending"]
        w2 = api("GET", "/api/wallet", token=tokens["cus"])
        assert w2["balance"] >= -0.01, f"balance must not go negative: {w2['balance']}"

    def test_adjustment_appears_in_admin(self, tokens, ctx):
        rew = api("GET", "/api/admin/rewards", token=tokens["adm"])
        opens = [a for a in rew["adjustments"] if a.get("status") == "open" and a.get("user_id") == ctx["uid"]]
        assert opens, "expected open adjustment"
        ctx["adj"] = opens[0]
        assert ctx["adj"]["remaining"] > 0

    def test_auto_recovery_on_next_credit(self, tokens, ctx):
        lead = _mk_lead()
        ctx["lead2_id"] = lead["id"]
        before_remaining = ctx["adj"]["remaining"]
        api("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, token=tokens["adm"])
        rew = api("GET", "/api/admin/rewards", token=tokens["adm"])
        a = next((a for a in rew["adjustments"] if a["id"] == ctx["adj"]["id"]), None)
        assert a, "adjustment missing"
        assert a["remaining"] < before_remaining, (before_remaining, a["remaining"])

    def test_waive_remaining(self, tokens, ctx):
        rew = api("GET", "/api/admin/rewards", token=tokens["adm"])
        a = next((a for a in rew["adjustments"] if a["id"] == ctx["adj"]["id"]), None)
        if a and a["status"] == "open":
            r = api("POST", f"/api/admin/rewards/adjustments/{a['id']}/settle", {}, token=tokens["adm"])
            assert r.get("ok")
            rew2 = api("GET", "/api/admin/rewards", token=tokens["adm"])
            a2 = next(x for x in rew2["adjustments"] if x["id"] == a["id"])
            assert a2["status"] == "waived"

    def test_cleanup(self, tokens, ctx):
        # delete qa_sim debit
        if ctx.get("sim_debit_id"):
            MONGO.transactions.delete_one({"_id": ctx["sim_debit_id"]})
        # reject lead2 to restore
        if ctx.get("lead2_id"):
            api("PATCH", f"/api/admin/leads/{ctx['lead2_id']}", {"status": "rejected", "reject_reason": "sim-cleanup"}, token=tokens["adm"])


# ---------------- exhaustion ----------------
class TestExhaustion:
    def test_cap_and_release_then_restore(self, tokens, campaign):
        _reset_settings(tokens["adm"])
        w0 = api("GET", "/api/wallet", token=tokens["cus"])
        remaining = w0["bonus_locked"]
        if remaining <= 0:
            pytest.skip("no locked bonus")
        # Set scratch_amount huge
        api("PUT", "/api/admin/rewards/settings", {"scratch_amount": 500}, token=tokens["adm"])
        lead1 = _mk_lead()
        r = api("PATCH", f"/api/admin/leads/{lead1['id']}", {"status": "approved"}, token=tokens["adm"])
        card_id = r.get("rewards", {}).get("card")
        assert card_id, r
        # outstanding cards earlier may already exist; check this card amount == room left
        cards = api("GET", "/api/scratch-cards", token=tokens["cus"])
        card = next(c for c in cards["cards"] if c["id"] == card_id)
        # the card should equal remaining locked room, not 500
        assert card["amount"] <= remaining
        assert card["amount"] < 500
        # scratch it
        api("POST", f"/api/scratch-cards/{card_id}/scratch", token=tokens["cus"])
        w = api("GET", "/api/wallet", token=tokens["cus"])
        # if there were pre-existing issued cards remaining > 0, status may still be locked. Only check <=
        assert w["bonus_locked"] <= remaining - card["amount"] + 0.01

        # another lead should get skipped=exhausted ONLY if remaining == 0
        lead2 = _mk_lead()
        r2 = api("PATCH", f"/api/admin/leads/{lead2['id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r2.get("rewards", {})
        if w["bonus_locked"] <= 0:
            assert rw.get("skipped") == "exhausted", rw
            assert w["signup_bonus"]["status"] == "released"
        # cleanup: reject both leads to restore
        api("PATCH", f"/api/admin/leads/{lead1['id']}", {"status": "rejected", "reject_reason": "cap-test"}, token=tokens["adm"])
        api("PATCH", f"/api/admin/leads/{lead2['id']}", {"status": "rejected", "reject_reason": "cap-test"}, token=tokens["adm"])
        _reset_settings(tokens["adm"])


# ---------------- legacy regression ----------------
class TestLegacy:
    def test_legacy_customer_no_extra(self, tokens, me):
        if not me.get("leg"):
            pytest.skip("legacy customer not available")
        _reset_settings(tokens["adm"])
        legref = me["leg"]["referral_code"]
        m = "9" + str(random.randint(100000000, 999999999))
        lead = api("POST", f"/api/leads/{SLUG}", {"ref": legref, "data": {"name": "Legacy QA", "mobile": m, "email": f"lg{m}@x.com"}})
        if "id" not in lead:
            pytest.skip(f"could not create legacy lead: {lead}")
        w0 = api("GET", "/api/wallet", token=tokens["leg"])
        r = api("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, token=tokens["adm"])
        rw = r.get("rewards", {})
        # legacy customer: either no_bonus skip or no extra credited
        assert rw.get("skipped") in ("no_bonus", "exhausted", "duplicate", None) or (not rw.get("extra") and not rw.get("card")), rw
        w1 = api("GET", "/api/wallet", token=tokens["leg"])
        # No extra bonus should be credited for a legacy user with no locked bonus
        assert abs(w1["balance"] - w0["balance"]) < 0.01, (w0["balance"], w1["balance"])
        # cleanup
        api("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected", "reject_reason": "qa-legacy"}, token=tokens["adm"])


# ---------------- admin rewards view ----------------
class TestAdminRewardsView:
    def test_shape(self, tokens):
        rew = api("GET", "/api/admin/rewards", token=tokens["adm"])
        for k in ("settings", "users", "cards", "extra_txns", "adjustments"):
            assert k in rew
        row = next((u for u in rew["users"] if "Scratch" in (u.get("name") or "")), None)
        assert row, "Scratch Tester row expected"
        for k in ("total", "released", "remaining", "extra_bonus_total", "cards_issued", "cards_scratched", "cards_pending"):
            assert k in row

    def test_final_reset(self, tokens):
        s = _reset_settings(tokens["adm"])
        assert s["extra_bonus_percent"] == 5
        assert s["scratch_amount"] == 20
        assert s["scratch_enabled"] is True
