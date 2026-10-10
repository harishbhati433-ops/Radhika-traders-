"""Anonymous visitor analytics: daily unique visitors + page views. No names, numbers, IPs or user ids are stored."""
import hashlib
import hmac
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field

IST = timezone(timedelta(hours=5, minutes=30))


def ist_today() -> datetime:
    return datetime.now(IST)


def dstr(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


class VisitIn(BaseModel):
    vid: str = Field(min_length=8, max_length=64)
    path: str = Field(default="/", max_length=200)
    portal: str = Field(default="customer", max_length=20)


def build(db, require_admin, send_email, wrap_email, admin_emails):
    api = APIRouter()

    async def ensure_indexes():
        await db.visits.create_index([("date", 1), ("vid", 1)], unique=True)
        await db.visits.create_index("date")

    @api.post("/visit", status_code=202)
    async def track_visit(body: VisitIn):
        now = ist_today()
        vid = hashlib.sha256(body.vid.encode()).hexdigest()[:32]  # anonymous — original id never stored
        path = body.path.split("?")[0][:120]
        portal = "admin" if body.portal == "admin" else "employee" if body.portal == "employee" else "customer"
        await db.visits.update_one({"date": dstr(now), "vid": vid},
                                   {"$inc": {"views": 1, f"paths.{path.replace('.', '_').replace('$', '_') or '/'}": 1},
                                    "$set": {"last_seen": now.isoformat(), "portal": portal},
                                    "$setOnInsert": {"first_seen": now.isoformat(), "hour": now.hour}},
                                   upsert=True)
        return {"ok": True}

    async def series(start: str, end: str) -> list:
        rows = await db.visits.aggregate([{"$match": {"date": {"$gte": start, "$lte": end}}},
                                          {"$group": {"_id": "$date", "visitors": {"$sum": 1}, "views": {"$sum": "$views"},
                                                      "customers": {"$sum": {"$cond": [{"$eq": ["$portal", "customer"]}, 1, 0]}}}},
                                          {"$sort": {"_id": 1}}]).to_list(400)
        by = {r["_id"]: r for r in rows}
        out, d = [], datetime.strptime(start, "%Y-%m-%d")
        endd = datetime.strptime(end, "%Y-%m-%d")
        while d <= endd:
            k = dstr(d); r = by.get(k, {})
            out.append({"date": k, "visitors": r.get("visitors", 0), "views": r.get("views", 0), "customers": r.get("customers", 0)})
            d += timedelta(days=1)
        return out

    async def totals(start: str, end: str) -> dict:
        r = await db.visits.aggregate([{"$match": {"date": {"$gte": start, "$lte": end}}},
                                       {"$group": {"_id": None, "visitors": {"$sum": 1}, "views": {"$sum": "$views"}}}]).to_list(1)
        return {"visitors": r[0]["visitors"] if r else 0, "views": r[0]["views"] if r else 0}

    async def summary(start: str = "", end: str = "") -> dict:
        today = ist_today()
        t = dstr(today); y = dstr(today - timedelta(days=1))
        week_start = dstr(today - timedelta(days=today.weekday()))
        month_start = today.strftime("%Y-%m-01")
        start = start or dstr(today - timedelta(days=29)); end = end or t
        top = await db.visits.aggregate([{"$match": {"date": {"$gte": start, "$lte": end}}}, {"$project": {"p": {"$objectToArray": "$paths"}}}, {"$unwind": "$p"},
                                         {"$group": {"_id": "$p.k", "views": {"$sum": "$p.v"}}}, {"$sort": {"views": -1}}, {"$limit": 8}]).to_list(8)
        hours = await db.visits.aggregate([{"$match": {"date": {"$gte": start, "$lte": end}}}, {"$group": {"_id": "$hour", "n": {"$sum": 1}}}]).to_list(24)
        online_since = (today - timedelta(minutes=5)).isoformat()
        online_now = await db.visits.count_documents({"date": t, "last_seen": {"$gte": online_since}})
        day_start_utc = datetime(today.year, today.month, today.day, tzinfo=IST).astimezone(timezone.utc).isoformat()
        signups_today = await db.users.count_documents({"role": "customer", "created_at": {"$gte": day_start_utc}})
        return {"today": await totals(t, t), "yesterday": await totals(y, y), "this_week": await totals(week_start, t), "this_month": await totals(month_start, t),
                "last_7_days": await totals(dstr(today - timedelta(days=6)), t), "last_30_days": await totals(dstr(today - timedelta(days=29)), t),
                "online_now": online_now, "signups_today": signups_today,
                "range": {"start": start, "end": end, **await totals(start, end)}, "series": await series(start, end),
                "top_pages": [{"path": p["_id"], "views": p["views"]} for p in top], "by_hour": sorted([{"hour": h["_id"], "visitors": h["n"]} for h in hours if h["_id"] is not None], key=lambda x: x["hour"]),
                "generated_at": today.isoformat()}

    @api.get("/admin/visits/summary")
    async def admin_visits(start: str = "", end: str = "", admin: dict = Depends(require_admin)):
        for v in (start, end):
            if v:
                try:
                    datetime.strptime(v, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(status_code=400, detail="Dates must be YYYY-MM-DD")
        if start and end and start > end:
            start, end = end, start
        return await summary(start, end)

    async def send_daily_report(for_date: str | None = None) -> dict:
        today = ist_today()
        day = for_date or dstr(today - timedelta(days=1))  # runs at 00:00 IST → report covers the day that just ended
        d = datetime.strptime(day, "%Y-%m-%d")
        s = await summary(dstr(d - timedelta(days=6)), day)
        dayt = await totals(day, day); prev = await totals(dstr(d - timedelta(days=1)), dstr(d - timedelta(days=1)))
        week = await totals(dstr(d - timedelta(days=6)), day); month = await totals(d.strftime("%Y-%m-01"), day)
        diff = dayt["visitors"] - prev["visitors"]
        arrow = f'<span style="color:#059669">▲ {diff}</span>' if diff > 0 else f'<span style="color:#dc2626">▼ {abs(diff)}</span>' if diff < 0 else '<span style="color:#64748b">— same</span>'
        rows = "".join(f'<tr><td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">{datetime.strptime(x["date"], "%Y-%m-%d").strftime("%a, %d %b")}</td>'
                       f'<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold">{x["visitors"]}</td>'
                       f'<td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b">{x["views"]}</td></tr>' for x in reversed(s["series"]))
        card = lambda label, n, sub: (f'<td style="padding:6px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">'
                                      f'<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px">{label}</div>'
                                      f'<div style="font-size:26px;font-weight:bold;margin-top:2px">{n}</div><div style="font-size:11px;color:#64748b">{sub}</div></div></td>')
        wk_sub = f"{week['views']} views"; mo_sub = f"{month['views']} views"; day_sub = f"vs previous day {arrow}"
        inner = (f'<h2 style="margin:0 0 4px;font-size:18px">Daily Website Visitors — {d.strftime("%A, %d %B %Y")}</h2>'
                 f'<div style="font-size:13px;color:#475569">Unique visitors who opened radhikatraders.net (anonymous count only — no personal data).</div>'
                 f'<table style="width:100%;border-collapse:separate;margin-top:12px"><tr>{card("Visitors", dayt["visitors"], day_sub)}{card("Page views", dayt["views"], "all pages")}</tr>'
                 f'<tr>{card("Last 7 days", week["visitors"], wk_sub)}{card("This month", month["visitors"], mo_sub)}</tr></table>'
                 f'<h3 style="font-size:14px;margin:18px 0 6px">Last 7 days</h3><table style="width:100%;border-collapse:collapse;font-size:13px">'
                 f'<tr style="color:#64748b;font-size:11px;text-transform:uppercase"><th style="text-align:left;padding:6px 8px">Date</th><th style="text-align:right;padding:6px 8px">Visitors</th><th style="text-align:right;padding:6px 8px">Views</th></tr>{rows}</table>'
                 f'<div style="font-size:12px;color:#64748b;margin-top:14px">Full report with date filter: Admin Panel → Dashboard → Website Visitors.</div>')
        html = wrap_email("Daily visitors", inner)
        sent = 0
        for to in await admin_emails():
            if await send_email(to=to, subject=f"{dayt['visitors']} visitors on {d.strftime('%d %b')} — Radhika Traders daily report", html=html):
                sent += 1
        await db.visit_reports.update_one({"date": day}, {"$set": {"date": day, "visitors": dayt["visitors"], "views": dayt["views"], "sent_to": sent, "sent_at": ist_today().isoformat()}}, upsert=True)
        return {"date": day, "visitors": dayt["visitors"], "sent": sent}

    @api.post("/cron/visitor-report", status_code=202)
    async def cron_visitor_report(request: Request, background: BackgroundTasks):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else ""
        if not secret or not token or not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        run_id = request.headers.get("x-webhook-id", "")
        day = dstr(ist_today() - timedelta(days=1))
        if run_id and await db.cron_runs.find_one({"run_id": run_id}):
            return {"ok": True, "duplicate": True}
        if run_id:
            await db.cron_runs.insert_one({"run_id": run_id, "job": "visitor-report", "at": ist_today().isoformat()})
        if await db.visit_reports.find_one({"date": day, "sent_to": {"$gt": 0}}):
            return {"ok": True, "already_sent": True}
        background.add_task(send_daily_report, day)
        return {"ok": True, "queued": True}

    @api.post("/admin/visits/send-report")
    async def admin_send_report(date: str = "", admin: dict = Depends(require_admin)):
        return await send_daily_report(date or None)

    api.ensure_indexes = ensure_indexes
    return api
