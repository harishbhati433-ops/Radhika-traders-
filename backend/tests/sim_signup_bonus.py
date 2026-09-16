import asyncio, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from bson import ObjectId
import server

db = server.db
LEAD = {"lead_id": "LD-SIMSB", "campaign_name": "Sim Campaign", "campaign_id": "x"}


async def mk(name, mobile, email, referred=None):
    u = {"_id": ObjectId(), "name": name, "mobile": mobile, "email": email, "role": "customer", "referral_code": "RTSIM" + mobile[-4:], "kyc": {}, "created_at": server.now_iso()}
    if referred:
        u["referred_by_code"] = referred
    await db.users.insert_one(u)
    return u


async def credits(uid):
    return [(t["description"], t["amount"]) for t in await db.transactions.find({"user_id": str(uid)}).to_list(10)]


async def main():
    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus_enabled": True, "signup_bonus": 100}}, upsert=True)
    a = await mk("Sim Direct", "6999900001", "simdirect@x.com")          # no referral
    b = await mk("Sim Referred", "6999900002", "simref@x.com", "RTA12499")
    c = await mk("Sim DupMobile", "6999900001", "simdup@x.com")        # same mobile as a
    await server.grant_signup_bonus(str(a["_id"]), LEAD); await server.grant_signup_bonus(str(a["_id"]), LEAD)  # twice → once
    await server.grant_signup_bonus(str(b["_id"]), LEAD)
    await server.grant_signup_bonus(str(c["_id"]), LEAD)
    print("direct (no referral), approved twice ->", await credits(a["_id"]))
    print("referred ->", await credits(b["_id"]))
    print("duplicate mobile ->", await credits(c["_id"]), "| log:", [(l["status"], l["reason"]) for l in await db.signup_bonus_log.find({"user_id": str(c["_id"])}).to_list(5)])
    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus_enabled": False}})
    d = await mk("Sim Off", "6999900004", "simoff@x.com")
    await server.grant_signup_bonus(str(d["_id"]), LEAD)
    print("feature OFF ->", await credits(d["_id"]))
    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus_enabled": True, "signup_bonus": 20}})
    ids = [str(x["_id"]) for x in (a, b, c, d)]
    await db.users.delete_many({"_id": {"$in": [x["_id"] for x in (a, b, c, d)]}})
    await db.transactions.delete_many({"user_id": {"$in": ids}}); await db.signup_bonus_log.delete_many({"user_id": {"$in": ids}}); await db.notifications.delete_many({"user_id": {"$in": ids}})
    print("cleaned")

asyncio.run(main())
