"""Global search — one endpoint, role-scoped server-side. Customers see only their own rows; employees only permitted modules."""
import re
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request

GROUP_LIMIT_MAX = 50
LEAD_STATUS = {"pending": "amber", "approved": "emerald", "rejected": "rose", "duplicate": "violet"}
WD_STATUS = {"pending": "amber", "approved": "sky", "paid": "emerald", "rejected": "rose"}
CAMP_STATUS = {"live": "emerald", "paused": "amber", "closed": "slate", "draft": "slate", "upcoming": "sky"}


def _rx(q: str) -> dict:
    return {"$regex": re.escape(q), "$options": "i"}


def _num(q: str) -> Optional[float]:
    try:
        return float(q.replace(",", "")) if re.fullmatch(r"[\d,]+(\.\d+)?", q) else None
    except ValueError:
        return None


def _day(iso: str) -> str:
    return (iso or "")[:10]


def _inr(n) -> str:
    return f"₹{float(n or 0):,.0f}" if float(n or 0) == int(float(n or 0)) else f"₹{float(n or 0):,.2f}"


def build_search_router(db, get_current_user, has_perm) -> APIRouter:
    r = APIRouter()

    async def group(key, label, coll, q, project, sort, skip, limit, want_total):
        cur = db[coll].find(q, project).sort(sort).skip(skip).limit(limit)
        rows = await cur.to_list(limit)
        total = await db[coll].count_documents(q)
        return {"key": key, "label": label, "total": total, "rows": rows}

    async def customer_groups(user, q, rx, amt, only, skip, limit):
        uid = user["id"]
        out = []
        if only in (None, "campaigns"):
            cq = {"is_deleted": {"$ne": True}, "status": {"$in": ["live", "paused", "upcoming"]},
                  "$or": [{"offer_name": rx}, {"company": rx}, {"category": rx}, {"slug": rx}, {"campaign_type": rx}] + ([{"payout_amount": amt}] if amt is not None else [])}
            g = await group("campaigns", "Campaigns", "campaigns", cq, {"offer_name": 1, "company": 1, "slug": 1, "status": 1, "payout_amount": 1, "logo_url": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(c["_id"]), "title": c.get("offer_name", ""), "subtitle": f"{c.get('company') or ''} · Payout {_inr(c.get('payout_amount'))}".strip(" ·"),
                           "badge": c.get("status", ""), "tone": CAMP_STATUS.get(c.get("status"), "slate"), "image": c.get("logo_url", ""), "link": f"/campaign/{c.get('slug')}"} for c in g.pop("rows")]
            out.append(g)
        if only in (None, "leads"):
            lq = {"partner_id": uid, "$or": [{"lead_id": rx}, {"customer_name": rx}, {"mobile": rx}, {"email": rx}, {"campaign_name": rx}, {"status": rx}, {"account_status": rx}]}
            g = await group("leads", "My Leads", "leads", lq, {"lead_id": 1, "customer_name": 1, "mobile": 1, "campaign_name": 1, "status": 1, "account_status": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(l["_id"]), "title": f"{l.get('customer_name') or 'Lead'} · {l.get('lead_id', '')}", "subtitle": f"{l.get('campaign_name', '')} · {l.get('mobile', '')} · {_day(l.get('created_at'))}",
                           "badge": l.get("status", ""), "tone": LEAD_STATUS.get(l.get("status"), "slate"), "link": f"/app/my-leads?q={l.get('lead_id', '')}"} for l in g.pop("rows")]
            out.append(g)
        if only in (None, "transactions"):
            tq = {"user_id": uid, "$or": [{"ref_id": rx}, {"description": rx}, {"type": rx}, {"source": rx}] + ([{"amount": amt}] if amt is not None else [])}
            g = await group("transactions", "Wallet Transactions", "transactions", tq, {"ref_id": 1, "description": 1, "amount": 1, "type": 1, "status": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(t["_id"]), "title": f"{'+' if t.get('type') in ('credit', 'bonus') else '-'}{_inr(t.get('amount'))} · {t.get('description') or t.get('type', '')}", "subtitle": f"{t.get('ref_id') or ''} · {_day(t.get('created_at'))}".strip(" ·"),
                           "badge": t.get("status", ""), "tone": "emerald" if t.get("type") == "credit" else "amber" if t.get("type") == "bonus" else "rose", "link": f"/app/wallet?highlight={t['_id']}"} for t in g.pop("rows")]
            out.append(g)
        if only in (None, "withdrawals"):
            wq = {"user_id": uid, "$or": [{"status": rx}, {"method": rx}, {"admin_note": rx}] + ([{"amount": amt}] if amt is not None else [])}
            g = await group("withdrawals", "Withdrawal Requests", "withdrawals", wq, {"amount": 1, "method": 1, "status": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(w["_id"]), "title": f"{_inr(w.get('amount'))} via {w.get('method', '')}", "subtitle": f"Requested {_day(w.get('created_at'))}",
                           "badge": w.get("status", ""), "tone": WD_STATUS.get(w.get("status"), "slate"), "link": f"/app/withdrawals?highlight={w['_id']}"} for w in g.pop("rows")]
            out.append(g)
        if only in (None, "reports"):
            from datetime import datetime, timezone
            rq = {"expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}, "$and": [{"$or": [{"audience": "all"}, {"recipients": uid}]}, {"$or": [{"title": rx}, {"note": rx}, {"file_name": rx}]}]}
            g = await group("reports", "Reports & Files", "reports", rq, {"title": 1, "file_name": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(x["_id"]), "title": x.get("title", ""), "subtitle": f"{x.get('file_name', '')} · {_day(x.get('created_at'))}", "badge": "file", "tone": "sky", "link": "/app/reports"} for x in g.pop("rows")]
            out.append(g)
        return out

    async def staff_groups(user, q, rx, amt, only, skip, limit):
        is_admin = user.get("role") == "admin"
        out = []
        if only in (None, "customers") and has_perm(user, "clients"):
            uq = {"role": "customer", "email_verified": True, "account_status": {"$ne": "deleted"}, "$or": [{"name": rx}, {"email": rx}, {"mobile": rx}, {"referral_code": rx}]}
            g = await group("customers", "Customers", "users", uq, {"name": 1, "email": 1, "mobile": 1, "referral_code": 1, "account_status": 1, "avatar_url": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(u["_id"]), "title": u.get("name", ""), "subtitle": f"{u.get('referral_code', '')} · {u.get('mobile', '')} · {u.get('email', '')}", "image": u.get("avatar_url", ""),
                           "badge": u.get("account_status", "active"), "tone": "emerald" if u.get("account_status", "active") == "active" else "rose", "link": f"/admin/customers?q={u.get('mobile') or u.get('email', '')}"} for u in g.pop("rows")]
            out.append(g)
        if only in (None, "employees") and is_admin:
            eq = {"role": "employee", "account_status": {"$ne": "deleted"}, "$or": [{"name": rx}, {"username": rx}, {"mobile": rx}, {"email": rx}]}
            g = await group("employees", "Employees", "users", eq, {"name": 1, "username": 1, "mobile": 1, "account_status": 1, "avatar_url": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(u["_id"]), "title": u.get("name", ""), "subtitle": f"@{u.get('username', '')} · {u.get('mobile', '')}", "image": u.get("avatar_url", ""),
                           "badge": u.get("account_status", "active"), "tone": "emerald" if u.get("account_status", "active") == "active" else "rose", "link": f"/admin/employees?highlight={u['_id']}"} for u in g.pop("rows")]
            out.append(g)
        if only in (None, "campaigns") and has_perm(user, "campaigns"):
            cq = {"is_deleted": {"$ne": True}, "$or": [{"offer_name": rx}, {"company": rx}, {"category": rx}, {"slug": rx}, {"status": rx}] + ([{"payout_amount": amt}] if amt is not None else [])}
            g = await group("campaigns", "Campaigns", "campaigns", cq, {"offer_name": 1, "company": 1, "slug": 1, "status": 1, "payout_amount": 1, "logo_url": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(c["_id"]), "title": c.get("offer_name", ""), "subtitle": f"{c.get('company') or ''} · Payout {_inr(c.get('payout_amount'))} · /{c.get('slug', '')}".strip(" ·"), "image": c.get("logo_url", ""),
                           "badge": c.get("status", ""), "tone": CAMP_STATUS.get(c.get("status"), "slate"), "link": f"/admin/campaigns?edit={c['_id']}"} for c in g.pop("rows")]
            out.append(g)
        if only in (None, "leads") and has_perm(user, "leads"):
            lq = {"$or": [{"lead_id": rx}, {"customer_name": rx}, {"mobile": rx}, {"email": rx}, {"campaign_name": rx}, {"partner_name": rx}, {"ref_code": rx}, {"status": rx}, {"account_status": rx}]}
            g = await group("leads", "Leads", "leads", lq, {"lead_id": 1, "customer_name": 1, "mobile": 1, "campaign_name": 1, "partner_name": 1, "status": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(l["_id"]), "title": f"{l.get('customer_name') or 'Lead'} · {l.get('lead_id', '')}", "subtitle": f"{l.get('campaign_name', '')} · {l.get('mobile', '')} · by {l.get('partner_name') or '—'} · {_day(l.get('created_at'))}",
                           "badge": l.get("status", ""), "tone": LEAD_STATUS.get(l.get("status"), "slate"), "link": f"/admin/leads?search={l.get('lead_id', '')}"} for l in g.pop("rows")]
            out.append(g)
        if only in (None, "withdrawals") and has_perm(user, "withdrawals"):
            wq = {"$or": [{"user_name": rx}, {"user_mobile": rx}, {"user_email": rx}, {"status": rx}, {"method": rx}] + ([{"amount": amt}] if amt is not None else [])}
            g = await group("withdrawals", "Withdrawal Requests", "withdrawals", wq, {"amount": 1, "method": 1, "status": 1, "user_name": 1, "user_mobile": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(w["_id"]), "title": f"{_inr(w.get('amount'))} · {w.get('user_name', '')}", "subtitle": f"{w.get('method', '')} · {w.get('user_mobile', '')} · {_day(w.get('created_at'))}",
                           "badge": w.get("status", ""), "tone": WD_STATUS.get(w.get("status"), "slate"), "link": f"/admin/withdrawals?highlight={w['_id']}"} for w in g.pop("rows")]
            out.append(g)
        if only in (None, "transactions") and has_perm(user, "payments"):
            tq = {"$or": [{"ref_id": rx}, {"description": rx}, {"source": rx}] + ([{"amount": amt}] if amt is not None else [])}
            g = await group("transactions", "Wallet Transactions", "transactions", tq, {"ref_id": 1, "description": 1, "amount": 1, "type": 1, "status": 1, "user_id": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            rows = g.pop("rows")
            ids = [ObjectId(t["user_id"]) for t in rows if ObjectId.is_valid(t.get("user_id", ""))]
            users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": ids}}, {"name": 1, "mobile": 1}).to_list(len(ids))} if ids else {}
            g["items"] = [{"id": str(t["_id"]), "title": f"{'+' if t.get('type') in ('credit', 'bonus') else '-'}{_inr(t.get('amount'))} · {users.get(t.get('user_id'), {}).get('name') or 'Customer'}", "subtitle": f"{t.get('description') or t.get('type', '')} · {t.get('ref_id') or ''} · {_day(t.get('created_at'))}",
                           "badge": t.get("status", ""), "tone": "emerald" if t.get("type") == "credit" else "amber" if t.get("type") == "bonus" else "rose", "link": f"/admin/wallets?q={users.get(t.get('user_id'), {}).get('mobile') or ''}"} for t in rows]
            out.append(g)
        if only in (None, "reports") and has_perm(user, "reports"):
            rq = {"$or": [{"title": rx}, {"note": rx}, {"file_name": rx}]}
            g = await group("reports", "Sent Reports", "reports", rq, {"title": 1, "file_name": 1, "audience": 1, "created_at": 1}, [("created_at", -1)], skip, limit, only is not None)
            g["items"] = [{"id": str(x["_id"]), "title": x.get("title", ""), "subtitle": f"{x.get('file_name', '')} · {x.get('audience', 'all')} · {_day(x.get('created_at'))}", "badge": "file", "tone": "sky", "link": f"/admin/reports?q={x.get('title', '')}"} for x in g.pop("rows")]
            out.append(g)
        return out

    @r.get("/search")
    async def global_search(request: Request, q: str = Query(..., min_length=1, max_length=80), group: Optional[str] = None,
                            skip: int = Query(0, ge=0), limit: int = Query(6, ge=1, le=GROUP_LIMIT_MAX)):
        user = await get_current_user(request)
        q = q.strip()
        if len(q) < 2:
            return {"query": q, "groups": []}
        rx, amt = _rx(q), _num(q)
        role = user.get("role")
        if role == "customer":
            groups = await customer_groups(user, q, rx, amt, group, skip, limit)
        elif role in ("admin", "employee"):
            groups = await staff_groups(user, q, rx, amt, group, skip, limit)
        else:
            raise HTTPException(status_code=403, detail="Not allowed")
        return {"query": q, "groups": [g for g in groups if g["items"] or group]}

    return r
