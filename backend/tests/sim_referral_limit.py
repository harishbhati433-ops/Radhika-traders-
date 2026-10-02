"""Simulate: referral daily limit full -> signup still succeeds, referrer gets no payout."""
import asyncio, os, sys, uuid
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import server  # noqa: E402


async def main():
    db = server.db
    tag = uuid.uuid4().hex[:6]
    ref = {"name": f"Ref {tag}", "email": f"ref_{tag}@test.local", "mobile": "9000000001", "password_hash": "x", "role": "customer",
           "email_verified": True, "referral_code": f"RT{tag.upper()}", "kyc": {"status": "not_submitted"}, "bank": {}, "created_at": server.now_iso()}
    rid = (await db.users.insert_one(ref)).inserted_id
    old = await db.settings.find_one({"key": "app"}) or {}
    await db.settings.update_one({"key": "app"}, {"$set": {"referral_daily_limit": 1, "referral_bonus": 50}}, upsert=True)
    try:
        for i in (1, 2):
            email = f"new{i}_{tag}@test.local"
            await db.users.insert_one({"name": f"New{i}", "email": email, "mobile": f"900000001{i}", "password_hash": "x", "role": "customer", "email_verified": False,
                                       "referral_code": f"N{i}{tag.upper()}", "kyc": {"status": "not_submitted"}, "bank": {}, "referred_by_code": ref["referral_code"],
                                       "referral_bonus_paid": False, "created_at": server.now_iso()})
            await server.apply_referral_limit(email)
            await db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
            u = await db.users.find_one({"email": email})
            await server.pay_referral_bonus(u)
            await server.pay_dedicated_referral(u)
            u = await db.users.find_one({"email": email})
            paid = await db.transactions.count_documents({"user_id": str(rid), "ref_id": {"$regex": "^REF-"}})
            print(f"join {i}: verified={u['email_verified']} limit_exceeded={u.get('referral_limit_exceeded', '')!r} referrer_txns={paid}")
        assert paid == 1, "referrer should be paid exactly once"
        u2 = await db.users.find_one({"email": f"new2_{tag}@test.local"})
        assert u2["email_verified"] and u2.get("referral_limit_exceeded") == "daily" and u2.get("referred_by_user_id") == str(rid)
        print("PASS")
    finally:
        await db.settings.update_one({"key": "app"}, {"$set": {"referral_daily_limit": old.get("referral_daily_limit", 2), "referral_bonus": old.get("referral_bonus", 0)}})
        await db.users.delete_many({"email": {"$regex": f"_{tag}@test.local$"}})
        await db.transactions.delete_many({"user_id": str(rid)})


asyncio.run(main())
