"""Signup Bonus locked wallet → Scratch Cards + extra % bonus per approved lead."""
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _oid(x: str) -> Optional[ObjectId]:
    return ObjectId(x) if ObjectId.is_valid(x) else None


def reward_settings(s: dict) -> dict:
    return {"extra_bonus_enabled": bool(s.get("extra_bonus_enabled", False)), "extra_bonus_mode": s.get("extra_bonus_mode") or "fixed", "extra_bonus_amount": float(s.get("extra_bonus_amount", 10)),
            "extra_bonus_percent": float(s.get("extra_bonus_percent", 5)), "scratch_enabled": bool(s.get("scratch_enabled", True)),
            "scratch_mode": s.get("scratch_mode") or "percent", "scratch_percent": float(s.get("scratch_percent", 5)), "scratch_amount": float(s.get("scratch_amount", 20)),
            "scratch_min": float(s.get("scratch_min", 10)), "scratch_max": float(s.get("scratch_max", 50))}


class RewardSettingsIn(BaseModel):
    extra_bonus_enabled: Optional[bool] = None
    extra_bonus_mode: Optional[str] = None
    extra_bonus_amount: Optional[float] = None
    extra_bonus_percent: Optional[float] = None
    scratch_enabled: Optional[bool] = None
    scratch_mode: Optional[str] = None
    scratch_percent: Optional[float] = None
    scratch_amount: Optional[float] = None
    scratch_min: Optional[float] = None
    scratch_max: Optional[float] = None


