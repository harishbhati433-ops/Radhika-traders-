"""Shared 2-step verification (email OTP + 30-day trusted devices) for staff logins."""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request

from email_service import send_otp_email
from login_alerts import describe_ua

TRUSTED_DEVICE_DAYS = 30
MAX_TRIES = 5
RESEND_SECONDS = 45
PURPOSE = "admin_2fa"


def _h(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()


async def trusted_ok(db, user: dict, request: Request) -> bool:
    tok = request.headers.get("x-trusted-device", "")
    if not tok:
        return False
    rec = await db.admin_trusted_devices.find_one({"user_id": str(user["_id"]), "token_hash": _h(tok)})
    if not rec or rec["expires_at"] < _now():
        return False
    await db.admin_trusted_devices.update_one({"_id": rec["_id"]}, {"$set": {"last_used": _now(), "ip": client_ip(request)}})
    return True


async def send_otp(db, user: dict, to_email: str, for_name: str = "") -> bool:
    """OTP keyed by the account's email, delivered to `to_email` (may differ — e.g. owner receives an employee's code)."""
    key = user["email"]
    recent = await db.otp_codes.find_one({"email": key, "purpose": PURPOSE, "used": False, "created_at": {"$gt": (datetime.now(timezone.utc) - timedelta(seconds=RESEND_SECONDS)).isoformat()}})
    if recent:
        return True
    code = f"{secrets.randbelow(1000000):06d}"
    await db.otp_codes.delete_many({"email": key, "purpose": PURPOSE})
    await db.otp_codes.insert_one({"email": key, "code_hash": _h(code), "purpose": PURPOSE, "tries": 0,
                                   "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(), "used": False, "created_at": _now()})
    return bool(await send_otp_email(to_email, for_name or user.get("name", ""), code, PURPOSE))


async def verify_code(db, user: dict, code: str, on_locked=None) -> None:
    rec = await db.otp_codes.find_one({"email": user["email"], "purpose": PURPOSE, "used": False})
    if not rec or rec["expires_at"] < _now():
        raise HTTPException(status_code=400, detail="Code expired. Please request a new one.")
    if rec.get("tries", 0) >= MAX_TRIES:
        await db.otp_codes.delete_one({"_id": rec["_id"]})
        if on_locked:
            await on_locked()
        raise HTTPException(status_code=429, detail="Too many wrong codes. Request a new code.")
    if rec["code_hash"] != _h(code.strip()):
        await db.otp_codes.update_one({"_id": rec["_id"]}, {"$inc": {"tries": 1}})
        left = MAX_TRIES - rec.get("tries", 0) - 1
        raise HTTPException(status_code=400, detail=f"Wrong code. {left} attempt{'s' if left != 1 else ''} left.")
    await db.otp_codes.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})


async def issue_trusted(db, user: dict, request: Request) -> str:
    tok = secrets.token_urlsafe(32)
    browser, os_name = describe_ua(request.headers.get("user-agent", ""))
    await db.admin_trusted_devices.insert_one({"user_id": str(user["_id"]), "token_hash": _h(tok), "browser": browser, "os": os_name, "ip": client_ip(request),
                                               "created_at": _now(), "last_used": _now(), "expires_at": (datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_DAYS)).isoformat()})
    return tok


def mask_email(e: str) -> str:
    local, _, domain = (e or "").partition("@")
    if not domain:
        return e
    return (local[0] + "*" * max(3, len(local) - 2) + local[-1] if len(local) > 2 else local[0] + "***") + "@" + domain
