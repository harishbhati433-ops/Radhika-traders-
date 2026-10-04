"""Attendance verification policy: normal | gps | gps_selfie (global default + per-employee override), office geofence, selfie storage/cleanup."""
import base64
import logging
import math
import re
import uuid
from datetime import datetime, timezone, timedelta

import requests
from storage_service import put_object, STORAGE_URL, init_storage, APP_NAME

logger = logging.getLogger("attendance.policy")
MODES = ("normal", "gps", "gps_selfie")
MODE_LABELS = {"normal": "Normal", "gps": "GPS only (within office radius)", "gps_selfie": "GPS + Selfie"}
DEFAULT = {"mode": "normal", "office_lat": 23.721839, "office_lng": 76.018929, "radius_m": 150, "selfie_retention_days": 60, "office_label": "Radhika Traders, Agar"}  # from owner's Google Maps link
_P = dict(DEFAULT)
MAX_SELFIE_BYTES = 600_000
_DATA_URL = re.compile(r"^data:image/(jpeg|jpg|png|webp);base64,", re.I)


def current() -> dict:
    return {**_P, "office_set": _P["office_lat"] is not None and _P["office_lng"] is not None, "mode_label": MODE_LABELS[_P["mode"]]}


def mode_for(user: dict | None) -> str:
    m = (user or {}).get("attendance_mode")
    m = m if m in MODES else _P["mode"]
    if m != "normal" and not current()["office_set"]:
        return "normal"  # geofence impossible without an office location → never block attendance
    return m


def employee_policy(user: dict | None) -> dict:
    m = mode_for(user)
    return {"mode": m, "mode_label": MODE_LABELS[m], "radius_m": _P["radius_m"], "gps_required": m != "normal", "selfie_required_on_checkin": m == "gps_selfie",
            "office_label": _P["office_label"], "override": (user or {}).get("attendance_mode") in MODES}


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def verify_location(lat, lng, accuracy) -> tuple[dict | None, str | None]:
    """Returns (gps_record, error). Error text is shown to the employee."""
    if lat is None or lng is None:
        return None, "Live location is required for attendance. Please allow location access and try again."
    try:
        lat, lng = float(lat), float(lng)
        acc = float(accuracy) if accuracy is not None else None
    except (TypeError, ValueError):
        return None, "Invalid location data"
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, "Invalid location data"
    if acc is not None and acc > 300:
        return None, f"GPS signal is too weak (±{int(acc)} m). Please step outside / enable high-accuracy location and try again."
    d = distance_m(lat, lng, _P["office_lat"], _P["office_lng"])
    tolerance = min(acc or 0, 20)  # small allowance for phone GPS jitter
    rec = {"lat": round(lat, 6), "lng": round(lng, 6), "accuracy_m": round(acc, 1) if acc is not None else None, "distance_m": round(d, 1), "radius_m": _P["radius_m"]}
    if d - tolerance > _P["radius_m"]:
        return rec, f"You are {int(d)} m away from the office. Attendance is allowed only within {_P['radius_m']} m of the office."
    return rec, None


def validate_settings(body: dict) -> str | None:
    if body.get("mode") not in MODES:
        return "Invalid attendance mode"
    lat, lng = body.get("office_lat"), body.get("office_lng")
    if (lat is None) != (lng is None):
        return "Both latitude and longitude are required"
    if lat is not None and not (-90 <= float(lat) <= 90 and -180 <= float(lng) <= 180):
        return "Invalid office coordinates"
    if body.get("mode") != "normal" and lat is None:
        return "Set the office location first (use 'Use my current location' while at the office) before enabling GPS modes"
    if not (20 <= int(body.get("radius_m") or 0) <= 2000):
        return "Radius must be between 20 and 2000 metres"
    if not (7 <= int(body.get("selfie_retention_days") or 0) <= 365):
        return "Selfie retention must be between 7 and 365 days"
    return None


async def load(db) -> None:
    doc = await db.settings.find_one({"key": "attendance_policy"}) or {}
    for k in DEFAULT:
        if k in doc:
            _P[k] = doc[k]
    if _P["mode"] not in MODES:
        _P["mode"] = "normal"
    global _loaded_at
    _loaded_at = datetime.now(timezone.utc)


_loaded_at = None


async def refresh(db, ttl_seconds: int = 5) -> None:
    """Re-read from DB every few seconds so every worker/replica sees admin changes immediately."""
    if _loaded_at is None or (datetime.now(timezone.utc) - _loaded_at).total_seconds() > ttl_seconds:
        await load(db)


async def save(db, body: dict, by: str) -> dict:
    _P.update({"mode": body["mode"], "office_lat": None if body.get("office_lat") is None else round(float(body["office_lat"]), 6),
               "office_lng": None if body.get("office_lng") is None else round(float(body["office_lng"]), 6), "radius_m": int(body["radius_m"]),
               "selfie_retention_days": int(body["selfie_retention_days"]), "office_label": (body.get("office_label") or "")[:120]})
    await db.settings.update_one({"key": "attendance_policy"}, {"$set": {**_P, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": by}}, upsert=True)
    return current()


async def store_selfie(db, data_url: str, employee_id: str) -> str:
    """Saves a base64 JPEG/PNG selfie to object storage; returns /api/files/<path> URL. Raises ValueError on bad input."""
    m = _DATA_URL.match(data_url or "")
    if not m:
        raise ValueError("Selfie must be a JPEG/PNG image")
    raw = base64.b64decode(data_url[m.end():], validate=False)
    if not raw or len(raw) > MAX_SELFIE_BYTES:
        raise ValueError("Selfie image is too large — please retake")
    ext = "png" if m.group(1).lower() == "png" else "jpg"
    ct = "image/png" if ext == "png" else "image/jpeg"
    path = f"{APP_NAME}/selfies/{employee_id}/{uuid.uuid4().hex}.{ext}"
    stored = put_object(path, raw, ct)
    await db.files.insert_one({"storage_path": stored["path"], "original_filename": f"selfie.{ext}", "content_type": ct, "size": len(raw), "is_deleted": False,
                               "kind": "attendance_selfie", "created_at": datetime.now(timezone.utc).isoformat()})
    return f"/api/files/{stored['path']}"


def _delete_object(path: str) -> None:
    try:
        requests.delete(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=30)
    except Exception as e:  # storage delete is best-effort; the DB record is what makes the file unreachable
        logger.warning(f"selfie object delete failed for {path}: {e}")


async def cleanup_selfies(db) -> int:
    """Removes selfies older than the retention window (skips entries still pending admin review)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=int(_P["selfie_retention_days"]))).date().isoformat()
    cur = db.attendance.find({"selfie_url": {"$nin": [None, ""]}, "date": {"$lt": cutoff}, "status": {"$ne": "checkout_missing"}}, {"selfie_url": 1})
    n = 0
    async for a in cur:
        path = a["selfie_url"].replace("/api/files/", "", 1)
        await db.files.update_one({"storage_path": path}, {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc).isoformat()}})
        _delete_object(path)
        await db.attendance.update_one({"_id": a["_id"]}, {"$set": {"selfie_url": None, "selfie_expired": True}})
        n += 1
    return n
