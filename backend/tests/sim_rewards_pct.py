"""Scratch card = % of campaign payout from locked bonus; extra bonus OFF by default; earnings exclude reversals."""
import json, random, sys, urllib.request

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
payout = camp["payout_amount"]
s = req("PUT", "/api/admin/rewards/settings", {"extra_bonus_enabled": False, "extra_bonus_percent": 5, "scratch_enabled": True, "scratch_mode": "percent", "scratch_percent": 5}, tok=adm)
print("settings:", s)
assert s["extra_bonus_enabled"] is False and s["scratch_mode"] == "percent"
w0 = req("GET", "/api/wallet", tok=cus)
print("before:", {k: w0[k] for k in ("balance", "total_earnings", "bonus_locked")})
assert w0["bonus_locked"] > 0, "need locked bonus"

m = "9" + str(random.randint(100000000, 999999999))
lead = req("POST", f"/api/leads/{slug}", {"ref": me["referral_code"], "data": {"name": "Pct Sim", "mobile": m, "email": f"ps{m}@x.com"}})
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve ->", r.get("rewards"))
assert r["rewards"]["extra"] == 0, "extra bonus must be OFF"
w1 = req("GET", "/api/wallet", tok=cus)
assert abs(w1["balance"] - w0["balance"]) < 0.01, "no extra credit expected"
card = [c for c in req("GET", "/api/scratch-cards", tok=cus)["cards"] if c["lead_id"] == lead["id"] and c["status"] == "issued"][0]
exp = round(min(payout * 0.05, w0["bonus_locked"]), 2)
print("card amount:", card["amount"], "expected 5% of", payout, "=", exp)
assert abs(card["amount"] - exp) < 0.01
sc = req("POST", f"/api/scratch-cards/{card['id']}/scratch", tok=cus)
w2 = req("GET", "/api/wallet", tok=cus)
assert abs(w2["balance"] - w0["balance"] - exp) < 0.01 and abs(w0["bonus_locked"] - w2["bonus_locked"] - exp) < 0.01
assert abs(w2["total_earnings"] - w0["total_earnings"] - exp) < 0.01
print("scratched OK: balance", w2["balance"], "locked", w2["bonus_locked"], "earnings", w2["total_earnings"])

r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected", "reject_reason": "sim"}, tok=adm)
print("reject ->", r.get("rewards"))
w3 = req("GET", "/api/wallet", tok=cus)
assert abs(w3["balance"] - w0["balance"]) < 0.01 and abs(w3["bonus_locked"] - w0["bonus_locked"]) < 0.01
assert abs(w3["total_earnings"] - w0["total_earnings"]) < 0.01, ("earnings must drop after reversal", w0["total_earnings"], w3["total_earnings"])
print("reversal OK: earnings back to", w3["total_earnings"])

# extra bonus ON path still works when admin enables it
req("PUT", "/api/admin/rewards/settings", {"extra_bonus_enabled": True}, tok=adm)
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve with extra ON ->", r.get("rewards"))
assert abs(r["rewards"]["extra"] - round(payout * 0.05, 2)) < 0.01
req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected"}, tok=adm)
req("PUT", "/api/admin/rewards/settings", {"extra_bonus_enabled": False}, tok=adm)
w4 = req("GET", "/api/wallet", tok=cus)
assert abs(w4["total_earnings"] - w0["total_earnings"]) < 0.01 and abs(w4["balance"] - w0["balance"]) < 0.01
custs = req("GET", "/api/admin/customers", tok=adm)
row = [c for c in (custs if isinstance(custs, list) else custs.get("items", [])) if c.get("email") == "scratchtest@example.com"]
if row:
    print("admin customers total_earnings:", row[0]["wallet"]["total_earnings"], "== wallet", w4["total_earnings"])
    assert abs(row[0]["wallet"]["total_earnings"] - w4["total_earnings"]) < 0.01
print("ALL OK", lead["id"])
