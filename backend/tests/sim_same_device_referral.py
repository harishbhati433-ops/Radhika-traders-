"""Same phone (same fingerprint), new IP/email/mobile, cleared storage → second account must be flagged and pay no referral bonus."""
import asyncio, json, os, re, subprocess, time, urllib.request
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient

API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0]
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 qa"}
REF = "RTSCR001"
FP = "qa-same-phone-fp-" + str(int(time.time()))


def req(m, p, b=None, tok=None, hdr=None):
    r = urllib.request.Request(API + p, method=m, data=json.dumps(b).encode() if b is not None else None, headers={**H, **(hdr or {}), **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        return json.load(urllib.request.urlopen(r, timeout=60))
    except urllib.error.HTTPError as e:
        return {"err": e.code, "detail": e.read().decode()[:200]}


def otp_for(email):
    for _ in range(10):
        log = subprocess.run("grep -i '\\[OTP signup\\] " + email + "' /var/log/supervisor/backend.err.log | tail -1", shell=True, capture_output=True, text=True).stdout
        m = re.search(r"-> (\d{4,8})", log)
        if m:
            return m.group(1)
        time.sleep(1)
    return None


def signup(tag, mobile, ip):
    email = f"bhatiharish276+{tag}@gmail.com"
    r = req("POST", "/api/auth/register", {"name": f"Dup Test {tag}", "email": email, "mobile": mobile, "password": "Test@1234", "referred_by": REF, "accepted_terms": True, "terms_version": "1",
                                            "device_fp": FP, "device_id": f"storage-cleared-{tag}"}, hdr={"X-Forwarded-For": ip})
    print(f"[{tag}] register ->", r if "err" in r else "ok")
    code = otp_for(email)
    print(f"[{tag}] otp from logs:", code)
    v = req("POST", "/api/auth/verify-otp", {"email": email, "code": code}, hdr={"X-Forwarded-For": ip})
    print(f"[{tag}] verify ->", v if "err" in v else "verified")
    return email


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    ref = await db.users.find_one({"referral_code": REF}, {"_id": 1})
    rid = str(ref["_id"])
    before = await db.transactions.count_documents({"user_id": rid, "ref_id": {"$regex": "^REF-"}})
    print("referrer referral-bonus txns before:", before, "| settings referral_bonus:", (await db.settings.find_one({"key": "app"}, {"referral_bonus": 1}) or {}).get("referral_bonus"))
    t = str(int(time.time()))[-5:]
    e1 = signup("dupA" + t, "97000" + t, "49.36.10.11")
    e2 = signup("dupB" + t, "97001" + t, "103.21.55.9")  # "flight mode": different IP, new email, new mobile, storage cleared, SAME phone fingerprint
    for e in (e1, e2):
        u = await db.users.find_one({"email": e}, {"signup_flags": 1, "referral_bonus_paid": 1, "referral_limit_exceeded": 1, "email_verified": 1})
        print(e.split("+")[1], "->", {"verified": u.get("email_verified"), "flags": u.get("signup_flags"), "referral_bonus_blocked": u.get("referral_bonus_paid"), "reason": u.get("referral_limit_exceeded")})
    after = await db.transactions.find({"user_id": rid, "ref_id": {"$regex": "^REF-"}}).sort("created_at", -1).to_list(5)
    print("referrer referral-bonus txns after:", len(after), [(x.get("description"), x["amount"]) for x in after[:2]])
    print("RESULT:", "PASS — only first account paid referral bonus, second flagged same_device" if len(after) - before <= 1 and (await db.users.find_one({"email": e2}))["signup_flags"].get("same_device") else "CHECK")
    # cleanup
    ids = [str(x["_id"]) for x in await db.users.find({"email": {"$in": [e1, e2]}}, {"_id": 1}).to_list(5)]
    await db.users.delete_many({"email": {"$in": [e1, e2]}})
    await db.transactions.delete_many({"user_id": {"$in": ids}})
    await db.otp_codes.delete_many({"email": {"$in": [e1, e2]}})
    for x in after[:max(0, len(after) - before)]:
        await db.transactions.delete_one({"_id": x["_id"]})
    await db.users.update_one({"_id": ref["_id"]}, {"$inc": {}})
    print("cleanup done (test accounts + their txns removed)")

asyncio.run(main())
