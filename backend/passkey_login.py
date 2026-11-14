"""Username-less passkey login: the fingerprint registered for App Lock also signs the user back in after browser data is cleared."""
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app_lock_routes import CredentialIn, _b64d, _b64e, _client_challenge, _iso, _now, _wa

PORTAL_ROLE = {"customer": "customer", "admin": "admin", "employee": "employee"}


class PasskeyLoginIn(BaseModel):
    portal: str = "customer"
    credential: CredentialIn


def build_passkey_router(db, create_access_token, public_user, log_security, issue_trusted) -> APIRouter:
    r = APIRouter(prefix="/auth/passkey", tags=["passkey"])

    def rp_context(request: Request) -> tuple[str, str]:
        origin = request.headers.get("origin") or ""
        host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
        o_host = origin.split("//")[-1].split("/")[0].split(":")[0] if origin else ""
        if not origin.startswith("https://") or not o_host or o_host != host:
            raise HTTPException(status_code=400, detail="Passkey login needs a secure (https) origin on this domain.")
        return origin, o_host

    @r.post("/options")
    async def options(request: Request):
        origin, rp_id = rp_context(request)
        await db.webauthn_challenges.delete_many({"ceremony": "login", "expires_at": {"$lt": _now()}})
        wa = _wa()
        opts = wa.generate_authentication_options(rp_id=rp_id, user_verification=wa.structs.UserVerificationRequirement.REQUIRED, timeout=60000)
        await db.webauthn_challenges.insert_one({"ceremony": "login", "challenge": _b64e(opts.challenge), "origin": origin, "rp_id": rp_id, "expires_at": _now() + timedelta(minutes=5)})
        return wa.options_to_json_dict(opts)

    @r.post("/login")
    async def login(body: PasskeyLoginIn, request: Request):
        origin, rp_id = rp_context(request)
        cred = body.credential
        role = PORTAL_ROLE.get(body.portal)
        if not role:
            raise HTTPException(status_code=400, detail="Unknown portal")
        ch = await db.webauthn_challenges.find_one_and_delete({"ceremony": "login", "origin": origin, "rp_id": rp_id, "challenge": _client_challenge(cred), "expires_at": {"$gt": _now()}})
        if not ch:
            raise HTTPException(status_code=400, detail="Login request expired. Please try again.")
        row = await db.webauthn_credentials.find_one({"credential_id": cred.id, "rp_id": rp_id})
        if not row:
            raise HTTPException(status_code=401, detail="Fingerprint login is not set up on this device yet. Login with your password once, then turn on fingerprint in App Lock.")
        try:
            res = _wa().verify_authentication_response(credential=cred.model_dump(exclude_none=True), expected_challenge=_b64d(ch["challenge"]), expected_rp_id=rp_id, expected_origin=origin,
                                                       credential_public_key=_b64d(row["public_key"]), credential_current_sign_count=int(row.get("sign_count", 0)), require_user_verification=True)
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Fingerprint verification failed: {str(e)[:120]}")
        user = await db.users.find_one({"_id": ObjectId(row["user_id"])})
        if not user or user.get("account_status", "active") == "deleted":
            raise HTTPException(status_code=401, detail="Account not found.")
        if user.get("role") != role:
            raise HTTPException(status_code=403, detail=f"This fingerprint belongs to a {user.get('role')} account. Use the {user.get('role')} login page.")
        if user.get("account_status", "active") != "active":
            raise HTTPException(status_code=403, detail="Your account is not active. Please contact Radhika Traders.")
        if role == "customer" and not user.get("email_verified"):
            raise HTTPException(status_code=403, detail="Please verify your email first")
        await db.webauthn_credentials.update_one({"_id": row["_id"]}, {"$set": {"sign_count": res.new_sign_count, "last_used_at": _iso()}})
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": _iso(), "app_lock.failures": 0, "app_lock.locked_until": ""}})
        await log_security(str(user["_id"]), "passkey_login", request, f"{role} · {(request.headers.get('user-agent') or '')[:80]}")
        out = {"token": create_access_token(str(user["_id"]), user["email"], role, user.get("token_version", 0)), "user": public_user(user)}
        if role != "customer":
            out["trusted_device"] = await issue_trusted(db, user, request)
        return out

    return r
