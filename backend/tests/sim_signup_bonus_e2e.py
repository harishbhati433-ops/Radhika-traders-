import asyncio, sys, json, subprocess
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from bson import ObjectId
import server

API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0] + "/api"


def curl(method, path, token=None, body=None):
    cmd = ["curl", "-s", "-X", method, API + path, "-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    return json.loads(subprocess.check_output(cmd))


async def main():
    db = server.db
    u = {"_id": ObjectId(), "name": "E2E Bonus", "mobile": "6999900077", "email": "e2ebonus@x.com", "role": "customer", "referral_code": "RTE2E77", "kyc": {},
         "created_at": server.now_iso(), "email_verified": True, "account_status": "active"}
    await db.users.insert_one(u)
    c = await db.campaigns.find_one({"slug": "axis-mutual-fund-sip"})
    l = {"lead_id": "LD-E2E77", "campaign_id": str(c["_id"]), "campaign_name": c["offer_name"], "slug": c["slug"], "partner_id": str(u["_id"]), "partner_name": u["name"],
         "data": {"name": "Cust X", "mobile": "6888800077"}, "customer_name": "Cust X", "mobile": "6888800077", "status": "pending", "account_status": "pending",
         "created_at": server.now_iso(), "updated_at": server.now_iso(), "dup_keys": server.lead_dup_keys({"name": "Cust X", "mobile": "6888800077"})}
    r = await db.leads.insert_one(l)
    tok = curl("POST", "/auth/login", body={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})["token"]
    curl("PATCH", f"/admin/leads/{r.inserted_id}", tok, {"account_status": "account_opened"})
    print("after Account Open ->", [(t["description"], t["amount"]) for t in await db.transactions.find({"user_id": str(u["_id"])}).to_list(5)])
    curl("PATCH", f"/admin/leads/{r.inserted_id}", tok, {"status": "approved"})
    curl("PATCH", f"/admin/leads/{r.inserted_id}", tok, {"status": "pending"})
    curl("PATCH", f"/admin/leads/{r.inserted_id}", tok, {"status": "approved"})
    print("after Approve (x2) ->", [(t["description"], t["amount"], t["ref_id"]) for t in await db.transactions.find({"user_id": str(u["_id"])}).to_list(5)])
    log = curl("GET", "/admin/signup-bonus/log", tok)
    print("admin log ->", [(i["user_name"], i["customer_id"], i["amount"], i["status"], i["wallet_credit_status"], i["lead_id"]) for i in log["items"] if i["user_id"] == str(u["_id"])])
    w = await server.compute_wallet(str(u["_id"]))
    print("wallet balance:", w["balance"])
    ids = [str(u["_id"])]
    await db.users.delete_one({"_id": u["_id"]}); await db.leads.delete_one({"_id": r.inserted_id})
    await db.transactions.delete_many({"user_id": {"$in": ids}}); await db.signup_bonus_log.delete_many({"user_id": {"$in": ids}}); await db.notifications.delete_many({"user_id": {"$in": ids}})
    await db.activity_logs.delete_many({"entity_id": "LD-E2E77"})
    print("cleaned")

asyncio.run(main())
