import asyncio, os, re, sys, time, json, subprocess
import httpx
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0] + "/api"
from motor.motor_asyncio import AsyncIOMotorClient

TAG = int(time.time()) % 100000
DEV = {"device_fp": f"simfp{TAG}", "device_id": f"simid{TAG}"}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    ref = await db.users.find_one({"email": "testcust@example.com"})
    before = len(await db.transactions.find({"user_id": str(ref["_id"]), "ref_id": {"$regex": "^REF-"}}).to_list(100))
    async with httpx.AsyncClient(timeout=30) as c:
        emails = []
        for i in (1, 2):
            em = f"simdev{TAG}_{i}@example.com"
            emails.append(em)
            # register() rejects test domains at the email step; mirror its document directly, then verify OTP via the real endpoint
            await db.users.insert_one({"name": f"Sim Dev {i}", "email": em, "mobile": f"7{TAG:05d}{i:04d}", "password_hash": "x", "role": "customer", "email_verified": False,
                                       "referral_code": f"RTSIM{TAG % 1000}{i}", "kyc": {"status": "not_submitted"}, "bank": {}, "referred_by_code": ref["referral_code"], "referral_bonus_paid": False,
                                       "signup_device": {"fp": DEV["device_fp"], "id": DEV["device_id"], "ip": "1.2.3.4", "ua": "sim", "at": "2026-10-06T00:00:00"}, "created_at": f"2026-10-06T10:0{i}:00"})
            await db.otp_codes.insert_one({"email": em, "code": "111111", "purpose": "signup", "expires_at": "2099-01-01T00:00:00+00:00", "used": False})
            r = await c.post(f"{API}/auth/verify-otp", json={"email": em, "code": "111111"})
            print("verify", i, r.status_code)
            assert r.status_code == 200, r.text
        u1, u2 = [await db.users.find_one({"email": e}) for e in emails]
        print("u1 flags:", u1.get("signup_flags"), "| bonus_paid:", u1.get("referral_bonus_paid"), u1.get("referral_limit_exceeded"))
        print("u2 flags:", u2.get("signup_flags"), "| bonus_paid:", u2.get("referral_bonus_paid"), u2.get("referral_limit_exceeded"))
        after = len(await db.transactions.find({"user_id": str(ref["_id"]), "ref_id": {"$regex": "^REF-"}}).to_list(100))
        print("referrer REF credits before/after:", before, after)
        assert not u1.get("signup_flags", {}).get("same_device")
        assert u2["signup_flags"]["same_device"] and u2["referral_limit_exceeded"] == "device"
        assert after - before <= 1, "second account must not pay a referral bonus"
        # admin view
        tok = (await c.post(f"{API}/auth/login", json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})).json()["token"]
        s = (await c.get(f"{API}/admin/suspicious-signups", headers={"Authorization": f"Bearer {tok}"})).json()
        g = [g for g in s["device_groups"] if any(u["email"] == emails[1] for u in g["users"])]
        print("device group found:", bool(g), "| blocked_count:", s["blocked_count"])
        assert g and g[0]["count"] == 2
        cust = (await c.get(f"{API}/admin/customers", params={"search": f"simdev{TAG}_2", "page": 1, "limit": 10}, headers={"Authorization": f"Bearer {tok}"})).json()
        print("customers row flags:", cust["items"][0]["signup_flags"])
    # cleanup
    ids = [u1["_id"], u2["_id"]]
    await db.transactions.delete_many({"$or": [{"user_id": {"$in": [str(i) for i in ids]}}, {"user_id": str(ref["_id"]), "description": {"$regex": "Sim Dev"}}]})
    await db.users.delete_many({"_id": {"$in": ids}}); await db.otp_codes.delete_many({"email": {"$in": emails}}); await db.notifications.delete_many({"user_id": {"$in": [str(i) for i in ids]}})
    await db.signup_bonus_log.delete_many({"user_id": {"$in": [str(i) for i in ids]}}); await db.users.update_one({"_id": ref["_id"]}, {"$set": {}}) if False else None
    print("OK — cleaned up")

asyncio.run(main())
