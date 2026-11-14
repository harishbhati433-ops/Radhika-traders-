"""Campaign start/end date automation: scheduled → live on start_date, live → closed after end_date (IST calendar days)."""
import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30))
LAZY_INTERVAL = 600
_last_run = 0.0


def ist_today() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def normalize_schedule(doc: dict, today: str | None = None) -> None:
    """Applied on create/update: validates dates and derives scheduled/live from the start date."""
    from fastapi import HTTPException
    today = today or ist_today()
    start, end = (doc.get("start_date") or "")[:10], (doc.get("end_date") or "")[:10]
    doc["start_date"], doc["end_date"] = start, end
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="End date cannot be before the start date.")
    if doc.get("status") == "live" and end and end < today:
        raise HTTPException(status_code=400, detail=f"End date {end} is already over. Extend or clear the end date to make this campaign live.")
    if doc.get("status") == "live" and start and start > today:
        doc["status"] = "scheduled"
    elif doc.get("status") == "scheduled" and (not start or start <= today):
        doc["status"] = "live"


async def apply_schedule(db, announce, sync_stories=None) -> dict:
    """Idempotent sweep: opens campaigns whose start date has arrived, closes those whose end date has passed."""
    today, now = ist_today(), datetime.now(timezone.utc).isoformat()
    opened = closed = 0
    async for c in db.campaigns.find({"is_deleted": False, "status": "scheduled", "start_date": {"$ne": "", "$lte": today}}):
        r = await db.campaigns.update_one({"_id": c["_id"], "status": "scheduled"}, {"$set": {"status": "live", "auto_opened_at": now, "updated_at": now}})
        if r.modified_count:
            opened += 1
            await announce({**c, "status": "live"}, "live", "")
    async for c in db.campaigns.find({"is_deleted": False, "status": "live", "end_date": {"$ne": "", "$lt": today}}):
        r = await db.campaigns.update_one({"_id": c["_id"], "status": "live"}, {"$set": {"status": "closed", "auto_closed_at": now, "updated_at": now}})
        if r.modified_count:
            closed += 1
            await announce({**c, "status": "closed"}, "closed", "")
    if (opened or closed) and sync_stories:
        await sync_stories(True)
    if opened or closed:
        logger.info(f"campaign schedule: opened={opened} closed={closed}")
    return {"today": today, "opened": opened, "closed": closed}


def maybe_apply(db, announce, sync_stories=None) -> None:
    """Cheap safety net from public reads: at most one sweep per LAZY_INTERVAL, in the background."""
    global _last_run
    if time.monotonic() - _last_run < LAZY_INTERVAL:
        return
    _last_run = time.monotonic()
    task = asyncio.ensure_future(apply_schedule(db, announce, sync_stories))
    task.add_done_callback(lambda t: t.exception() and logger.warning(f"campaign schedule sweep failed: {t.exception()}"))