def build(db, get_settings, compute_wallet, push_service, log_activity, require_perm, require_admin, get_current_user, signup_dup, lock_signup_bonus):
    api = APIRouter()

    async def locked_summary(user_id: str) -> dict:
        txns, cards = await db.transactions.find({"user_id": user_id, "type": "bonus", "status": "locked"}, {"amount": 1}).to_list(50), \
            await db.scratch_cards.find({"user_id": user_id, "status": "scratched", "kind": {"$ne": "extra"}}, {"amount": 1}).to_list(5000)
        total = round(sum(t["amount"] for t in txns), 2)
        released = round(sum(c["amount"] for c in cards), 2)
        return {"total": total, "released": released, "remaining": round(max(0.0, total - released), 2)}

    async def _outstanding_cards(user_id: str) -> float:
        cards = await db.scratch_cards.find({"user_id": user_id, "status": "issued", "kind": {"$ne": "extra"}}, {"amount": 1}).to_list(1000)
        return round(sum(c["amount"] for c in cards), 2)

    async def apply_pending_adjustments(user_id: str) -> None:
        """Recover open reversal balances from the main wallet whenever money becomes available."""
        adjs = await db.pending_adjustments.find({"user_id": user_id, "status": "open"}).sort("created_at", 1).to_list(100)
        for a in adjs:
            avail = (await compute_wallet(user_id))["balance"]
            if avail <= 0:
                return
            take = round(min(avail, a["remaining"]), 2)
            await db.transactions.insert_one({"user_id": user_id, "amount": take, "type": "debit", "status": "completed", "source": a["source"], "lead_id": a.get("lead_id"),
                                              "lead_ref": a.get("lead_ref", ""), "ref_id": f"ADJ-{uuid.uuid4().hex[:8].upper()}", "adjustment_id": str(a["_id"]),
                                              "description": f"Adjustment recovered · {a.get('description', '')}", "created_at": now_iso()})
            rem = round(a["remaining"] - take, 2)
            await db.pending_adjustments.update_one({"_id": a["_id"]}, {"$set": {"remaining": rem, "status": "settled" if rem <= 0 else "open", "updated_at": now_iso()}})

    async def _reverse(user_id: str, amount: float, source: str, lead: dict, desc: str) -> dict:
        avail = max(0.0, (await compute_wallet(user_id))["balance"])
        take = round(min(avail, amount), 2)
        if take > 0:
            await db.transactions.insert_one({"user_id": user_id, "amount": take, "type": "debit", "status": "completed", "source": source, "lead_id": str(lead["_id"]),
                                              "lead_ref": lead.get("lead_id", ""), "ref_id": f"RV-{uuid.uuid4().hex[:8].upper()}", "description": desc, "created_at": now_iso()})
        rem = round(amount - take, 2)
        if rem > 0:
            await db.pending_adjustments.insert_one({"user_id": user_id, "amount": amount, "remaining": rem, "source": source, "lead_id": str(lead["_id"]), "lead_ref": lead.get("lead_id", ""),
                                                     "campaign_name": lead.get("campaign_name", ""), "description": desc, "status": "open", "created_at": now_iso(), "updated_at": now_iso()})
        return {"debited": take, "pending": rem}

    async def _extra_net(lead_id: str) -> float:
        rows = await db.transactions.find({"lead_id": lead_id, "source": {"$in": ["lead_extra_bonus", "lead_extra_bonus_reversal"]}}, {"amount": 1, "type": 1}).to_list(100)
        adj = await db.pending_adjustments.find({"lead_id": lead_id, "source": "lead_extra_bonus_reversal"}, {"remaining": 1}).to_list(50)
        return round(sum(r["amount"] if r["type"] == "credit" else -r["amount"] for r in rows) - sum(a["remaining"] for a in adj), 2)

    async def on_lead_approved(lead: dict) -> dict:
        """Called once per approval. Idempotent: never double-credits a lead."""
        uid = lead.get("partner_id")
        u = await db.users.find_one({"_id": _oid(uid)}) if uid else None
        if not u or u.get("role") != "customer":
            return {"skipped": "no_partner"}
        await lock_signup_bonus(u)
        dup, f = await signup_dup(u)
        if dup:
            await db.transactions.update_many({"user_id": uid, "type": "bonus", "status": "locked"},
                                              {"$set": {"status": "cancelled", "cancelled_at": now_iso(), "description": "Signup Bonus cancelled — duplicate account"}})
            return {"skipped": "duplicate"}
        s = reward_settings(await get_settings())
        camp = await db.campaigns.find_one({"_id": _oid(lead.get("campaign_id", ""))}, {"payout_amount": 1}) if lead.get("campaign_id") else None
        payout = float((camp or {}).get("payout_amount") or 0)
        out = {"extra": 0.0, "card": None, "extra_card": None}
        lid = str(lead["_id"])
        lead_ref, camp_name = lead.get("lead_id", ""), lead.get("campaign_name", "")

        async def issue(kind, amt, title, body):
            card = {"user_id": uid, "lead_id": lid, "kind": kind, "lead_ref": lead_ref, "campaign_name": camp_name, "amount": amt, "status": "issued", "active": True, "created_at": now_iso()}
            try:
                res = await db.scratch_cards.insert_one(card)
            except DuplicateKeyError:
                return None
            await push_service.notify_one({"user_id": uid, "title": title, "body": body, "link": "/app/dashboard", "type": "wallet", "read": False, "created_at": now_iso()})
            return str(res.inserted_id)

        # Festival / extra bonus: company-paid, admin switches it on when wanted; delivered as its own Scratch Card.
        if s["extra_bonus_enabled"] and await _extra_net(lid) <= 0 and not await db.scratch_cards.find_one({"lead_id": lid, "kind": "extra", "active": True}):
            extra = round(payout * s["extra_bonus_percent"] / 100, 2) if s["extra_bonus_mode"] == "percent" else round(s["extra_bonus_amount"], 2)
            if extra > 0:
                out["extra_card"] = await issue("extra", extra, "🎉 Extra Bonus Scratch Card!", f"Lead {lead_ref} approved — scratch your extra bonus card on the dashboard.")
                out["extra"] = extra
        summ = await locked_summary(uid)
        if summ["total"] <= 0:
            return {**out, "skipped": "no_bonus"}
        if summ["remaining"] <= 0:
            return {**out, "skipped": "exhausted"}
        if s["scratch_enabled"]:
            room = round(summ["remaining"] - await _outstanding_cards(uid), 2)
            if s["scratch_mode"] == "percent":
                amt = round(payout * s["scratch_percent"] / 100, 2)
            elif s["scratch_mode"] == "range":
                amt = float(random.randint(int(min(s["scratch_min"], s["scratch_max"])), int(max(s["scratch_min"], s["scratch_max"]))))
            else:
                amt = s["scratch_amount"]
            amt = round(min(amt, room), 2)
            if amt > 0:
                out["card"] = await issue("bonus", amt, "🎁 You got a Scratch Card!", f"Lead {lead_ref} approved — scratch it on your dashboard to unlock bonus money.")
        return out

    async def on_lead_unapproved(lead: dict, actor: str = "") -> dict:
        """Lead left 'approved': cancel its card, reverse its scratched reward and extra bonus. Idempotent."""
        uid = lead.get("partner_id")
        if not uid:
            return {}
        lid = str(lead["_id"])
        out = {"cancelled": 0, "reversed": 0.0, "extra_reversed": 0.0, "pending": 0.0}
        for c in await db.scratch_cards.find({"lead_id": lid, "active": True}).to_list(20):
            if c["status"] == "issued":
                await db.scratch_cards.update_one({"_id": c["_id"], "status": "issued"}, {"$set": {"status": "cancelled", "active": False, "cancelled_at": now_iso(), "cancelled_by": actor}})
                out["cancelled"] += 1
            elif c["status"] == "scratched":
                r = await db.scratch_cards.update_one({"_id": c["_id"], "status": "scratched"}, {"$set": {"status": "reversed", "active": False, "reversed_at": now_iso(), "reversed_by": actor}})
                if r.modified_count and c.get("kind") != "extra":  # extra-card money is reversed below via the lead_extra_bonus net
                    rv = await _reverse(uid, c["amount"], "scratch_reward_reversal", lead, f"Scratch Card reward reversed · Lead {lead.get('lead_id', '')} no longer approved")
                    out["reversed"] += c["amount"]; out["pending"] += rv["pending"]
        net = await _extra_net(lid)
        if net > 0:
            rv = await _reverse(uid, net, "lead_extra_bonus_reversal", lead, f"Extra bonus reversed · Lead {lead.get('lead_id', '')} no longer approved")
            out["extra_reversed"] = net; out["pending"] += rv["pending"]
        return out

    # ---------------- customer ----------------
    def _card_out(c: dict) -> dict:
        return {"id": str(c["_id"]), **{k: v for k, v in c.items() if k not in ("_id", "user_id")}}

    @api.get("/scratch-cards")
    async def my_cards(user: dict = Depends(get_current_user)):
        cards = await db.scratch_cards.find({"user_id": user["id"], "status": {"$in": ["issued", "scratched"]}}).sort("created_at", -1).to_list(200)
        return {"cards": [_card_out(c) for c in cards], "bonus": await locked_summary(user["id"])}

    @api.post("/scratch-cards/{cid}/scratch")
    async def scratch(cid: str, user: dict = Depends(get_current_user)):
        summ = await locked_summary(user["id"])
        card = await db.scratch_cards.find_one({"_id": _oid(cid), "user_id": user["id"]})
        if not card:
            raise HTTPException(status_code=404, detail="Scratch card not found")
        if card["status"] != "issued":
            raise HTTPException(status_code=400, detail="This card has already been used")
        if card.get("kind") == "extra":
            # Company-paid extra bonus: does not touch the locked Signup Bonus.
            ref = f"XB-{uuid.uuid4().hex[:8].upper()}"
            r = await db.scratch_cards.update_one({"_id": card["_id"], "status": "issued"}, {"$set": {"status": "scratched", "scratched_at": now_iso(), "ref_id": ref}})
            if not r.modified_count:
                raise HTTPException(status_code=400, detail="This card has already been used")
            amt = round(float(card["amount"]), 2)
            await db.transactions.insert_one({"user_id": user["id"], "amount": amt, "type": "credit", "status": "completed", "source": "lead_extra_bonus", "lead_id": card["lead_id"],
                                              "lead_ref": card.get("lead_ref", ""), "scratch_id": str(card["_id"]), "ref_id": ref,
                                              "description": f"Extra Bonus Scratch Card · Lead {card.get('lead_ref', '')} · {card.get('campaign_name', '')}", "created_at": now_iso()})
            await apply_pending_adjustments(user["id"])
            return {"amount": amt, "ref_id": ref, "kind": "extra", "bonus": await locked_summary(user["id"]), "wallet": await compute_wallet(user["id"])}
        amt = round(min(float(card["amount"]), summ["remaining"]), 2)
        if amt <= 0:
            await db.scratch_cards.update_one({"_id": card["_id"]}, {"$set": {"status": "cancelled", "active": False, "cancelled_at": now_iso(), "cancel_reason": "no locked balance"}})
            raise HTTPException(status_code=400, detail="Your Signup Bonus balance is already fully released")
        ref = f"SC-{uuid.uuid4().hex[:8].upper()}"
        r = await db.scratch_cards.update_one({"_id": card["_id"], "status": "issued"}, {"$set": {"status": "scratched", "amount": amt, "scratched_at": now_iso(), "ref_id": ref}})
        if not r.modified_count:
            raise HTTPException(status_code=400, detail="This card has already been used")
        await db.transactions.insert_one({"user_id": user["id"], "amount": amt, "type": "credit", "status": "completed", "source": "scratch_reward", "lead_id": card["lead_id"],
                                          "lead_ref": card.get("lead_ref", ""), "scratch_id": str(card["_id"]), "ref_id": ref,
                                          "description": f"Scratch Card reward · Lead {card.get('lead_ref', '')} · from Signup Bonus", "created_at": now_iso()})
        await apply_pending_adjustments(user["id"])
        return {"amount": amt, "ref_id": ref, "bonus": await locked_summary(user["id"]), "wallet": await compute_wallet(user["id"])}

    # ---------------- admin ----------------
    @api.get("/admin/rewards")
    async def admin_rewards(admin: dict = Depends(require_perm("payments", "view"))):
        s = reward_settings(await get_settings())
        cards = await db.scratch_cards.find().sort("created_at", -1).to_list(2000)
        adjs = await db.pending_adjustments.find().sort("created_at", -1).to_list(500)
        extras = await db.transactions.find({"source": {"$in": ["lead_extra_bonus", "lead_extra_bonus_reversal", "scratch_reward_reversal"]}}).sort("created_at", -1).to_list(2000)
        locked = await db.transactions.find({"type": "bonus", "status": "locked"}, {"user_id": 1, "amount": 1}).to_list(5000)
        uids = {t["user_id"] for t in locked} | {c["user_id"] for c in cards} | {t["user_id"] for t in extras}
        users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": [ObjectId(i) for i in uids if ObjectId.is_valid(i)]}}, {"name": 1, "referral_code": 1, "mobile": 1}).to_list(5000)}
        rows = []
        for uid in uids:
            u = users.get(uid)
            if not u:
                continue
            summ = await locked_summary(uid)
            ucards = [c for c in cards if c["user_id"] == uid]
            extra = round(sum(t["amount"] if t["type"] == "credit" else -t["amount"] for t in extras if t["user_id"] == uid and t["source"].startswith("lead_extra")), 2)
            w = await compute_wallet(uid)
            rows.append({"user_id": uid, "name": u.get("name", ""), "customer_id": u.get("referral_code", ""), "mobile": u.get("mobile", ""), **summ, "extra_bonus_total": extra,
                         "cards_issued": len(ucards), "cards_scratched": sum(1 for c in ucards if c["status"] in ("scratched", "reversed")), "cards_pending": sum(1 for c in ucards if c["status"] == "issued"),
                         "main_balance": w["balance"], "status": "active" if summ["remaining"] > 0 else ("released" if summ["total"] > 0 else "none")})
        rows.sort(key=lambda r: (-r["remaining"], r["name"]))
        name = lambda uid: users.get(uid, {}).get("name", "")
        return {"settings": s, "users": rows,
                "cards": [{**_card_out(c), "user_name": name(c["user_id"]), "customer_id": users.get(c["user_id"], {}).get("referral_code", "")} for c in cards],
                "extra_txns": [{"id": str(t["_id"]), **{k: v for k, v in t.items() if k != "_id"}, "user_name": name(t["user_id"])} for t in extras],
                "adjustments": [{"id": str(a["_id"]), **{k: v for k, v in a.items() if k != "_id"}, "user_name": name(a["user_id"])} for a in adjs]}

    @api.put("/admin/rewards/settings")
    async def admin_reward_settings(body: RewardSettingsIn, request: Request, admin: dict = Depends(require_admin)):
        upd = {}
        if body.extra_bonus_enabled is not None:
            upd["extra_bonus_enabled"] = body.extra_bonus_enabled
        if body.extra_bonus_mode is not None:
            if body.extra_bonus_mode not in ("fixed", "percent"):
                raise HTTPException(status_code=400, detail="Extra bonus mode must be fixed or percent")
            upd["extra_bonus_mode"] = body.extra_bonus_mode
        if body.extra_bonus_amount is not None:
            if body.extra_bonus_amount < 0:
                raise HTTPException(status_code=400, detail="Amount cannot be negative")
            upd["extra_bonus_amount"] = body.extra_bonus_amount
        if body.extra_bonus_percent is not None:
            if not 0 <= body.extra_bonus_percent <= 100:
                raise HTTPException(status_code=400, detail="Percent must be between 0 and 100")
            upd["extra_bonus_percent"] = body.extra_bonus_percent
        if body.scratch_percent is not None:
            if not 0 <= body.scratch_percent <= 100:
                raise HTTPException(status_code=400, detail="Percent must be between 0 and 100")
            upd["scratch_percent"] = body.scratch_percent
        if body.scratch_enabled is not None:
            upd["scratch_enabled"] = body.scratch_enabled
        if body.scratch_mode is not None:
            if body.scratch_mode not in ("percent", "fixed", "range"):
                raise HTTPException(status_code=400, detail="Mode must be percent, fixed or range")
            upd["scratch_mode"] = body.scratch_mode
        for k in ("scratch_amount", "scratch_min", "scratch_max"):
            v = getattr(body, k)
            if v is not None:
                if v < 0:
                    raise HTTPException(status_code=400, detail="Amount cannot be negative")
                upd[k] = v
        if upd:
            await db.settings.update_one({"key": "app"}, {"$set": upd}, upsert=True)
            await log_activity(admin, "reward_settings_updated", request, entity_type="settings", status="saved", detail=", ".join(f"{k}={v}" for k, v in upd.items()))
        return reward_settings(await get_settings())

    @api.post("/admin/rewards/adjustments/{aid}/settle")
    async def admin_settle_adjustment(aid: str, request: Request, admin: dict = Depends(require_admin)):
        a = await db.pending_adjustments.find_one({"_id": _oid(aid)})
        if not a:
            raise HTTPException(status_code=404, detail="Adjustment not found")
        await db.pending_adjustments.update_one({"_id": a["_id"]}, {"$set": {"status": "waived", "remaining": 0, "updated_at": now_iso(), "waived_by": admin["email"]}})
        await log_activity(admin, "reward_adjustment_waived", request, entity_type="adjustment", entity_id=aid, client_id=a["user_id"], amount=float(a["remaining"]), status="waived", detail=a.get("description", ""))
        return {"ok": True}

    api.on_lead_approved = on_lead_approved
    api.on_lead_unapproved = on_lead_unapproved
    api.locked_summary = locked_summary
    api.apply_pending_adjustments = apply_pending_adjustments
    return api
