import base64
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from webauthn import generate_authentication_options, generate_registration_options, verify_authentication_response, verify_registration_response
from webauthn.helpers import options_to_json_dict
from webauthn.helpers.structs import AttestationConveyancePreference, AuthenticatorAttachment, AuthenticatorSelectionCriteria, PublicKeyCredentialDescriptor, ResidentKeyRequirement, UserVerificationRequirement

MAX_FAILS = 5
LOCK_MINUTES = 30
OTP_MINUTES = 10


def _now():
    return datetime.now(timezone.utc)


def _iso(dt=None):
    return (dt or _now()).isoformat()


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _client_challenge(cred) -> str:
    try:
        return json.loads(_b64d(cred.response["clientDataJSON"]).decode()).get("challenge", "")
    except Exception:
        return ""


def _mask(email: str) -> str:
    try:
        n, d = email.split("@")
        return f"{n[:2]}{'*' * max(2, len(n) - 2)}@{d}"
    except ValueError:
        return email


class PinIn(BaseModel):
    pin: str = Field(min_length=4, max_length=4)

    @field_validator("pin")
    @classmethod
    def digits(cls, v):
        if not v.isdigit():
            raise ValueError("PIN must be 4 digits")
        return v


class SetPinIn(PinIn):
    current_pin: Optional[str] = None


class ResetIn(PinIn):
    code: str


class CredentialIn(BaseModel):
    id: str
    rawId: str
    response: dict
    type: str = "public-key"
    clientExtensionResults: dict = {}
    authenticatorAttachment: Optional[str] = None


