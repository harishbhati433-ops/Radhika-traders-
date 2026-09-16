"""Secure password reset via email OTP: 5-min OTP, hashed at rest, wrong-attempt + resend lockout, all-device logout on success."""
import hashlib
import hmac
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from auth_utils import hash_password, generate_otp, create_access_token
from email_service import send_otp_email, send_password_changed_email

OTP_TTL_MIN = 5
OTP_MAX_WRONG = 5
OTP_LOCK_MIN = 15
RESEND_COOLDOWN_SEC = 60
MAX_SENDS_PER_WINDOW = 5
SEND_WINDOW_MIN = 15


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d: datetime) -> str:
    return d.isoformat()


def _hash(email: str, code: str) -> str:
    return hmac.new(os.environ["JWT_SECRET"].encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()


class ForgotIn(BaseModel):
    email: EmailStr
    portal: Optional[str] = "customer"


class ResetIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str
    portal: Optional[str] = "customer"


class InPanelResetIn(BaseModel):
    code: str
    new_password: str


def build_router(db, get_current_user, log_security, public_user) -> APIRouter:
    r = APIRouter()

    async def _lock_state(email: str) -> dict:
        return await db.otp_locks.find_one({"identifier": f"reset:{email}"}) or {"identifier": f"reset:{email}", "sends": [], "wrong": 0}

    def _assert_not_locked(lock: dict) -> None:
        lu = lock.get("locked_until") or ""
        if lu > _iso(_now()):
            mins = max(1, int((datetime.fromisoformat(lu) - _now()).total_seconds() // 60) + 1)
            raise HTTPException(status_code=429, detail=f"Too many attempts. OTP is locked — try again after {mins} minute{'s' if mins != 1 else ''}.")

    async def _lock(email: str, lock: dict, reason: str, request: Request, user_id: Optional[str]) -> None:
        await db.otp_locks.update_one({"identifier": f"reset:{email}"}, {"$set": {"locked_until": _iso(_now() + timedelta(minutes=OTP_LOCK_MIN)), "wrong": 0, "sends": [], "reason": reason, "email": email}}, upsert=True)
        await db.pwd_reset_otps.delete_many({"email": email})
        await log_security(user_id, "password_reset_locked", request, reason)

    async def _send(email: str, user: dict, request: Request) -> dict:
        lock = await _lock_state(email)
        _assert_not_locked(lock)
        now = _now()
        sends = [s for s in lock.get("sends", []) if s > _iso(now - timedelta(minutes=SEND_WINDOW_MIN))]
        if sends and sends[-1] > _iso(now - timedelta(seconds=RESEND_COOLDOWN_SEC)):
            wait = RESEND_COOLDOWN_SEC - int((now - datetime.fromisoformat(sends[-1])).total_seconds())
            raise HTTPException(status_code=429, detail=f"OTP already sent. You can request a new one in {max(wait, 1)} seconds.")
        if len(sends) >= MAX_SENDS_PER_WINDOW:
            await _lock(email, lock, f"{len(sends)} OTP requests in {SEND_WINDOW_MIN} min", request, str(user["_id"]))
            raise HTTPException(status_code=429, detail=f"Too many OTP requests. Locked for {OTP_LOCK_MIN} minutes.")
        code = generate_otp()
        await db.pwd_reset_otps.delete_many({"email": email})
        await db.pwd_reset_otps.insert_one({"email": email, "code_hash": _hash(email, code), "attempts": 0, "used": False,
                                           "expires_at": _iso(now + timedelta(minutes=OTP_TTL_MIN)), "created_at": _iso(now), "ip": _ip(request)})
        await db.otp_locks.update_one({"identifier": f"reset:{email}"}, {"$set": {"sends": sends + [_iso(now)], "email": email}}, upsert=True)
        sent = await send_otp_email(email, user.get("name", ""), code, "reset")
        if not sent:
            await db.pwd_reset_otps.delete_many({"email": email})
            raise HTTPException(status_code=502, detail="We could not deliver the OTP to this email right now. Please try again in a minute.")
        await log_security(str(user["_id"]), "password_reset_otp_sent", request, f"role={user.get('role')}")
        return {"expires_in": OTP_TTL_MIN * 60, "resend_in": RESEND_COOLDOWN_SEC}

    async def _verify_and_reset(email: str, code: str, new_password: str, request: Request, user: dict) -> dict:
        lock = await _lock_state(email)
        _assert_not_locked(lock)
        rec = await db.pwd_reset_otps.find_one({"email": email, "used": False})
        if not rec or rec["expires_at"] < _iso(_now()):
            raise HTTPException(status_code=400, detail="OTP expired or not requested. Please request a new OTP.")
        if not hmac.compare_digest(rec["code_hash"], _hash(email, code.strip())):
            attempts = rec.get("attempts", 0) + 1
            if attempts >= OTP_MAX_WRONG:
                await _lock(email, lock, f"{attempts} wrong OTP attempts", request, str(user["_id"]))
                raise HTTPException(status_code=429, detail=f"Too many wrong OTP attempts. Locked for {OTP_LOCK_MIN} minutes.")
            await db.pwd_reset_otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
            left = OTP_MAX_WRONG - attempts
            raise HTTPException(status_code=400, detail=f"Invalid OTP. {left} attempt{'s' if left != 1 else ''} left before lock.")
        if len(new_password) < 8:
            raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
        await db.pwd_reset_otps.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
        tv = int(user.get("token_version", 0)) + 1
        when = _iso(_now())
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(new_password), "token_version": tv, "password_changed_at": when}})
        await db.otp_locks.delete_one({"identifier": f"reset:{email}"})
        await db.login_attempts.delete_many({"email": email})
        await log_security(str(user["_id"]), "password_reset_via_otp", request, "all sessions revoked")
        ist = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%d %b %Y, %I:%M %p IST")
        await send_password_changed_email(email, user.get("name", ""), ist, _ip(request))
        fresh = await db.users.find_one({"_id": user["_id"]})
        return {"token": create_access_token(str(fresh["_id"]), email, fresh["role"], tv), "user": public_user(fresh)}

    def _portal_ok(user: Optional[dict], portal: str) -> bool:
        if not user or user.get("account_status") == "deleted":
            return False
        return user.get("role") == "admin" if portal == "admin" else user.get("role") == "customer"

    @r.post("/auth/forgot-password")
    async def forgot_password(body: ForgotIn, request: Request):
        email = body.email.lower()
        user = await db.users.find_one({"email": email})
        if not _portal_ok(user, body.portal or "customer"):
            return {"message": "If the email exists, an OTP has been sent", "expires_in": OTP_TTL_MIN * 60, "resend_in": RESEND_COOLDOWN_SEC}
        return {"message": "OTP sent to your email", **await _send(email, user, request)}

    @r.post("/auth/reset-password")
    async def reset_password(body: ResetIn, request: Request):
        email = body.email.lower()
        user = await db.users.find_one({"email": email})
        if not _portal_ok(user, body.portal or "customer"):
            raise HTTPException(status_code=400, detail="OTP expired or not requested. Please request a new OTP.")
        await _verify_and_reset(email, body.code, body.new_password, request, user)
        return {"message": "Password reset successful. You have been logged out from all devices — please login with your new password."}

    @r.post("/security/reset-password/otp")
    async def in_panel_otp(request: Request, user: dict = Depends(get_current_user)):
        from bson import ObjectId
        full = await db.users.find_one({"_id": ObjectId(user["id"])})
        return {"message": f"OTP sent to {full['email']}", **await _send(full["email"], full, request)}

    @r.post("/security/reset-password")
    async def in_panel_reset(body: InPanelResetIn, request: Request, user: dict = Depends(get_current_user)):
        from bson import ObjectId
        full = await db.users.find_one({"_id": ObjectId(user["id"])})
        out = await _verify_and_reset(full["email"], body.code, body.new_password, request, full)
        return {"message": "Password changed. All other devices have been logged out.", **out}

    @r.post("/security/logout-all")
    async def logout_all(request: Request, user: dict = Depends(get_current_user)):
        from bson import ObjectId
        full = await db.users.find_one({"_id": ObjectId(user["id"])})
        tv = int(full.get("token_version", 0)) + 1
        await db.users.update_one({"_id": full["_id"]}, {"$set": {"token_version": tv, "sessions_revoked_at": _iso(_now())}})
        await log_security(str(full["_id"]), "logout_all_devices", request, "all other sessions revoked")
        fresh = await db.users.find_one({"_id": full["_id"]})
        return {"message": "Logged out from all other devices. Only this session stays signed in.",
                "token": create_access_token(str(fresh["_id"]), fresh["email"], fresh["role"], tv), "user": public_user(fresh)}

    @r.delete("/security/devices/{fingerprint}")
    async def remove_device(fingerprint: str, request: Request, user: dict = Depends(get_current_user)):
        dev = await db.admin_devices.find_one({"user_id": user["id"], "fingerprint": fingerprint})
        if not dev:
            raise HTTPException(status_code=404, detail="Device not found")
        await db.admin_devices.delete_one({"_id": dev["_id"]})
        await log_security(user["id"], "device_removed", request, f"{dev.get('browser')} on {dev.get('os')} · IP {dev.get('ip')}")
        return {"message": f"{dev.get('browser')} on {dev.get('os')} removed — you will get a fresh alert if it logs in again."}

    return r
