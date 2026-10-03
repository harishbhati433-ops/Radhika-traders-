"""Admin-configurable office timing (start / end / auto-close). Required hours (7h) and Sunday weekly-off stay fixed."""
import re
from datetime import datetime, timezone

REQUIRED_MINUTES = 7 * 60
DEFAULT = {"start": "10:00", "end": "17:00", "auto_close": "18:00"}
_T = dict(DEFAULT)
_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def _tuple(s: str) -> tuple:
    h, m = s.split(":")
    return int(h), int(m)


def _minutes(s: str) -> int:
    h, m = _tuple(s)
    return h * 60 + m


def fmt12(s: str) -> str:
    return datetime.strptime(s, "%H:%M").strftime("%I:%M %p")


def start() -> tuple: return _tuple(_T["start"])
def end() -> tuple: return _tuple(_T["end"])
def auto_close() -> tuple: return _tuple(_T["auto_close"])
def start_min() -> int: return _minutes(_T["start"])
def end_min() -> int: return _minutes(_T["end"])
def auto_close_min() -> int: return _minutes(_T["auto_close"])
def start_12() -> str: return fmt12(_T["start"])
def end_12() -> str: return fmt12(_T["end"])
def auto_close_12() -> str: return fmt12(_T["auto_close"])


def current() -> dict:
    return {**_T, "start_12": start_12(), "end_12": end_12(), "auto_close_12": auto_close_12(), "required_minutes": REQUIRED_MINUTES, "weekly_off": "Sunday"}


def validate(start_s: str, end_s: str, close_s: str) -> str | None:
    for v in (start_s, end_s, close_s):
        if not _HHMM.match(v or ""):
            return "Time must be in HH:MM (24-hour) format"
    if _minutes(end_s) - _minutes(start_s) < REQUIRED_MINUTES:
        return f"Office End must be at least {REQUIRED_MINUTES // 60} hours after Office Start (Full Day = {REQUIRED_MINUTES // 60} hours)"
    if _minutes(close_s) <= _minutes(end_s):
        return "Auto-close time must be after Office End"
    return None


async def load(db) -> None:
    doc = await db.settings.find_one({"key": "office_timing"}) or {}
    for k in DEFAULT:
        if _HHMM.match(str(doc.get(k) or "")):
            _T[k] = doc[k]


async def save(db, start_s: str, end_s: str, close_s: str, by: str) -> dict:
    _T.update({"start": start_s, "end": end_s, "auto_close": close_s})
    await db.settings.update_one({"key": "office_timing"}, {"$set": {**_T, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": by}}, upsert=True)
    return current()
