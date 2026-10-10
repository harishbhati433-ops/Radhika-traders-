"""End-to-end simulation of Scratch Card + extra bonus flow against the live preview API."""
import json
import os
import random
import sys
import urllib.request

API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0]
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 qa"}


def req(m, p, b=None, tok=None):
    r = urllib.request.Request(API + p, method=m, data=json.dumps(b).encode() if b is not None else None, headers={**H, **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        return {"err": e.code, "detail": json.loads(e.read().decode() or "{}").get("detail")}


adm = req("POST", "/api/auth/login", {"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})["token"]
cus = req("POST", "/api/auth/login", {"email": "scratchtest@example.com", "password": "Test@1234"})["token"]
me = req("GET", "/api/auth/me", tok=cus)
slug = "axis-mutual-fund-sip"
camp = [c for c in req("GET", "/api/campaigns") if c["slug"] == slug][0]
print("campaign payout:", camp["payout_amount"])
print("settings:", req("PUT", "/api/admin/rewards/settings", {"extra_bonus_percent": 5, "scratch_enabled": True, "scratch_mode": "fixed", "scratch_amount": 20}, tok=adm))

w0 = req("GET", "/api/wallet", tok=cus)
print("wallet before:", {k: w0[k] for k in ("balance", "bonus_locked", "bonus_total", "bonus_released")}, w0["signup_bonus"]["status"])
if w0["bonus_locked"] <= 0:
    print("!! test customer has no locked bonus — cannot test release; exiting"); sys.exit(0)

m = "9" + str(random.randint(100000000, 999999999))
lead = req("POST", f"/api/leads/{slug}", {"ref": me["referral_code"], "data": {"name": "Reward Sim", "mobile": m, "email": f"rs{m}@x.com"}})
print("lead:", lead["lead_id"])
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve ->", r.get("rewards"))
r2 = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve again (idempotent) ->", r2.get("rewards"))
w1 = req("GET", "/api/wallet", tok=cus)
exp_extra = round(camp["payout_amount"] * 0.05, 2)
assert abs(w1["balance"] - w0["balance"] - exp_extra) < 0.01, (w0["balance"], w1["balance"], exp_extra)
print("extra bonus credited OK:", exp_extra)

cards = req("GET", "/api/scratch-cards", tok=cus)
mine = [c for c in cards["cards"] if c["lead_id"] == lead["id"] and c["status"] == "issued"]
assert len(mine) == 1, cards
card = mine[0]
print("card issued:", card["amount"])
s = req("POST", f"/api/scratch-cards/{card['id']}/scratch", tok=cus)
print("scratch ->", s.get("amount"), s.get("bonus"))
s2 = req("POST", f"/api/scratch-cards/{card['id']}/scratch", tok=cus)
print("scratch again ->", s2)
assert s2.get("err") == 400
w2 = req("GET", "/api/wallet", tok=cus)
assert abs(w2["balance"] - w1["balance"] - card["amount"]) < 0.01
assert abs(w1["bonus_locked"] - w2["bonus_locked"] - card["amount"]) < 0.01
print("locked->main OK:", {k: w2[k] for k in ("balance", "bonus_locked", "bonus_released")})

r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected", "reject_reason": "sim"}, tok=adm)
print("reject ->", r.get("rewards"))
w3 = req("GET", "/api/wallet", tok=cus)
assert abs(w3["balance"] - w0["balance"]) < 0.01, (w0["balance"], w3["balance"])
assert abs(w3["bonus_locked"] - w0["bonus_locked"]) < 0.01
print("reversal OK: wallet back to", w3["balance"], "locked", w3["bonus_locked"])
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected"}, tok=adm)
print("reject again ->", r.get("rewards"), "(no double deduction)")
w4 = req("GET", "/api/wallet", tok=cus)
assert abs(w4["balance"] - w3["balance"]) < 0.01

r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("re-approve ->", r.get("rewards"))
w5 = req("GET", "/api/wallet", tok=cus)
assert abs(w5["balance"] - w0["balance"] - exp_extra) < 0.01
cards = req("GET", "/api/scratch-cards", tok=cus)
assert len([c for c in cards["cards"] if c["lead_id"] == lead["id"] and c["status"] == "issued"]) == 1
print("re-approval issues fresh card + extra once OK")
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "pending"}, tok=adm)
print("back to pending ->", r.get("rewards"))
w6 = req("GET", "/api/wallet", tok=cus)
assert abs(w6["balance"] - w0["balance"]) < 0.01

adm_view = req("GET", "/api/admin/rewards", tok=adm)
print("admin rewards users:", [(u["name"], u["total"], u["released"], u["remaining"]) for u in adm_view["users"]][:3], "cards:", len(adm_view["cards"]), "adj:", len(adm_view["adjustments"]))
print("ALL OK; lead id", lead["id"])
