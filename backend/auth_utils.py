"""Auth, JWT, password hashing, OTP helpers."""
import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request
from bson import ObjectId

JWT_ALGORITHM = "HS256"
ACCOUNT_STATUS_MESSAGES = {
    "deactivated": "Your account is temporarily deactivated by Radhika Traders. Please contact support on WhatsApp +91 63765 41191.",
    "disabled": "Your account has been disabled due to a policy violation. Please contact Radhika Traders support.",
}


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


def generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def generate_referral_code() -> str:
    return "RT" + secrets.token_hex(3).upper()


def _extract_token(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


async def get_current_user_from_db(request: Request, db) -> dict:
    token = _extract_token(request)
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        st = user.get("account_status", "active")
        if st == "deleted":
            raise HTTPException(status_code=401, detail="User not found")
        if st in ("deactivated", "disabled"):
            raise HTTPException(status_code=403, detail=ACCOUNT_STATUS_MESSAGES[st])
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
