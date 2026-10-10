"""Extra bonus (festival) is delivered as its own scratch card; signup-bonus card = 5% of payout from locked wallet."""
import json, random, urllib.request

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
payout = [c for c in req("GET", "/api/campaigns") if c["slug"] == slug][0]["payout_amount"]
s = req("PUT", "/api/admin/rewards/settings", {"extra_bonus_enabled": True, "extra_bonus_mode": "fixed", "extra_bonus_amount": 10, "scratch_enabled": True, "scratch_mode": "percent", "scratch_percent": 5}, tok=adm)
print("settings:", s)
w0 = req("GET", "/api/wallet", tok=cus)
print("before:", {k: w0[k] for k in ("balance", "total_earnings", "bonus_locked")})

m = "9" + str(random.randint(100000000, 999999999))
lead = req("POST", f"/api/leads/{slug}", {"ref": me["referral_code"], "data": {"name": "Festival Sim", "mobile": m, "email": f"fs{m}@x.com"}})
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve ->", r.get("rewards"))
assert r["rewards"]["card"] and r["rewards"]["extra_card"] and r["rewards"]["extra"] == 10
w1 = req("GET", "/api/wallet", tok=cus)
assert abs(w1["balance"] - w0["balance"]) < 0.01, "nothing credited before scratching"
cards = [c for c in req("GET", "/api/scratch-cards", tok=cus)["cards"] if c["lead_id"] == lead["id"] and c["status"] == "issued"]
kinds = {c["kind"]: c for c in cards}
print("issued cards:", {k: v["amount"] for k, v in kinds.items()})
assert abs(kinds["bonus"]["amount"] - min(payout * 0.05, w0["bonus_locked"])) < 0.01 and kinds["extra"]["amount"] == 10
req("POST", f"/api/scratch-cards/{kinds['extra']['id']}/scratch", tok=cus)
w2 = req("GET", "/api/wallet", tok=cus)
assert abs(w2["balance"] - w0["balance"] - 10) < 0.01 and abs(w2["bonus_locked"] - w0["bonus_locked"]) < 0.01, "extra must not touch locked"
print("extra scratched: +10 main, locked unchanged OK")
req("POST", f"/api/scratch-cards/{kinds['bonus']['id']}/scratch", tok=cus)
w3 = req("GET", "/api/wallet", tok=cus)
b = kinds["bonus"]["amount"]
assert abs(w3["balance"] - w0["balance"] - 10 - b) < 0.01 and abs(w0["bonus_locked"] - w3["bonus_locked"] - b) < 0.01
print("bonus scratched: +", b, "main, locked -", b, "OK")
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected", "reject_reason": "sim"}, tok=adm)
print("reject ->", r.get("rewards"))
w4 = req("GET", "/api/wallet", tok=cus)
assert abs(w4["balance"] - w0["balance"]) < 0.01 and abs(w4["bonus_locked"] - w0["bonus_locked"]) < 0.01 and abs(w4["total_earnings"] - w0["total_earnings"]) < 0.01
print("reversal OK: everything restored")
# OFF again → only bonus card
req("PUT", "/api/admin/rewards/settings", {"extra_bonus_enabled": False}, tok=adm)
r = req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "approved"}, tok=adm)
print("approve with extra OFF ->", r.get("rewards"))
assert r["rewards"]["card"] and not r["rewards"]["extra_card"]
req("PATCH", f"/api/admin/leads/{lead['id']}", {"status": "rejected"}, tok=adm)
w5 = req("GET", "/api/wallet", tok=cus)
assert abs(w5["balance"] - w0["balance"]) < 0.01
print("ALL OK")
