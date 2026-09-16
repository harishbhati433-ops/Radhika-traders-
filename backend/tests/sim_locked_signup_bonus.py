"""Sim: new customer → locked signup bonus → first lead approved → credited to main wallet (once)."""
import asyncio, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
import server  # noqa: E402
from bson import ObjectId  # noqa: E402


async def main():
    db = server.db
    ts = str(int(time.time()))
    uid = (await db.users.insert_one({"name": "Sim Locked", "email": f"simlock{ts}@gmail.com", "mobile": "9" + ts[-9:], "role": "customer", "email_verified": True,
                                      "referral_code": "RTSIM" + ts[-3:], "created_at": server.now_iso(), "account_status": "active"})).inserted_id
    u = await db.users.find_one({"_id": uid})
    print("lock:", await server.lock_signup_bonus(u), "| again:", await server.lock_signup_bonus(u))
    w = await server.compute_wallet(str(uid))
    print("after signup → balance", w["balance"], "bonus_locked", w["bonus_locked"])
    camp = await db.campaigns.find_one({"is_deleted": {"$ne": True}})
    lead = {"lead_id": f"LD-SIM{ts[-5:]}", "campaign_id": str(camp["_id"]) if camp else "", "partner_id": str(uid), "status": "approved", "created_at": server.now_iso()}
    print("unlock:", await server.unlock_signup_bonus(str(uid), lead), "| again:", await server.unlock_signup_bonus(str(uid), lead))
    await server.grant_signup_bonus(str(uid), lead)  # fallback must NOT double credit
    w = await server.compute_wallet(str(uid))
    print("after first approval → balance", w["balance"], "bonus_locked", w["bonus_locked"])
    n = await db.transactions.count_documents({"user_id": str(uid), "ref_id": {"$regex": "^SB-"}})
    print("SB txns:", n, "| log:", [(x["status"], x["amount"]) for x in await db.signup_bonus_log.find({"user_id": str(uid)}).to_list(10)])
    # duplicate account (same mobile) must not get bonus
    dup_id = (await db.users.insert_one({"name": "Sim Dup", "email": f"simdup{ts}@gmail.com", "mobile": u["mobile"], "role": "customer", "email_verified": True,
                                         "referral_code": "RTDUP" + ts[-3:], "created_at": server.now_iso(), "account_status": "active"})).inserted_id
    print("dup lock:", await server.lock_signup_bonus(await db.users.find_one({"_id": dup_id})))
    # cleanup
    for x in (uid, dup_id):
        await db.transactions.delete_many({"user_id": str(x)}); await db.signup_bonus_log.delete_many({"user_id": str(x)}); await db.notifications.delete_many({"user_id": str(x)})
    await db.users.delete_many({"_id": {"$in": [uid, dup_id]}})
    print("cleaned")

asyncio.run(main())
