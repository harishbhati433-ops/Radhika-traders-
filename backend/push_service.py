"""Web Push (VAPID) — phone/desktop alerts that arrive even when the PWA is closed. Every in-app notification also goes out as a push."""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from pymongo.errors import DuplicateKeyError

logger = logging.getLogger("push")
_db = None

VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]
VAPID_PUBLIC_KEY = os.environ["VAPID_PUBLIC_KEY"]
VAPID_SUBJECT = os.environ["VAPID_SUBJECT"]


def init(db) -> None:
    global _db
    _db = db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def save_subscription(user_id: str, role: str, sub: dict, device: str) -> None:
    await _db.push_subscriptions.update_one({"endpoint": sub["endpoint"]}, {"$set": {
        "user_id": user_id, "role": role, "subscription": sub, "device": device[:200], "updated_at": _now(), "failures": 0},
        "$setOnInsert": {"created_at": _now()}}, upsert=True)


async def remove_subscription(user_id: str, endpoint: str) -> int:
    r = await _db.push_subscriptions.delete_one({"user_id": user_id, "endpoint": endpoint})
    return r.deleted_count


async def count_for(user_id: str) -> int:
    return await _db.push_subscriptions.count_documents({"user_id": user_id})


async def admin_ids() -> list[str]:
    return [str(a["_id"]) async for a in _db.users.find({"role": "admin", "account_status": {"$ne": "deleted"}}, {"_id": 1})]


def _deliver(sub: dict, payload: str) -> tuple:
    """Runs in a worker thread. Returns (status, detail): 'ok' | 'gone' (subscription dead) | 'error'."""
    from pywebpush import webpush, WebPushException  # lazy: ~40 MB, only needed when a push is actually sent
    try:
        webpush(subscription_info=sub, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400, timeout=10)
        return "ok", ""
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        if code in (404, 410):
            return "gone", f"HTTP {code} subscription expired"
        logger.warning(f"push failed ({code}): {str(e)[:160]}")
        return "error", f"HTTP {code}: {str(e)[:160]}" if code else str(e)[:200]
    except Exception as e:
        logger.warning(f"push error: {str(e)[:160]}")
        return "error", str(e)[:200]


def _host(endpoint: str) -> str:
    return endpoint.split("/")[2] if endpoint.startswith("http") else endpoint[:40]


async def send_push(user_ids: list, title: str, body: str, link: str = "", tag: str = "", kind: str = "", event_key: str = "") -> dict:
    """Pushes to every device of the given users. event_key (optional) makes the call idempotent: the same key is delivered once, ever."""
    ids = [str(u) for u in user_ids if u]
    if _db is None or not ids:
        return {"sent": 0, "devices": 0, "reason": "no recipients"}
    if event_key:
        try:
            await _db.push_events.insert_one({"_id": event_key, "title": title[:120], "users": ids, "created_at": _now()})
        except DuplicateKeyError:
            logger.info(f"push skipped — duplicate event {event_key}")
            return {"sent": 0, "devices": 0, "skipped": "duplicate", "reason": f"duplicate event {event_key}"}
    subs = await _db.push_subscriptions.find({"user_id": {"$in": ids}}).to_list(2000)
    entry = {"title": title[:120], "kind": kind, "event_key": event_key, "users": len(ids), "user_ids": ids[:50], "devices": len(subs), "sent": 0, "gone": 0, "failed": 0, "errors": [], "created_at": _now()}
    if not subs:
        entry["reason"] = "no subscribed device — user has not turned on phone alerts"
        await _db.push_log.insert_one(entry)
        return {"sent": 0, "devices": 0, "reason": entry["reason"]}
    payload = json.dumps({"title": title[:120], "body": (body or "")[:300], "url": link or "/", "tag": tag or kind or "rt", "type": kind, "ts": _now()})
    results = await asyncio.gather(*[asyncio.to_thread(_deliver, s["subscription"], payload) for s in subs])
    gone = [s["_id"] for s, (r, _) in zip(subs, results) if r == "gone"]
    if gone:
        await _db.push_subscriptions.delete_many({"_id": {"$in": gone}})
    entry["sent"] = sum(1 for r, _ in results if r == "ok")
    entry["gone"] = len(gone)
    entry["failed"] = sum(1 for r, _ in results if r == "error")
    entry["errors"] = [{"user_id": s["user_id"], "device": _host(s["endpoint"]), "status": r, "error": d} for s, (r, d) in zip(subs, results) if r != "ok"][:50]
    if entry["sent"] == 0:
        entry["reason"] = "all devices failed/expired — see errors"
    await _db.push_log.insert_one(entry)
    return {"sent": entry["sent"], "devices": len(subs), "failed": entry["failed"], "gone": entry["gone"]}


_tasks: set = set()


def _fire(coro) -> None:
    """Background task that is kept referenced until done — un-referenced tasks can be garbage-collected mid-flight and silently never deliver."""
    try:
        t = asyncio.get_running_loop().create_task(coro)
        _tasks.add(t)
        t.add_done_callback(_tasks.discard)
    except RuntimeError:
        pass


fire = _fire


async def notify_one(doc: dict):
    """Drop-in for db.notifications.insert_one: stores the in-app notification and pushes it to the user's devices."""
    res = await _db.notifications.insert_one(doc)
    _fire(send_push([doc["user_id"]], doc.get("title", ""), doc.get("body", ""), doc.get("link", ""), kind=doc.get("type", "")))
    return res


async def notify_many(docs: list):
    """Drop-in for db.notifications.insert_many: one push per distinct message, fanned out to all its recipients."""
    if not docs:
        return None
    res = await _db.notifications.insert_many(docs)
    groups: dict = {}
    for d in docs:
        groups.setdefault((d.get("title", ""), d.get("body", ""), d.get("link", ""), d.get("type", "")), []).append(d["user_id"])
    for (title, body, link, kind), uids in groups.items():
        _fire(send_push(uids, title, body, link, kind=kind))
    return res
