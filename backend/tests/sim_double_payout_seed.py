import asyncio, sys, uuid
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
import server

async def main():
    db = server.db
    ref = await db.users.find_one({"email": "testcust@example.com"}); rid = str(ref["_id"])
    before = await server.compute_wallet(rid)
    ts = server.now_iso()
    tag = uuid.uuid4().hex[:6]
    await db.transactions.insert_many([
        {"user_id": rid, "amount": 20.0, "type": "credit", "status": "completed", "description": f"Referral bonus - Sim Pair {tag} joined", "ref_id": f"REF-SIM{tag.upper()}", "campaign_id": None, "created_at": ts},
        {"user_id": rid, "amount": 20.0, "type": "credit", "status": "completed", "source": "dedicated_referral", "description": f"Dedicated referral payout - Sim Pair {tag} joined", "ref_id": f"DREF-SIM{tag.upper()}", "campaign_id": None, "created_at": ts}])
    mid = await server.compute_wallet(rid)
    rows = await server._scan_double_payouts()
    print("scan found:", [(r["name"], r["joiner"], r["ref_amount"], r["already_reversed"]) for r in rows])
    print("balance before/after seed:", before["balance"], mid["balance"], "pending:", mid["pending_withdrawal"])
    return rid, tag, before

if __name__ == "__main__":
    rid, tag, before = asyncio.run(main())
    print("TAG", tag)
