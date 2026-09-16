import os, asyncio, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from bson import ObjectId
import server


async def join(db, ref, label):
    rid = str(ref["_id"])
    nu = {"_id": ObjectId(), "name": label, "email": f"{label.lower()}@x.com", "referred_by_code": ref["referral_code"], "role": "customer", "created_at": server.now_iso()}
    await db.users.insert_one(nu)
    await server.pay_referral_bonus(nu)
    await server.pay_dedicated_referral(nu)
    new = await db.transactions.find({"user_id": rid, "created_at": {"$gte": nu["created_at"]}}).to_list(10)
    print(f"{label}: credits to referrer ->", [(t["description"][:32], t["amount"]) for t in new])
    await db.transactions.delete_many({"user_id": rid, "created_at": {"$gte": nu["created_at"]}})
    await db.notifications.delete_many({"user_id": rid, "created_at": {"$gte": nu["created_at"]}})
    await db.users.delete_one({"_id": nu["_id"]})
    return len(new)


async def main():
    db = server.db
    ref = await db.users.find_one({"email": "testcust@example.com"})
    rid = str(ref["_id"])
    ded = await db.dedicated_referrals.find_one({"user_id": rid})
    s = await server.get_settings()
    print("dedicated:", (ded["enabled"], ded["payout"]), "| standard bonus:", s["referral_bonus"])
    before = await db.transactions.count_documents({"user_id": rid})
    snap = {k: ded.get(k) for k in ("eligible_count", "total_earned", "last_referral_at")}
    n1 = await join(db, ref, "SimDedOn")
    await db.dedicated_referrals.update_one({"_id": ded["_id"]}, {"$set": {"enabled": False}})
    n2 = await join(db, ref, "SimDedOff")
    await db.dedicated_referrals.update_one({"_id": ded["_id"]}, {"$set": {"enabled": True, **snap}})
    await db.dedicated_referral_logs.delete_many({"user_id": rid, "action": "referral_paid", "details.referred_user_id": {"$exists": True}, "created_at": {"$gte": ref.get("created_at", "")}, "note": {"$regex": "Sim"}})
    print("ONE credit each?", n1 == 1 and n2 == 1, "| txn count restored:", before == await db.transactions.count_documents({"user_id": rid}))

asyncio.run(main())
