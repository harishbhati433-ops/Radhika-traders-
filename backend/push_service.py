"""Web Push (VAPID) — phone/desktop alerts that arrive even when the PWA is closed. Every in-app notification also goes out as a push."""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from pywebpush import webpush, WebPushException

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


def _deliver(sub: dict, payload: str) -> str:
    """Runs in a worker thread. Returns 'ok', 'gone' (subscription dead) or 'error'."""
    try:
        webpush(subscription_info=sub, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400, timeout=10)
        return "ok"
    except WebPushException as e:
        code = getattr(e.response, "status_code", None)
        if code in (404, 410):
            return "gone"
        logger.warning(f"push failed ({code}): {str(e)[:160]}")
        return "error"
    except Exception as e:
        logger.warning(f"push error: {str(e)[:160]}")
        return "error"


async def send_push(user_ids: list, title: str, body: str, link: str = "", tag: str = "", kind: str = "") -> dict:
    ids = [str(u) for u in user_ids if u]
    if _db is None or not ids:
        return {"sent": 0}
    subs = await _db.push_subscriptions.find({"user_id": {"$in": ids}}).to_list(2000)
    if not subs:
        return {"sent": 0}
    payload = json.dumps({"title": title[:120], "body": (body or "")[:300], "url": link or "/", "tag": tag or kind or "rt", "type": kind, "ts": _now()})
    results = await asyncio.gather(*[asyncio.to_thread(_deliver, s["subscription"], payload) for s in subs])
    gone = [s["_id"] for s, r in zip(subs, results) if r == "gone"]
    if gone:
        await _db.push_subscriptions.delete_many({"_id": {"$in": gone}})
    sent = sum(1 for r in results if r == "ok")
    await _db.push_log.insert_one({"title": title[:120], "users": len(ids), "devices": len(subs), "sent": sent, "gone": len(gone), "kind": kind, "created_at": _now()})
    return {"sent": sent, "devices": len(subs)}


def _fire(coro) -> None:
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        pass


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
