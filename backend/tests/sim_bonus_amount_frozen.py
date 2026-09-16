"""Sim: changing the Signup Bonus setting must NOT change what existing customers see / receive."""
import asyncio, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
import httpx  # noqa: E402
import server  # noqa: E402
from auth_utils import hash_password  # noqa: E402


async def main():
    db = server.db
    orig = await db.settings.find_one({"key": "app"}, {"signup_bonus": 1, "signup_bonus_enabled": 1})
    ts = str(int(time.time()))

    async def mk(name, promised):
        doc = {"name": name, "email": f"{name.lower()}{ts}@gmail.com", "mobile": "9" + str(int(ts[-9:]) + len(name)), "role": "customer", "email_verified": True,
               "referral_code": f"RT{name[:3].upper()}{ts[-3:]}", "created_at": server.now_iso(), "account_status": "active", "password_hash": hash_password("Test@1234")}
        if promised is not None:
            doc["welcome"] = {"issued_at": server.now_iso(), "signup_bonus": promised}
        return await db.users.find_one({"_id": (await db.users.insert_one(doc)).inserted_id})

    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus": 50, "signup_bonus_enabled": True}})
    old_pending = await mk("OldPending", 50)      # signed up at ₹50, no txn yet
    old_locked = await mk("OldLocked", 50); print("lock old:", await server.lock_signup_bonus(old_locked))
    legacy = await mk("Legacy", None)             # very old account, nothing frozen
    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus": 100}})   # admin changes 50 → 100
    new_user = await mk("NewUser", 100); print("lock new:", await server.lock_signup_bonus(new_user))

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://t") as c:
        for u in (old_pending, old_locked, legacy, new_user):
            t = (await c.post("/api/auth/login", json={"email": u["email"], "password": "Test@1234"})).json()["token"]
            sb = (await c.get("/api/wallet", headers={"Authorization": f"Bearer {t}"})).json()["signup_bonus"]
            print(f"{u['name']:>10}: status={sb['status']:<9} amount={sb['amount']}")
    # approve first lead for old_pending → should be credited ₹50 not ₹100
    lead = {"lead_id": "LD-X", "campaign_id": "", "partner_id": str(old_pending["_id"]), "status": "approved"}
    if await server.unlock_signup_bonus(str(old_pending["_id"]), lead) == "none":
        await server.grant_signup_bonus(str(old_pending["_id"]), lead)
    print("OldPending credited:", (await server.compute_wallet(str(old_pending["_id"])))["balance"])
    print("OldLocked unlock:", await server.unlock_signup_bonus(str(old_locked["_id"]), lead), "→ balance", (await server.compute_wallet(str(old_locked["_id"])))["balance"])

    await db.settings.update_one({"key": "app"}, {"$set": {"signup_bonus": orig["signup_bonus"], "signup_bonus_enabled": orig["signup_bonus_enabled"]}})
    ids = [old_pending["_id"], old_locked["_id"], legacy["_id"], new_user["_id"]]
    for x in ids:
        await db.transactions.delete_many({"user_id": str(x)}); await db.signup_bonus_log.delete_many({"user_id": str(x)}); await db.notifications.delete_many({"user_id": str(x)}); await db.security_logs.delete_many({"user_id": str(x)})
    await db.users.delete_many({"_id": {"$in": ids}})
    print("settings restored to", orig["signup_bonus"], "| cleaned")

asyncio.run(main())
