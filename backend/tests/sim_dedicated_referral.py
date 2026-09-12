import asyncio, os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server  # noqa: E402


async def main():
    db = server.db
    ref = await db.users.find_one({"referral_code": "RTA12499"})
    rid = str(ref["_id"])
    before_std = await db.transactions.count_documents({"user_id": rid, "ref_id": {"$regex": "^REF-"}})
    doc = {"role": "customer", "name": "Ded Sim", "email": "dedsim@example.com", "mobile": "9811111111", "email_verified": True, "referral_code": "RTSIM01",
           "referred_by_code": "RTA12499", "referred_by_user_id": rid, "account_status": "active", "created_at": server.now_iso(), "password_hash": "x"}
    r = await db.users.insert_one(doc)
    doc["_id"] = r.inserted_id
    await server.pay_dedicated_referral(doc)
    await server.pay_dedicated_referral(doc)
    d = await db.dedicated_referrals.find_one({"user_id": rid})
    tx = await db.transactions.find({"user_id": rid, "source": "dedicated_referral"}).to_list(10)
    logs = await db.dedicated_referral_log.find({"user_id": rid, "action": "referral_paid"}).to_list(5)
    after_std = await db.transactions.count_documents({"user_id": rid, "ref_id": {"$regex": "^REF-"}})
    print("eligible", d["eligible_count"], "earned", d["total_earned"], "dedicated txns", len(tx), [t["amount"] for t in tx])
    print("referral_paid logs", len(logs), "| standard REF txns before/after:", before_std, after_std)
    await db.users.delete_one({"_id": doc["_id"]})
    await db.transactions.delete_many({"user_id": rid, "source": "dedicated_referral"})
    await db.dedicated_referrals.update_one({"_id": d["_id"]}, {"$set": {"eligible_count": 0, "total_earned": 0.0}})
    await db.dedicated_referral_log.delete_many({"user_id": rid, "action": "referral_paid"})
    await db.notifications.delete_many({"user_id": rid, "title": {"$regex": "dedicated referral"}})
    print("cleanup done")


asyncio.run(main())