def build_app_lock_router(db, get_current_user, hash_password, verify_password, send_otp_email, log_activity) -> APIRouter:
    r = APIRouter(prefix="/app-lock", tags=["app-lock"])

    def rp_context(request: Request) -> tuple[str, str]:
        origin = request.headers.get("origin") or ""
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        o_host = urlparse(origin).hostname or ""
        if not origin.startswith("https://") or not o_host or o_host != host.split(":")[0]:
            raise HTTPException(status_code=400, detail="Biometric unlock needs a secure (https) origin on this domain.")
        return origin, o_host

    async def full_user(uid: str) -> dict:
        u = await db.users.find_one({"_id": ObjectId(uid)})
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        return u

    def lock_state(al: dict) -> tuple[bool, str]:
        until = al.get("locked_until") or ""
        return (bool(until) and until > _iso()), until

    async def status_payload(u: dict, rp_id: Optional[str]) -> dict:
        al = u.get("app_lock") or {}
        locked, until = lock_state(al)
        bio_q = {"user_id": str(u["_id"])}
        if rp_id:
            bio_q["rp_id"] = rp_id
        return {"configured": bool(al.get("pin_hash")), "enabled": bool(al.get("pin_hash")) and al.get("enabled", True),
                "biometric": await db.webauthn_credentials.count_documents(bio_q) > 0, "biometric_any": await db.webauthn_credentials.count_documents({"user_id": str(u["_id"])}),
                "locked_until": until if locked else "", "failures": int(al.get("failures", 0)), "email_masked": _mask(u.get("email") or ""), "set_at": al.get("set_at")}

    @r.get("/status")
    async def status(request: Request, user: dict = Depends(get_current_user)):
        host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
        return await status_payload(await full_user(user["id"]), host or None)

    @r.post("/pin/set")
    async def set_pin(body: SetPinIn, request: Request, user: dict = Depends(get_current_user)):
        u = await full_user(user["id"])
        al = u.get("app_lock") or {}
        if al.get("pin_hash") and al.get("enabled", True):
            if not body.current_pin or not verify_password(body.current_pin, al["pin_hash"]):
                raise HTTPException(status_code=400, detail="Current PIN is incorrect.")
        if len(set(body.pin)) == 1 or body.pin in ("1234", "0000", "4321"):
            raise HTTPException(status_code=400, detail="This PIN is too easy to guess. Choose a different 4-digit PIN.")
        first = not al.get("pin_hash")
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"app_lock": {"pin_hash": hash_password(body.pin), "enabled": True, "failures": 0, "locked_until": "",
                                                                                 "set_at": al.get("set_at") or _iso(), "updated_at": _iso()}}})
        await log_activity(user, "app_lock_pin_set" if first else "app_lock_pin_changed", request, entity_type="security", entity_id=user["id"], entity_label=user.get("name", ""))
        return {"ok": True, "message": "App Lock PIN set" if first else "PIN changed"}

    @r.post("/pin/unlock")
    async def unlock(body: PinIn, user: dict = Depends(get_current_user)):
        u = await full_user(user["id"])
        al = u.get("app_lock") or {}
        if not al.get("pin_hash"):
            raise HTTPException(status_code=404, detail="App Lock is not set up.")
        locked, until = lock_state(al)
        if locked:
            raise HTTPException(status_code=429, detail=f"Too many wrong attempts. Try again after {LOCK_MINUTES} minutes or use Forgot PIN.")
        if not verify_password(body.pin, al["pin_hash"]):
            fails = int(al.get("failures", 0)) + 1
            upd = {"app_lock.failures": fails}
            if fails >= MAX_FAILS:
                upd["app_lock.locked_until"] = _iso(_now() + timedelta(minutes=LOCK_MINUTES))
            await db.users.update_one({"_id": u["_id"]}, {"$set": upd})
            left = MAX_FAILS - fails
            raise HTTPException(status_code=400, detail=f"Wrong PIN. {left} attempt{'s' if left != 1 else ''} left." if left > 0 else f"Wrong PIN. Locked for {LOCK_MINUTES} minutes — use Forgot PIN to unlock now.")
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"app_lock.failures": 0, "app_lock.locked_until": "", "app_lock.last_unlock_at": _iso()}})
        return {"ok": True}

    @r.post("/forgot")
    async def forgot(request: Request, user: dict = Depends(get_current_user)):
        u = await full_user(user["id"])
        email = (u.get("email") or "").lower()
        if not email or email.endswith("@employee.radhikatraders.net"):
            raise HTTPException(status_code=400, detail="No email on this account. Ask your Super Admin to reset your App Lock.")
        recent = await db.app_lock_otps.find_one({"user_id": user["id"], "created_at": {"$gt": _iso(_now() - timedelta(seconds=45))}})
        if recent:
            raise HTTPException(status_code=429, detail="OTP already sent. Please wait a moment before requesting again.")
        code = f"{secrets.randbelow(10**6):06d}"
        await db.app_lock_otps.delete_many({"user_id": user["id"]})
        await db.app_lock_otps.insert_one({"user_id": user["id"], "code": code, "used": False, "attempts": 0, "expires_at": _iso(_now() + timedelta(minutes=OTP_MINUTES)), "created_at": _iso()})
        sent = await send_otp_email(email, u.get("name") or "", code, "app_lock")
        if not sent:
            await db.app_lock_otps.delete_many({"user_id": user["id"]})
            raise HTTPException(status_code=502, detail="Could not send the OTP email right now. Please try again.")
        return {"ok": True, "email_masked": _mask(email), "message": f"OTP sent to {_mask(email)}"}

    @r.post("/reset")
    async def reset(body: ResetIn, request: Request, user: dict = Depends(get_current_user)):
        rec = await db.app_lock_otps.find_one({"user_id": user["id"], "used": False})
        if not rec or rec["expires_at"] < _iso():
            raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
        if rec.get("attempts", 0) >= 5:
            raise HTTPException(status_code=429, detail="Too many wrong OTP attempts. Request a new OTP.")
        if rec["code"] != body.code.strip():
            await db.app_lock_otps.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
            raise HTTPException(status_code=400, detail="Invalid OTP.")
        if len(set(body.pin)) == 1 or body.pin in ("1234", "0000", "4321"):
            raise HTTPException(status_code=400, detail="This PIN is too easy to guess. Choose a different 4-digit PIN.")
        await db.app_lock_otps.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
        u = await full_user(user["id"])
        al = u.get("app_lock") or {}
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"app_lock": {**al, "pin_hash": hash_password(body.pin), "enabled": True, "failures": 0, "locked_until": "", "set_at": al.get("set_at") or _iso(), "updated_at": _iso()}}})
        await log_activity(user, "app_lock_pin_reset", request, entity_type="security", entity_id=user["id"], entity_label=user.get("name", ""))
        return {"ok": True, "message": "New PIN set"}

    @r.post("/disable")
    async def disable(body: PinIn, request: Request, user: dict = Depends(get_current_user)):
        u = await full_user(user["id"])
        al = u.get("app_lock") or {}
        if not al.get("pin_hash") or not verify_password(body.pin, al["pin_hash"]):
            raise HTTPException(status_code=400, detail="PIN is incorrect.")
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"app_lock.enabled": False, "app_lock.updated_at": _iso()}})
        await db.webauthn_credentials.delete_many({"user_id": user["id"]})
        await log_activity(user, "app_lock_disabled", request, entity_type="security", entity_id=user["id"], entity_label=user.get("name", ""))
        return {"ok": True, "message": "App Lock turned off"}

    @r.post("/enable")
    async def enable(request: Request, user: dict = Depends(get_current_user)):
        u = await full_user(user["id"])
        if not (u.get("app_lock") or {}).get("pin_hash"):
            raise HTTPException(status_code=400, detail="Set a PIN first.")
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"app_lock.enabled": True, "app_lock.failures": 0, "app_lock.locked_until": "", "app_lock.updated_at": _iso()}})
        return {"ok": True, "message": "App Lock turned on"}

    # ---------------- Biometric (WebAuthn platform authenticator) ----------------
    @r.post("/biometric/register/options")
    async def bio_register_options(request: Request, user: dict = Depends(get_current_user)):
        origin, rp_id = rp_context(request)
        u = await full_user(user["id"])
        handle = u.get("webauthn_user_id")
        if not handle:
            handle = _b64e(secrets.token_bytes(32))
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"webauthn_user_id": handle}})
        existing = await db.webauthn_credentials.find({"user_id": user["id"], "rp_id": rp_id}).to_list(20)
        opts = generate_registration_options(
            rp_id=rp_id, rp_name="Radhika Traders", user_id=_b64d(handle), user_name=u.get("email") or u.get("username") or user["id"], user_display_name=u.get("name") or "Partner",
            authenticator_selection=AuthenticatorSelectionCriteria(authenticator_attachment=AuthenticatorAttachment.PLATFORM, user_verification=UserVerificationRequirement.REQUIRED, resident_key=ResidentKeyRequirement.PREFERRED),
            exclude_credentials=[PublicKeyCredentialDescriptor(id=_b64d(c["credential_id"])) for c in existing], attestation=AttestationConveyancePreference.NONE, timeout=60000)
        await db.webauthn_challenges.insert_one({"user_id": user["id"], "ceremony": "register", "challenge": _b64e(opts.challenge), "origin": origin, "rp_id": rp_id, "expires_at": _now() + timedelta(minutes=5)})
        return options_to_json_dict(opts)

    @r.post("/biometric/register/finish")
    async def bio_register_finish(cred: CredentialIn, request: Request, user: dict = Depends(get_current_user)):
        origin, rp_id = rp_context(request)
        ch = await db.webauthn_challenges.find_one_and_delete({"user_id": user["id"], "ceremony": "register", "origin": origin, "rp_id": rp_id, "challenge": _client_challenge(cred), "expires_at": {"$gt": _now()}})
        if not ch:
            raise HTTPException(status_code=400, detail="Registration expired. Please try again.")
        try:
            res = verify_registration_response(credential=cred.model_dump(exclude_none=True), expected_challenge=_b64d(ch["challenge"]), expected_rp_id=rp_id, expected_origin=origin, require_user_verification=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not verify this device: {str(e)[:120]}")
        cid = _b64e(res.credential_id)
        await db.webauthn_credentials.update_one({"user_id": user["id"], "credential_id": cid}, {"$set": {
            "user_id": user["id"], "credential_id": cid, "public_key": _b64e(res.credential_public_key), "sign_count": res.sign_count, "transports": cred.response.get("transports", []),
            "rp_id": rp_id, "device": (request.headers.get("user-agent") or "")[:160], "created_at": _iso(), "last_used_at": ""}}, upsert=True)
        await log_activity(user, "app_lock_biometric_added", request, entity_type="security", entity_id=user["id"], entity_label=user.get("name", ""))
        return {"ok": True, "message": "Fingerprint / Face unlock enabled on this device"}

    @r.post("/biometric/unlock/options")
    async def bio_unlock_options(request: Request, user: dict = Depends(get_current_user)):
        origin, rp_id = rp_context(request)
        rows = await db.webauthn_credentials.find({"user_id": user["id"], "rp_id": rp_id}).to_list(20)
        if not rows:
            raise HTTPException(status_code=404, detail="Fingerprint is not set up on this device. Use your PIN.")
        opts = generate_authentication_options(rp_id=rp_id, allow_credentials=[PublicKeyCredentialDescriptor(id=_b64d(c["credential_id"]), transports=None) for c in rows],
                                               user_verification=UserVerificationRequirement.REQUIRED, timeout=60000)
        await db.webauthn_challenges.insert_one({"user_id": user["id"], "ceremony": "unlock", "challenge": _b64e(opts.challenge), "origin": origin, "rp_id": rp_id, "expires_at": _now() + timedelta(minutes=5)})
        return options_to_json_dict(opts)

    @r.post("/biometric/unlock/finish")
    async def bio_unlock_finish(cred: CredentialIn, request: Request, user: dict = Depends(get_current_user)):
        origin, rp_id = rp_context(request)
        row = await db.webauthn_credentials.find_one({"user_id": user["id"], "credential_id": cred.id, "rp_id": rp_id})
        if not row:
            raise HTTPException(status_code=400, detail="Unknown device credential. Use your PIN.")
        ch = await db.webauthn_challenges.find_one_and_delete({"user_id": user["id"], "ceremony": "unlock", "origin": origin, "rp_id": rp_id, "challenge": _client_challenge(cred), "expires_at": {"$gt": _now()}})
        if not ch:
            raise HTTPException(status_code=400, detail="Unlock request expired. Please try again.")
        try:
            res = verify_authentication_response(credential=cred.model_dump(exclude_none=True), expected_challenge=_b64d(ch["challenge"]), expected_rp_id=rp_id, expected_origin=origin,
                                                 credential_public_key=_b64d(row["public_key"]), credential_current_sign_count=int(row.get("sign_count", 0)), require_user_verification=True)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Fingerprint verification failed: {str(e)[:120]}")
        await db.webauthn_credentials.update_one({"_id": row["_id"]}, {"$set": {"sign_count": res.new_sign_count, "last_used_at": _iso()}})
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"app_lock.failures": 0, "app_lock.locked_until": "", "app_lock.last_unlock_at": _iso()}})
        return {"ok": True}

    @r.delete("/biometric")
    async def bio_remove(request: Request, user: dict = Depends(get_current_user)):
        host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
        res = await db.webauthn_credentials.delete_many({"user_id": user["id"], "rp_id": host})
        await log_activity(user, "app_lock_biometric_removed", request, entity_type="security", entity_id=user["id"], entity_label=user.get("name", ""))
        return {"ok": True, "removed": res.deleted_count, "message": "Fingerprint unlock removed from this device"}

    return r
