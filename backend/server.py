import os
import io
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Query, Header, BackgroundTasks
from fastapi.responses import Response, StreamingResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

from auth_utils import (
    hash_password, verify_password, create_access_token, generate_otp,
    generate_referral_code, get_current_user_from_db,
)
from email_service import send_otp_email, send_payment_email, send_campaign_live_email, send_broadcast_email
from storage_service import init_storage, put_object, get_object, APP_NAME

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

MIN_WITHDRAWAL = float(os.environ.get("MIN_WITHDRAWAL", "100"))

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
              "gif": "image/gif", "webp": "image/webp"}


# ----------------------------- Helpers -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s or uuid.uuid4().hex[:8]


async def unique_slug(text: str, exclude_id: str = None) -> str:
    base = slugify(text)
    slug = base
    i = 1
    while True:
        q = {"slug": slug, "is_deleted": False}
        if exclude_id:
            q["_id"] = {"$ne": ObjectId(exclude_id)}
        existing = await db.campaigns.find_one(q)
        if not existing:
            return slug
        i += 1
        slug = f"{base}-{i}"


def public_user(u: dict) -> dict:
    return {
        "id": str(u.get("_id", u.get("id"))),
        "name": u.get("name"),
        "email": u.get("email"),
        "mobile": u.get("mobile"),
        "address": u.get("address"),
        "dob": u.get("dob", ""),
        "role": u.get("role"),
        "email_verified": u.get("email_verified", False),
        "referral_code": u.get("referral_code"),
        "kyc": u.get("kyc", {"status": "not_submitted"}),
        "bank": u.get("bank", {}),
        "created_at": u.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    return await get_current_user_from_db(request, db)


async def require_admin(request: Request) -> dict:
    user = await get_current_user_from_db(request, db)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def campaign_out(c: dict) -> dict:
    c = dict(c)
    c["id"] = str(c.pop("_id"))
    return c


# ----------------------------- Models -----------------------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    mobile: str
    password: str
    address: Optional[str] = ""
    referred_by: Optional[str] = ""


class SettingsIn(BaseModel):
    referral_bonus: Optional[float] = None
    min_withdrawal: Optional[float] = None
    signup_bonus: Optional[float] = None
    withdrawals_enabled: Optional[bool] = None
    withdrawals_paused_message: Optional[str] = None


async def get_settings() -> dict:
    s = await db.settings.find_one({"key": "app"}) or {}
    return {"referral_bonus": float(s.get("referral_bonus", 0)), "min_withdrawal": float(s.get("min_withdrawal", MIN_WITHDRAWAL)),
            "signup_bonus": float(s.get("signup_bonus", 50)), "withdrawals_enabled": bool(s.get("withdrawals_enabled", True)),
            "withdrawals_paused_message": s.get("withdrawals_paused_message") or "Withdrawals are temporarily paused by Radhika Traders. Please check back soon."}


class OtpVerifyIn(BaseModel):
    email: EmailStr
    code: str


class ResendOtpIn(BaseModel):
    email: EmailStr
    purpose: str = "signup"


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    portal: str = "customer"


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    dob: Optional[str] = None


class KycIn(BaseModel):
    pan: str
    aadhaar: Optional[str] = ""
    bank_account: str
    ifsc: str
    account_holder: str
    upi: Optional[str] = ""
    upi_qr_url: Optional[str] = ""


class CategoryIn(BaseModel):
    name: str
    enabled: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None


class AffiliateLink(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    label: str = "Primary Link"
    url: str
    is_primary: bool = False
    is_active: bool = True


class CampaignIn(BaseModel):
    offer_name: str
    company: str = ""
    category: str = ""
    payout_amount: float = 0
    payout_type: str = "Fixed"
    benefits: str = ""
    customer_benefit: str = ""
    affiliate_payout: str = ""
    investment: str = ""
    campaign_type: str = "First Trade"
    description: str = ""
    requirements: str = ""
    important_notes: str = ""
    min_requirement: str = ""
    max_payout: str = ""
    special_bonus: str = ""
    payment_timeline: str = ""
    validity: str = ""
    important_conditions: str = ""
    start_date: str = ""
    end_date: str = ""
    budget: str = ""
    report_frequency: str = ""
    payment_terms: str = ""
    logo_url: str = ""
    banner_url: str = ""
    status: str = "live"
    offer_enabled: bool = True
    affiliate_links: List[AffiliateLink] = []
    lead_fields: List[dict] = []


LEAD_FIELDS = [
    ("name", "Full Name"), ("mobile", "Mobile Number"), ("email", "Gmail / Email ID"), ("pan", "PAN Number"),
    ("dob", "Date of Birth"), ("aadhaar", "Aadhaar Number"), ("bank_account", "Bank Account Number"),
    ("ifsc", "IFSC Code"), ("upi", "UPI ID"), ("address", "Address"),
]


def normalize_lead_fields(fields: list) -> list:
    given = {f.get("key"): f for f in (fields or []) if isinstance(f, dict)}
    return [{"key": k, "label": given.get(k, {}).get("label") or label,
             "enabled": bool(given.get(k, {}).get("enabled", False)),
             "required": bool(given.get(k, {}).get("required", False)) and bool(given.get(k, {}).get("enabled", False))}
            for k, label in LEAD_FIELDS]


class LeadIn(BaseModel):
    ref: Optional[str] = ""
    data: dict = {}


class LeadStatusIn(BaseModel):
    status: Optional[str] = None            # pending | approved | rejected
    account_status: Optional[str] = None    # pending | account_opened | rejected
    reject_reason: Optional[str] = ""


class CreditIn(BaseModel):
    user_id: str
    amount: float
    description: str = "Earning credit"
    campaign_id: Optional[str] = None
    ref_id: Optional[str] = None


class WithdrawIn(BaseModel):
    amount: float
    method: str
    details: str = ""
    transaction_password: str = ""


class WithdrawStatusIn(BaseModel):
    status: str
    admin_note: Optional[str] = ""
    proof_url: Optional[str] = ""
    utr: Optional[str] = ""


class BannerIn(BaseModel):
    title: str = ""
    subtitle: str = ""
    image_url: str
    link: str = ""
    campaign_id: str = ""
    enabled: bool = True
    order: int = 0


# ----------------------------- Auth -----------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already registered. Please login.")
    doc = {
        "name": body.name,
        "email": email,
        "mobile": body.mobile,
        "address": body.address or "",
        "password_hash": hash_password(body.password),
        "role": "customer",
        "email_verified": False,
        "referral_code": generate_referral_code(),
        "kyc": {"status": "not_submitted"},
        "bank": {},
        "referred_by_code": (body.referred_by or "").strip().upper(),
        "referral_bonus_paid": False,
        "created_at": now_iso(),
    }
    if existing:
        await db.users.update_one({"email": email}, {"$set": doc})
    else:
        await db.users.insert_one(doc)
    code = generate_otp()
    await db.otp_codes.delete_many({"email": email, "purpose": "signup"})
    await db.otp_codes.insert_one({
        "email": email, "code": code, "purpose": "signup",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "used": False, "created_at": now_iso(),
    })
    await send_otp_email(email, body.name, code, "signup")
    logger.info(f"[OTP signup] {email} -> {code}")
    return {"message": "OTP sent to your email", "email": email}


@api.post("/auth/verify-otp")
async def verify_otp(body: OtpVerifyIn):
    email = body.email.lower()
    rec = await db.otp_codes.find_one({"email": email, "purpose": "signup", "used": False})
    if not rec or rec["code"] != body.code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    await db.otp_codes.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"email": email}, {"$set": {"email_verified": True}})
    user = await db.users.find_one({"email": email})
    await pay_referral_bonus(user)
    token = create_access_token(str(user["_id"]), email, user["role"])
    return {"token": token, "user": public_user(user)}


async def pay_referral_bonus(new_user: dict):
    code = new_user.get("referred_by_code")
    if not code or new_user.get("referral_bonus_paid"):
        return
    referrer = await db.users.find_one({"referral_code": code, "role": "customer"})
    if not referrer or str(referrer["_id"]) == str(new_user["_id"]):
        return
    settings = await get_settings()
    amount = settings["referral_bonus"]
    await db.users.update_one({"_id": new_user["_id"]}, {"$set": {"referral_bonus_paid": True, "referred_by_user_id": str(referrer["_id"])}})
    signup_bonus = settings["signup_bonus"]
    if signup_bonus > 0:
        await db.transactions.insert_one({
            "user_id": str(new_user["_id"]), "amount": signup_bonus, "type": "bonus", "status": "locked",
            "description": "Signup bonus — unlocks to main wallet after your first approved lead",
            "ref_id": f"SB-{uuid.uuid4().hex[:8].upper()}", "campaign_id": None, "created_at": now_iso(),
        })
        await db.notifications.insert_one({"user_id": str(new_user["_id"]), "title": f"₹{int(signup_bonus)} signup bonus added",
                                           "body": "It is in your Bonus Wallet. Get your first lead approved to move it to your main wallet.",
                                           "link": "/wallet", "type": "wallet", "read": False, "created_at": now_iso()})
    if amount <= 0:
        return
    await db.transactions.insert_one({
        "user_id": str(referrer["_id"]), "amount": amount, "type": "credit",
        "description": f"Referral bonus - {new_user.get('name', 'new partner')} joined", "ref_id": f"REF-{uuid.uuid4().hex[:8].upper()}",
        "campaign_id": None, "status": "completed", "created_at": now_iso(),
    })


@api.get("/settings/public")
async def public_settings():
    return await get_settings()


@api.put("/admin/settings")
async def update_settings(body: SettingsIn, admin: dict = Depends(require_admin)):
    upd = {}
    if body.referral_bonus is not None:
        if body.referral_bonus < 0:
            raise HTTPException(status_code=400, detail="Bonus cannot be negative")
        upd["referral_bonus"] = body.referral_bonus
    if body.min_withdrawal is not None:
        if body.min_withdrawal < 1:
            raise HTTPException(status_code=400, detail="Minimum withdrawal must be at least Rs.1")
        upd["min_withdrawal"] = body.min_withdrawal
    if body.signup_bonus is not None:
        if body.signup_bonus < 0:
            raise HTTPException(status_code=400, detail="Signup bonus cannot be negative")
        upd["signup_bonus"] = body.signup_bonus
    if body.withdrawals_enabled is not None:
        upd["withdrawals_enabled"] = body.withdrawals_enabled
    if body.withdrawals_paused_message is not None:
        upd["withdrawals_paused_message"] = body.withdrawals_paused_message.strip()[:300]
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.settings.update_one({"key": "app"}, {"$set": {**upd, "updated_at": now_iso()}}, upsert=True)
    return await get_settings()


@api.get("/my-referrals")
async def my_referrals(user: dict = Depends(get_current_user)):
    joined = await db.users.find({"referred_by_user_id": user["id"]}, {"name": 1, "created_at": 1, "email_verified": 1, "kyc.status": 1}).sort("created_at", -1).to_list(500)
    earned = await db.transactions.aggregate([
        {"$match": {"user_id": user["id"], "type": "credit", "ref_id": {"$regex": "^REF-"}}},
        {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
    return {"count": len(joined), "earned": round(earned[0]["s"], 2) if earned else 0,
            "recent": [{"name": j.get("name"), "joined_at": j.get("created_at"), "kyc": j.get("kyc", {}).get("status", "not_submitted")} for j in joined[:50]]}


@api.post("/auth/resend-otp")
async def resend_otp(body: ResendOtpIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    code = generate_otp()
    await db.otp_codes.delete_many({"email": email, "purpose": body.purpose})
    await db.otp_codes.insert_one({
        "email": email, "code": code, "purpose": body.purpose,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "used": False, "created_at": now_iso(),
    })
    await send_otp_email(email, user.get("name", ""), code, body.purpose)
    logger.info(f"[OTP {body.purpose}] {email} -> {code}")
    return {"message": "OTP resent"}


LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 30


def _client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    email = body.email.lower()
    identifier = f"{_client_ip(request)}:{email}"
    now = now_iso()
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= LOGIN_MAX_ATTEMPTS and (rec.get("locked_until") or "") > now:
        mins = max(1, int((datetime.fromisoformat(rec["locked_until"]) - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
        raise HTTPException(status_code=429, detail=f"Too many failed login attempts. Account locked. Try again after {mins} minutes.")
    if rec and (rec.get("locked_until") or "") and rec["locked_until"] <= now:
        await db.login_attempts.delete_one({"_id": rec["_id"]})
        rec = None
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        count = (rec.get("count", 0) if rec else 0) + 1
        upd = {"$set": {"identifier": identifier, "email": email, "count": count, "updated_at": now}}
        if count >= LOGIN_MAX_ATTEMPTS:
            upd["$set"]["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
            if user:
                await _log_security(str(user["_id"]), "login_locked", request, f"{count} failed attempts")
        await db.login_attempts.update_one({"identifier": identifier}, upd, upsert=True)
        left = LOGIN_MAX_ATTEMPTS - count
        if count >= LOGIN_MAX_ATTEMPTS:
            raise HTTPException(status_code=429, detail=f"Too many failed login attempts. Account locked for {LOGIN_LOCK_MINUTES} minutes.")
        raise HTTPException(status_code=401, detail=f"Invalid email or password. {left} attempt{'s' if left != 1 else ''} left before lock.")
    await db.login_attempts.delete_one({"identifier": identifier})
    if body.portal == "admin" and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="This login is for admin only. Please use the customer login.")
    if body.portal != "admin" and user["role"] == "admin":
        raise HTTPException(status_code=403, detail="Admin accounts cannot log in here. Please use the Admin Login page.")
    if user["role"] == "customer" and not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email first")
    token = create_access_token(str(user["_id"]), email, user["role"])
    return {"token": token, "user": public_user(user)}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        code = generate_otp()
        await db.otp_codes.delete_many({"email": email, "purpose": "reset"})
        await db.otp_codes.insert_one({
            "email": email, "code": code, "purpose": "reset",
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
            "used": False, "created_at": now_iso(),
        })
        await send_otp_email(email, user.get("name", ""), code, "reset")
        logger.info(f"[OTP reset] {email} -> {code}")
    return {"message": "If the email exists, an OTP has been sent"}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    email = body.email.lower()
    rec = await db.otp_codes.find_one({"email": email, "purpose": "reset", "used": False})
    if not rec or rec["code"] != body.code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    await db.otp_codes.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"message": "Password reset successful. Please login."}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    return public_user(full)


# ----------------------------- Profile / KYC -----------------------------
@api.put("/profile")
async def update_profile(body: ProfileIn, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": upd})
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    return public_user(full)


@api.put("/profile/kyc")
async def submit_kyc(body: KycIn, user: dict = Depends(get_current_user)):
    pan = body.pan.strip().upper()
    ifsc = body.ifsc.strip().upper()
    acct = re.sub(r"\s", "", body.bank_account)
    if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", pan):
        raise HTTPException(status_code=400, detail="Invalid PAN format (e.g. ABCDE1234F)")
    if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc):
        raise HTTPException(status_code=400, detail="Invalid IFSC code (e.g. HDFC0001234)")
    if not re.fullmatch(r"\d{9,18}", acct):
        raise HTTPException(status_code=400, detail="Bank account number must be 9–18 digits")
    if body.aadhaar and not re.fullmatch(r"\d{12}", re.sub(r"\s", "", body.aadhaar)):
        raise HTTPException(status_code=400, detail="Aadhaar must be 12 digits")
    if body.upi and not re.fullmatch(r"[\w.\-]{2,}@[A-Za-z]{2,}", body.upi.strip()):
        raise HTTPException(status_code=400, detail="Invalid UPI ID (e.g. name@upi)")
    dup = await db.users.find_one({"kyc.pan": pan, "_id": {"$ne": ObjectId(user["id"])}})
    if dup:
        raise HTTPException(status_code=400, detail="This PAN is already registered with another account")
    kyc = {**body.model_dump(), "pan": pan, "ifsc": ifsc, "bank_account": acct, "status": "verified",
           "verified_mode": "auto", "submitted_at": now_iso(), "reviewed_at": now_iso(), "admin_note": ""}
    bank = {"account_holder": body.account_holder.strip(), "bank_account": acct, "ifsc": ifsc,
            "upi": (body.upi or "").strip(), "upi_qr_url": body.upi_qr_url or ""}
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"kyc": kyc, "bank": bank}})
    await db.notifications.insert_one({"user_id": user["id"], "title": "KYC Verified ✓", "body": "Your KYC details were verified successfully. Withdrawals are enabled.",
                                       "link": "/withdrawals", "type": "kyc", "read": False, "created_at": now_iso()})
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    return public_user(full)


# ----------------------------- Categories -----------------------------
@api.get("/categories")
async def list_categories(all: bool = False):
    q = {"is_deleted": False}
    if not all:
        q["enabled"] = True
    cats = await db.categories.find(q).sort("name", 1).to_list(1000)
    return [{"id": str(c["_id"]), "name": c["name"], "slug": c["slug"], "enabled": c.get("enabled", True)} for c in cats]


@api.post("/categories")
async def create_category(body: CategoryIn, admin: dict = Depends(require_admin)):
    doc = {"name": body.name, "slug": slugify(body.name), "enabled": body.enabled,
           "is_deleted": False, "created_at": now_iso()}
    res = await db.categories.insert_one(doc)
    return {"id": str(res.inserted_id), **{k: doc[k] for k in ("name", "slug", "enabled")}}


@api.put("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryUpdate, admin: dict = Depends(require_admin)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "name" in upd:
        upd["slug"] = slugify(upd["name"])
    await db.categories.update_one({"_id": ObjectId(cat_id)}, {"$set": upd})
    c = await db.categories.find_one({"_id": ObjectId(cat_id)})
    return {"id": str(c["_id"]), "name": c["name"], "slug": c["slug"], "enabled": c.get("enabled", True)}


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, admin: dict = Depends(require_admin)):
    await db.categories.update_one({"_id": ObjectId(cat_id)}, {"$set": {"is_deleted": True}})
    return {"message": "Category deleted"}


# ----------------------------- Campaigns -----------------------------
@api.get("/campaigns")
async def list_campaigns(
    search: Optional[str] = None, category: Optional[str] = None,
    campaign_type: Optional[str] = None, status: Optional[str] = None,
    min_payout: Optional[float] = None, admin_view: bool = False,
):
    q = {"is_deleted": False}
    if not admin_view:
        q["offer_enabled"] = True
        q["status"] = "live"
    if status and admin_view:
        q["status"] = status
    if category:
        q["category"] = category
    if campaign_type:
        q["campaign_type"] = campaign_type
    if min_payout is not None:
        q["payout_amount"] = {"$gte": min_payout}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        q["$or"] = [{"offer_name": rx}, {"company": rx}, {"category": rx}]
    items = await db.campaigns.find(q).sort("updated_at", -1).to_list(1000)
    return [campaign_out(c) for c in items]


@api.get("/campaigns/archived")
async def list_archived(admin: dict = Depends(require_admin)):
    items = await db.campaigns.find({"is_deleted": True}).sort("updated_at", -1).to_list(1000)
    return [campaign_out(c) for c in items]


@api.get("/campaigns/slug/{slug}")
async def get_campaign_by_slug(slug: str):
    c = await db.campaigns.find_one({"slug": slug, "is_deleted": False})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign_out(c)


def _primary_link(c: dict) -> Optional[str]:
    links = [l for l in c.get("affiliate_links", []) if l.get("is_active") and l.get("url")]
    if not links:
        return None
    prim = next((l for l in links if l.get("is_primary")), links[0])
    return prim["url"]


@api.get("/go/{slug}")
async def go_affiliate(slug: str, request: Request, ref: Optional[str] = None):
    c = await db.campaigns.find_one({"slug": slug, "is_deleted": False})
    origin = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"
    if not c:
        return RedirectResponse(url=f"{origin}/offer-ended", status_code=302)
    is_live = c.get("status") == "live" and c.get("offer_enabled", True)
    target = _primary_link(c) if is_live else None
    partner = await db.users.find_one({"referral_code": ref}) if ref else None
    await db.clicks.insert_one({
        "campaign_id": str(c["_id"]), "slug": slug, "ref_code": ref or "",
        "user_id": str(partner["_id"]) if partner else None,
        "redirected_to": target or "", "ip": request.headers.get("x-forwarded-for", request.client.host if request.client else ""),
        "user_agent": request.headers.get("user-agent", "")[:300], "created_at": now_iso(),
    })
    if not is_live:
        return RedirectResponse(url=f"{origin}/offer-ended?c={slug}&s={c.get('status', 'closed')}", status_code=302)
    if any(f.get("enabled") for f in c.get("lead_fields", [])):
        return RedirectResponse(url=f"{origin}/join/{slug}" + (f"?ref={ref}" if ref else ""), status_code=302)
    return RedirectResponse(url=target or f"{origin}/campaign/{slug}", status_code=302)


def lead_out(l: dict) -> dict:
    return {**{k: v for k, v in l.items() if k != "_id"}, "id": str(l["_id"])}


@api.get("/join/{slug}")
async def join_info(slug: str, ref: Optional[str] = None):
    c = await db.campaigns.find_one({"slug": slug, "is_deleted": False})
    if not c or c.get("status") != "live" or not c.get("offer_enabled", True):
        raise HTTPException(status_code=404, detail="Offer not available")
    partner = await db.users.find_one({"referral_code": (ref or "").upper(), "role": "customer"}) if ref else None
    return {"campaign": {"id": str(c["_id"]), "offer_name": c["offer_name"], "company": c.get("company", ""), "logo_url": c.get("logo_url", ""),
                         "payout_amount": c.get("payout_amount", 0), "customer_benefit": c.get("customer_benefit", ""), "slug": slug},
            "fields": [f for f in c.get("lead_fields", []) if f.get("enabled")],
            "referred_by": _mask_name(partner.get("name")) if partner else None, "ref": (ref or "").upper()}


@api.post("/leads/{slug}")
async def create_lead(slug: str, body: LeadIn, request: Request):
    c = await db.campaigns.find_one({"slug": slug, "is_deleted": False})
    if not c or c.get("status") != "live" or not c.get("offer_enabled", True):
        raise HTTPException(status_code=400, detail="Offer is not active")
    fields = [f for f in c.get("lead_fields", []) if f.get("enabled")]
    data = {f["key"]: str(body.data.get(f["key"], "")).strip() for f in fields}
    missing = [f["label"] for f in fields if f.get("required") and not data.get(f["key"])]
    if missing:
        raise HTTPException(status_code=400, detail=f"Required: {', '.join(missing)}")
    if data.get("mobile") and not re.fullmatch(r"\d{10}", data["mobile"]):
        raise HTTPException(status_code=400, detail="Mobile number must be 10 digits")
    if data.get("pan") and not re.fullmatch(r"[A-Za-z]{5}\d{4}[A-Za-z]", data["pan"]):
        raise HTTPException(status_code=400, detail="Invalid PAN format")
    ref = (body.ref or "").upper()
    partner = await db.users.find_one({"referral_code": ref, "role": "customer"}) if ref else None
    doc = {"lead_id": f"LD-{uuid.uuid4().hex[:8].upper()}", "campaign_id": str(c["_id"]), "campaign_name": c["offer_name"], "slug": slug,
           "campaign_link": _primary_link(c) or "", "ref_code": ref, "partner_id": str(partner["_id"]) if partner else None,
           "partner_name": partner.get("name") if partner else "", "data": data, "customer_name": data.get("name", ""),
           "mobile": data.get("mobile", ""), "email": data.get("email", ""), "status": "pending", "account_status": "pending",
           "reject_reason": "", "ip": request.headers.get("x-forwarded-for", ""), "created_at": now_iso(), "updated_at": now_iso()}
    res = await db.leads.insert_one(doc)
    if partner:
        await db.notifications.insert_one({"user_id": str(partner["_id"]), "title": f"New lead on {c['offer_name']}",
                                           "body": f"{data.get('name') or 'A customer'} submitted details via your link.", "link": "/my-leads",
                                           "type": "lead", "read": False, "created_at": now_iso()})
    return {"lead_id": doc["lead_id"], "id": str(res.inserted_id), "redirect_url": _primary_link(c) or f"/campaign/{slug}"}


@api.get("/my-leads")
async def my_leads(user: dict = Depends(get_current_user)):
    items = await db.leads.find({"partner_id": user["id"]}).sort("created_at", -1).to_list(2000)
    cids = list({l["campaign_id"] for l in items if l.get("campaign_id")})
    camps = await db.campaigns.find({"_id": {"$in": [ObjectId(i) for i in cids if ObjectId.is_valid(i)]}}, {"lead_fields": 1}).to_list(len(cids) or 1)
    labels = {str(c["_id"]): {f["key"]: f.get("label", f["key"]) for f in c.get("lead_fields", [])} for c in camps}
    out = []
    for l in items:
        o = lead_out(l)
        lm = labels.get(l.get("campaign_id"), {})
        o["details"] = [{"key": k, "label": lm.get(k, k.replace("_", " ").title()), "value": v} for k, v in (l.get("data") or {}).items() if v]
        out.append(o)
    return out


@api.get("/admin/leads/summary")
async def admin_leads_summary(admin: dict = Depends(require_admin)):
    rows = await db.leads.aggregate([{"$group": {"_id": {"s": "$status", "a": "$account_status"}, "n": {"$sum": 1}}}]).to_list(50)
    total = sum(r["n"] for r in rows)
    by = lambda key, val: sum(r["n"] for r in rows if r["_id"][key] == val)
    return {"total": total, "approved": by("s", "approved"), "pending": by("s", "pending"), "rejected": by("s", "rejected"),
            "account_opened": by("a", "account_opened")}


@api.get("/admin/leads")
async def admin_leads(campaign_id: Optional[str] = None, status: Optional[str] = None, account_status: Optional[str] = None,
                      ref: Optional[str] = None, search: Optional[str] = None, date_from: Optional[str] = None,
                      date_to: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if campaign_id:
        q["campaign_id"] = campaign_id
    if status:
        q["status"] = status
    if account_status:
        q["account_status"] = account_status
    if ref:
        q["$or"] = [{"ref_code": ref.upper()}, {"partner_name": {"$regex": re.escape(ref), "$options": "i"}}]
    if date_from or date_to:
        q["created_at"] = {**({"$gte": date_from} if date_from else {}), **({"$lte": date_to + "T23:59:59"} if date_to else {})}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        q["$and"] = [{"$or": [{"customer_name": rx}, {"mobile": rx}, {"email": rx}, {"lead_id": rx}, {"campaign_name": rx}, {"partner_name": rx}, {"ref_code": rx}, {"data.pan": rx}]}]
    items = await db.leads.find(q).sort("created_at", -1).to_list(5000)
    return [lead_out(l) for l in items]


@api.patch("/admin/leads/{lid}")
async def admin_update_lead(lid: str, body: LeadStatusIn, admin: dict = Depends(require_admin)):
    l = await db.leads.find_one({"_id": ObjectId(lid)})
    if not l:
        raise HTTPException(status_code=404, detail="Lead not found")
    upd = {"updated_at": now_iso(), "reviewed_by": admin["email"]}
    if body.status:
        if body.status not in ("pending", "approved", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid status")
        upd["status"] = body.status
    if body.account_status:
        if body.account_status not in ("pending", "account_opened", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid account status")
        upd["account_status"] = body.account_status
    if body.reject_reason is not None:
        upd["reject_reason"] = body.reject_reason
    await db.leads.update_one({"_id": l["_id"]}, {"$set": upd})
    if l.get("partner_id") and (body.status == "approved" or body.account_status == "account_opened"):
        await unlock_signup_bonus(l["partner_id"])
    if l.get("partner_id") and (body.status or body.account_status):
        label = (body.account_status or body.status).replace("_", " ")
        await db.notifications.insert_one({"user_id": l["partner_id"], "title": f"Lead {l['lead_id']} {label}",
                                           "body": f"{l.get('customer_name') or 'Customer'} · {l['campaign_name']}" + (f" · {body.reject_reason}" if body.reject_reason else ""),
                                           "link": "/my-leads", "type": "lead", "read": False, "created_at": now_iso()})
    return lead_out(await db.leads.find_one({"_id": l["_id"]}))


@api.get("/my-clicks")
async def my_clicks(user: dict = Depends(get_current_user)):
    rows = await db.clicks.aggregate([
        {"$match": {"user_id": user["id"]}},
        {"$group": {"_id": "$campaign_id", "clicks": {"$sum": 1}}},
    ]).to_list(1000)
    return {"total": sum(r["clicks"] for r in rows), "by_campaign": {r["_id"]: r["clicks"] for r in rows}}


def _normalize_links(links: list) -> list:
    out = []
    for l in links:
        u = (l.get("url") or "").strip()
        if u and not u.lower().startswith(("http://", "https://")):
            u = "https://" + u
        out.append({**l, "url": u})
    return out


@api.get("/campaigns/{cid}")
async def get_campaign(cid: str):
    c = await db.campaigns.find_one({"_id": ObjectId(cid)})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign_out(c)


@api.post("/campaigns")
async def create_campaign(body: CampaignIn, admin: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["affiliate_links"] = _normalize_links(doc.get("affiliate_links", []))
    doc["lead_fields"] = normalize_lead_fields(doc.get("lead_fields"))
    doc["slug"] = await unique_slug(body.offer_name)
    doc["is_deleted"] = False
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    res = await db.campaigns.insert_one(doc)
    c = await db.campaigns.find_one({"_id": res.inserted_id})
    return campaign_out(c)


@api.put("/campaigns/{cid}")
async def update_campaign(cid: str, body: CampaignIn, admin: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["affiliate_links"] = _normalize_links(doc.get("affiliate_links", []))
    doc["lead_fields"] = normalize_lead_fields(doc.get("lead_fields"))
    doc["updated_at"] = now_iso()
    current = await db.campaigns.find_one({"_id": ObjectId(cid)})
    if current and current.get("offer_name") != body.offer_name:
        doc["slug"] = await unique_slug(body.offer_name, exclude_id=cid)
    await db.campaigns.update_one({"_id": ObjectId(cid)}, {"$set": doc})
    c = await db.campaigns.find_one({"_id": ObjectId(cid)})
    return campaign_out(c)


@api.patch("/campaigns/{cid}/status")
async def update_campaign_status(cid: str, request: Request, background: BackgroundTasks, status: str = Query(...), admin: dict = Depends(require_admin)):
    if status not in ("live", "paused", "closed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    c = await db.campaigns.find_one({"_id": ObjectId(cid)})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    await db.campaigns.update_one({"_id": ObjectId(cid)}, {"$set": {"status": status, "updated_at": now_iso()}})
    if status == "live" and c.get("status") != "live":
        background.add_task(announce_campaign_live, c, _origin(request))
    return {"message": "Status updated"}


def _origin(request: Request) -> str:
    return f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"


async def announce_campaign_live(c: dict, origin: str):
    customers = await db.users.find({"role": "customer", "email_verified": True}, {"email": 1, "name": 1}).to_list(10000)
    title = f"New Campaign LIVE: {c['offer_name']}"
    body = f"Payout Rs.{c.get('payout_amount', 0):g} · {c.get('company', '')}. Grab it and complete maximum eligible conversions!"
    link = f"/campaign/{c['slug']}"
    if customers:
        await db.notifications.insert_many([{
            "user_id": str(u["_id"]), "title": title, "body": body, "link": link, "type": "campaign_live",
            "campaign_id": str(c["_id"]), "read": False, "created_at": now_iso()} for u in customers])
    sent = failed = 0
    for u in customers:
        ok = await send_campaign_live_email(u.get("email", ""), u.get("name", ""), c, f"{origin}{link}")
        sent, failed = (sent + 1, failed) if ok else (sent, failed + 1)
    await db.broadcasts.insert_one({"kind": "campaign_live", "campaign_id": str(c["_id"]), "subject": title, "message": body,
                                    "audience": "all", "recipients": len(customers), "sent": sent, "failed": failed,
                                    "channels": ["email", "in_app"], "created_at": now_iso()})


@api.patch("/campaigns/{cid}/toggle-offer")
async def toggle_offer(cid: str, enabled: bool = Query(...), admin: dict = Depends(require_admin)):
    await db.campaigns.update_one({"_id": ObjectId(cid)}, {"$set": {"offer_enabled": enabled, "updated_at": now_iso()}})
    return {"message": "Offer updated"}


@api.delete("/campaigns/{cid}")
async def archive_campaign(cid: str, admin: dict = Depends(require_admin)):
    await db.campaigns.update_one({"_id": ObjectId(cid)}, {"$set": {"is_deleted": True, "updated_at": now_iso()}})
    return {"message": "Campaign archived"}


@api.post("/campaigns/{cid}/restore")
async def restore_campaign(cid: str, admin: dict = Depends(require_admin)):
    await db.campaigns.update_one({"_id": ObjectId(cid)}, {"$set": {"is_deleted": False, "updated_at": now_iso()}})
    return {"message": "Campaign restored"}


# ----------------------------- Wallet -----------------------------
async def unlock_signup_bonus(user_id: str):
    locked = await db.transactions.find({"user_id": user_id, "type": "bonus", "status": "locked"}).to_list(50)
    if not locked:
        return
    total = sum(t["amount"] for t in locked)
    await db.transactions.update_many({"user_id": user_id, "type": "bonus", "status": "locked"},
                                      {"$set": {"type": "credit", "status": "completed", "unlocked_at": now_iso(),
                                                "description": "Signup bonus unlocked — first lead approved"}})
    await db.notifications.insert_one({"user_id": user_id, "title": f"₹{int(total)} bonus moved to main wallet",
                                       "body": "Congratulations! Your first lead was approved, so your signup bonus is now withdrawable.",
                                       "link": "/wallet", "type": "wallet", "read": False, "created_at": now_iso()})


async def compute_wallet(user_id: str) -> dict:
    txns = await db.transactions.find({"user_id": user_id}).to_list(5000)
    total_credited = sum(t["amount"] for t in txns if t["type"] == "credit")
    total_debited = sum(t["amount"] for t in txns if t["type"] == "debit")
    bonus_locked = sum(t["amount"] for t in txns if t["type"] == "bonus" and t.get("status") == "locked")
    wds = await db.withdrawals.find({"user_id": user_id}).to_list(5000)
    total_withdrawn = sum(w["amount"] for w in wds if w["status"] == "paid")
    pending_withdrawal = sum(w["amount"] for w in wds if w["status"] in ("pending", "approved"))
    # Paid withdrawals are already recorded as debit transactions, so they are
    # included in total_debited. Only subtract pending (not-yet-debited) amounts here.
    balance = total_credited - total_debited - pending_withdrawal
    return {
        "balance": round(balance, 2),
        "total_earnings": round(total_credited, 2),
        "total_credited": round(total_credited, 2),
        "total_withdrawn": round(total_withdrawn, 2),
        "pending_withdrawal": round(pending_withdrawal, 2),
        "bonus_locked": round(bonus_locked, 2),
    }


@api.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    return await compute_wallet(user["id"])


@api.get("/wallet/transactions")
async def get_transactions(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find({"user_id": user["id"]}).sort("created_at", -1).to_list(5000)
    return [{**{k: v for k, v in t.items() if k != "_id"}, "id": str(t["_id"])} for t in txns]


def _mask_name(name: str) -> str:
    parts = (name or "Partner").strip().split()
    return parts[0] + (f" {parts[-1][0]}." if len(parts) > 1 else "")


@api.get("/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    pipeline = [
        {"$match": {"type": "credit", "created_at": {"$gte": month_start}}},
        {"$group": {"_id": "$user_id", "earned": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"earned": -1}},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(500)
    ids = [ObjectId(r["_id"]) for r in rows if ObjectId.is_valid(r["_id"])]
    users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": ids}}, {"name": 1, "role": 1}).to_list(500)}
    ranked = []
    for r in rows:
        u = users.get(r["_id"])
        if not u or u.get("role") != "customer":
            continue
        ranked.append({"user_id": r["_id"], "name": _mask_name(u.get("name")), "earned": round(r["earned"], 2), "count": r["count"]})
    me = next(({"rank": i + 1, **r} for i, r in enumerate(ranked) if r["user_id"] == user["id"]), None)
    top = [{"rank": i + 1, "name": r["name"], "earned": r["earned"], "count": r["count"], "is_me": r["user_id"] == user["id"]}
           for i, r in enumerate(ranked[:10])]
    return {"month": now.strftime("%B %Y"), "top": top, "me": me and {"rank": me["rank"], "earned": me["earned"], "count": me["count"]}, "total_partners": len(ranked)}


# ----------------------------- Withdrawals -----------------------------
@api.post("/withdrawals")
async def request_withdrawal(body: WithdrawIn, request: Request, user: dict = Depends(get_current_user)):
    settings = await get_settings()
    if not settings["withdrawals_enabled"]:
        raise HTTPException(status_code=403, detail=settings["withdrawals_paused_message"])
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    if full.get("kyc", {}).get("status") != "verified":
        raise HTTPException(status_code=400, detail="Your KYC must be verified by Radhika Traders before withdrawal")
    await require_txn_password(user["id"], body.transaction_password, request)
    min_wd = settings["min_withdrawal"]
    if body.amount < min_wd:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is Rs.{int(min_wd)}")
    wallet = await compute_wallet(user["id"])
    if body.amount > wallet["balance"]:
        raise HTTPException(status_code=400, detail="Insufficient available balance")
    bank = full.get("bank", {}) or {}
    details = (body.details or "").strip()
    if not details:
        details = bank.get("upi", "") if body.method == "UPI" else bank.get("bank_account", "")
    if not details:
        raise HTTPException(status_code=400, detail="Please enter your UPI ID or bank account number")
    doc = {
        "user_id": user["id"], "user_name": full.get("name"), "user_email": full.get("email"),
        "user_mobile": full.get("mobile", ""),
        "amount": body.amount, "method": body.method, "details": details,
        "payout_info": {
            "account_holder": bank.get("account_holder", ""), "bank_account": bank.get("bank_account", ""),
            "ifsc": bank.get("ifsc", ""), "upi": bank.get("upi", ""), "upi_qr_url": bank.get("upi_qr_url", ""),
            "pan": full.get("kyc", {}).get("pan", ""),
        },
        "status": "pending", "admin_note": "", "created_at": now_iso(), "updated_at": now_iso(),
    }
    res = await db.withdrawals.insert_one(doc)
    return {**{k: v for k, v in doc.items() if k != "_id"}, "id": str(res.inserted_id)}


@api.get("/withdrawals")
async def my_withdrawals(user: dict = Depends(get_current_user)):
    items = await db.withdrawals.find({"user_id": user["id"]}).sort("created_at", -1).to_list(5000)
    return [{**{k: v for k, v in w.items() if k != "_id"}, "id": str(w["_id"])} for w in items]


@api.get("/admin/withdrawals")
async def all_withdrawals(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    items = await db.withdrawals.find(q).sort("created_at", -1).to_list(5000)
    return [{**{k: v for k, v in w.items() if k != "_id"}, "id": str(w["_id"])} for w in items]


@api.patch("/admin/withdrawals/{wid}")
async def update_withdrawal(wid: str, body: WithdrawStatusIn, request: Request, admin: dict = Depends(require_admin)):
    if body.status not in ("pending", "approved", "paid", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid status")
    w = await db.withdrawals.find_one({"_id": ObjectId(wid)})
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    await db.withdrawals.update_one({"_id": ObjectId(wid)},
        {"$set": {"status": body.status, "admin_note": body.admin_note or "", "updated_at": now_iso(),
                  "proof_url": body.proof_url or w.get("proof_url", ""), "utr": body.utr or w.get("utr", ""),
                  **({"paid_at": now_iso()} if body.status == "paid" else {})}})
    if body.status == "paid":
        await db.transactions.insert_one({
            "user_id": w["user_id"], "amount": w["amount"], "type": "debit",
            "description": f"Withdrawal paid ({w['method']})", "ref_id": body.utr or f"WD-{wid[:8]}",
            "status": "completed", "campaign_id": None, "created_at": now_iso(),
        })
        base = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.headers.get('host'))}"
        proof_link = f"{base}{body.proof_url}" if body.proof_url and body.proof_url.startswith("/") else (body.proof_url or "")
        await send_payment_email(w.get("user_email", ""), w.get("user_name", ""), w["amount"], w["method"],
                                 w.get("details", ""), body.utr or "", proof_link)
    return {"message": "Withdrawal updated"}


# ----------------------------- Banners -----------------------------
def banner_out(b: dict) -> dict:
    return {**{k: v for k, v in b.items() if k != "_id"}, "id": str(b["_id"])}


@api.get("/banners")
async def list_banners(all: bool = False, user: dict = Depends(get_current_user)):
    q = {} if (all and user.get("role") == "admin") else {"enabled": True}
    items = await db.banners.find(q).sort([("order", 1), ("created_at", -1)]).to_list(100)
    out = []
    for b in items:
        o = banner_out(b)
        c = None
        if b.get("campaign_id") and ObjectId.is_valid(b["campaign_id"]):
            c = await db.campaigns.find_one({"_id": ObjectId(b["campaign_id"]), "is_deleted": False})
        elif (b.get("link") or "").startswith("/campaign/"):
            c = await db.campaigns.find_one({"slug": b["link"].split("/campaign/")[1].split("?")[0].strip("/"), "is_deleted": False})
        o["campaign_slug"] = c["slug"] if c else ""
        o["campaign_name"] = c["offer_name"] if c else ""
        o["campaign_live"] = bool(c and c.get("status") == "live" and c.get("offer_enabled", True))
        out.append(o)
    return out


@api.post("/admin/banners")
async def create_banner(body: BannerIn, admin: dict = Depends(require_admin)):
    doc = {**body.model_dump(), "created_at": now_iso()}
    res = await db.banners.insert_one(doc)
    return banner_out(await db.banners.find_one({"_id": res.inserted_id}))


@api.put("/admin/banners/{bid}")
async def update_banner(bid: str, body: BannerIn, admin: dict = Depends(require_admin)):
    await db.banners.update_one({"_id": ObjectId(bid)}, {"$set": body.model_dump()})
    b = await db.banners.find_one({"_id": ObjectId(bid)})
    if not b:
        raise HTTPException(status_code=404, detail="Banner not found")
    return banner_out(b)


@api.delete("/admin/banners/{bid}")
async def delete_banner(bid: str, admin: dict = Depends(require_admin)):
    await db.banners.delete_one({"_id": ObjectId(bid)})
    return {"message": "Banner deleted"}


# ----------------------------- Security: transaction password, change password, recover email -----------------------------
class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class TxnPasswordIn(BaseModel):
    login_password: Optional[str] = ""
    otp: Optional[str] = ""
    new_password: str


class RecoverEmailIn(BaseModel):
    mobile: str
    pan: Optional[str] = ""
    dob: Optional[str] = ""


async def _log_security(user_id: Optional[str], event: str, request: Request, detail: str = ""):
    await db.security_logs.insert_one({"user_id": user_id, "event": event, "detail": detail,
                                       "ip": request.headers.get("x-forwarded-for", request.client.host if request.client else ""),
                                       "created_at": now_iso()})


async def _issue_otp(email: str, name: str, purpose: str):
    code = generate_otp()
    await db.otp_codes.delete_many({"email": email, "purpose": purpose})
    await db.otp_codes.insert_one({"email": email, "code": code, "purpose": purpose, "attempts": 0,
                                   "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
                                   "used": False, "created_at": now_iso()})
    logger.info(f"[OTP {purpose}] {email} -> {code}")
    await send_otp_email(email, name, code, "reset")


async def _consume_otp(email: str, purpose: str, code: str):
    rec = await db.otp_codes.find_one({"email": email, "purpose": purpose, "used": False})
    if not rec or rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP. Please request a new one.")
    if rec["code"] != code:
        await db.otp_codes.update_one({"_id": rec["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP code")
    if rec["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    await db.otp_codes.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})


@api.post("/security/change-password")
async def change_password(body: ChangePasswordIn, request: Request, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(body.current_password, full.get("password_hash", "")):
        await _log_security(user["id"], "login_password_change_failed", request)
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    await db.users.update_one({"_id": full["_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await _log_security(user["id"], "login_password_changed", request)
    return {"message": "Login password changed"}


@api.post("/security/transaction-password/otp")
async def txn_password_otp(request: Request, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    await _issue_otp(full["email"], full.get("name", ""), "txn")
    return {"message": "OTP sent to your registered email"}


@api.post("/security/transaction-password")
async def set_txn_password(body: TxnPasswordIn, request: Request, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not re.fullmatch(r"\d{4,6}", body.new_password):
        raise HTTPException(status_code=400, detail="Transaction password must be a 4–6 digit PIN")
    if verify_password(body.new_password, full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Transaction password must be different from login password")
    if full.get("txn_password_hash"):
        if not body.otp:
            raise HTTPException(status_code=400, detail="OTP is required to reset transaction password")
        await _consume_otp(full["email"], "txn", body.otp)
        event = "transaction_password_reset"
    else:
        if not body.login_password or not verify_password(body.login_password, full.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Login password is incorrect")
        event = "transaction_password_set"
    await db.users.update_one({"_id": full["_id"]}, {"$set": {"txn_password_hash": hash_password(body.new_password), "txn_failed": 0}})
    await _log_security(user["id"], event, request)
    return {"message": "Transaction password saved", "has_txn_password": True}


async def require_txn_password(user_id: str, pin: str, request: Request):
    full = await db.users.find_one({"_id": ObjectId(user_id)})
    if not full.get("txn_password_hash"):
        raise HTTPException(status_code=400, detail="Please set your Transaction Password in Profile → Security first")
    if full.get("txn_failed", 0) >= 5 and (full.get("txn_locked_until") or "") > now_iso():
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Try again after 30 minutes.")
    if not pin or not verify_password(pin, full["txn_password_hash"]):
        upd = {"$inc": {"txn_failed": 1}}
        if full.get("txn_failed", 0) + 1 >= 5:
            upd["$set"] = {"txn_locked_until": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()}
        await db.users.update_one({"_id": full["_id"]}, upd)
        await _log_security(user_id, "transaction_password_failed", request)
        raise HTTPException(status_code=400, detail="Incorrect transaction password")
    await db.users.update_one({"_id": full["_id"]}, {"$set": {"txn_failed": 0}})


@api.post("/auth/recover-email")
async def recover_email(body: RecoverEmailIn, request: Request):
    mobile = re.sub(r"\D", "", body.mobile)[-10:]
    if len(mobile) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number")
    hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    tries = await db.security_logs.count_documents({"event": "email_recovery_attempt", "detail": mobile, "created_at": {"$gte": hour_ago}})
    if tries >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please try again after 1 hour.")
    await _log_security(None, "email_recovery_attempt", request, mobile)
    user = await db.users.find_one({"mobile": {"$regex": f"{mobile}$"}, "role": "customer"})
    ok = False
    if user:
        pan_ok = body.pan and user.get("kyc", {}).get("pan", "").upper() == body.pan.strip().upper()
        dob_ok = body.dob and user.get("dob") and user["dob"] == body.dob
        ok = bool(pan_ok or dob_ok)
    if not ok:
        raise HTTPException(status_code=400, detail="Details do not match our records")
    em = user["email"]
    local, domain = em.split("@", 1)
    masked = local[0] + "*" * max(3, len(local) - 2) + local[-1] + "@" + domain if len(local) > 2 else local[0] + "***@" + domain
    await _log_security(str(user["_id"]), "email_recovered", request, mobile)
    return {"masked_email": masked}


@api.get("/security/status")
async def security_status(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    logs = await db.security_logs.find({"user_id": user["id"]}).sort("created_at", -1).to_list(10)
    return {"has_txn_password": bool(full.get("txn_password_hash")),
            "logs": [{"event": l["event"], "created_at": l["created_at"]} for l in logs]}


# ----------------------------- Notifications, KYC mgmt, Broadcast -----------------------------
class KycStatusIn(BaseModel):
    status: str
    note: Optional[str] = ""


class BroadcastIn(BaseModel):
    subject: str
    message: str
    audience: str = "all"          # all | selected
    user_ids: List[str] = []
    campaign_id: Optional[str] = ""
    channels: List[str] = ["email", "in_app"]


class AdminNotifyIn(BaseModel):
    title: str
    body: str = ""
    link: str = ""


def notif_out(n: dict) -> dict:
    return {**{k: v for k, v in n.items() if k != "_id"}, "id": str(n["_id"])}


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"unread": unread, "items": [notif_out(n) for n in items]}


@api.post("/notifications/read")
async def mark_notifications_read(ids: List[str] = [], user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if ids:
        q["_id"] = {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}
    await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"message": "ok"}


@api.get("/admin/kyc")
async def admin_list_kyc(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {"role": "customer"}
    if status:
        q["kyc.status"] = status
    else:
        q["kyc.status"] = {"$ne": "not_submitted"}
    users = await db.users.find(q).sort("kyc.submitted_at", -1).to_list(5000)
    out = []
    for u in users:
        pu = public_user(u)
        pu["kyc"] = {**u.get("kyc", {}), "status": u.get("kyc", {}).get("status", "not_submitted")}
        pu["bank"] = u.get("bank", {})
        out.append(pu)
    return out


@api.patch("/admin/kyc/{uid}")
async def admin_update_kyc(uid: str, body: KycStatusIn, admin: dict = Depends(require_admin)):
    if body.status not in ("pending", "verified", "rejected", "deactivated"):
        raise HTTPException(status_code=400, detail="Invalid KYC status")
    u = await db.users.find_one({"_id": ObjectId(uid), "role": "customer"})
    if not u:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"kyc.status": body.status, "kyc.admin_note": body.note or "",
                                                            "kyc.reviewed_at": now_iso(), "kyc.reviewed_by": admin["email"]}})
    msg = {"verified": "Your KYC has been verified. Withdrawals are now enabled.",
           "rejected": f"Your KYC was rejected. {body.note or 'Please re-submit correct details.'}",
           "deactivated": f"Your KYC has been deactivated. {body.note or 'Contact support.'}",
           "pending": "Your KYC is under review."}[body.status]
    await db.notifications.insert_one({"user_id": uid, "title": f"KYC {body.status.capitalize()}", "body": msg, "link": "/profile",
                                       "type": "kyc", "read": False, "created_at": now_iso()})
    return {"message": "KYC updated", "status": body.status}


@api.post("/admin/broadcast")
async def admin_broadcast(body: BroadcastIn, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
    if not body.subject.strip() or not body.message.strip():
        raise HTTPException(status_code=400, detail="Subject and message are required")
    q = {"role": "customer", "email_verified": True}
    if body.audience == "selected":
        if not body.user_ids:
            raise HTTPException(status_code=400, detail="Select at least one customer")
        q["_id"] = {"$in": [ObjectId(i) for i in body.user_ids if ObjectId.is_valid(i)]}
    users = await db.users.find(q, {"email": 1, "name": 1}).to_list(10000)
    c = await db.campaigns.find_one({"_id": ObjectId(body.campaign_id)}) if body.campaign_id and ObjectId.is_valid(body.campaign_id) else None
    link = f"/campaign/{c['slug']}" if c else ""
    res = await db.broadcasts.insert_one({"kind": "manual", "subject": body.subject, "message": body.message, "audience": body.audience,
                                          "campaign_id": body.campaign_id or "", "channels": body.channels, "recipients": len(users),
                                          "sent": 0, "failed": 0, "status": "sending", "created_by": admin["email"], "created_at": now_iso()})
    background.add_task(run_broadcast, res.inserted_id, users, body, c, link, _origin(request))
    return {"message": f"Sending to {len(users)} customers", "id": str(res.inserted_id), "recipients": len(users)}


async def run_broadcast(bid, users: list, body: BroadcastIn, c: dict | None, link: str, origin: str):
    if "in_app" in body.channels and users:
        await db.notifications.insert_many([{"user_id": str(u["_id"]), "title": body.subject, "body": body.message[:300], "link": link,
                                             "type": "broadcast", "read": False, "created_at": now_iso()} for u in users])
    sent = failed = 0
    if "email" in body.channels:
        for u in users:
            ok = await send_broadcast_email(u.get("email", ""), u.get("name", ""), body.subject, body.message, c, f"{origin}{link}" if link else "")
            sent, failed = (sent + 1, failed) if ok else (sent, failed + 1)
    await db.broadcasts.update_one({"_id": bid}, {"$set": {"sent": sent, "failed": failed, "status": "done", "finished_at": now_iso()}})


@api.get("/admin/broadcasts")
async def admin_broadcasts(admin: dict = Depends(require_admin)):
    items = await db.broadcasts.find().sort("created_at", -1).to_list(200)
    return [notif_out(b) for b in items]


@api.get("/admin/notifications")
async def admin_notifications(admin: dict = Depends(require_admin)):
    pipeline = [{"$group": {"_id": {"title": "$title", "created_at": {"$substr": ["$created_at", 0, 16]}, "type": "$type", "link": "$link"},
                            "count": {"$sum": 1}, "read": {"$sum": {"$cond": ["$read", 1, 0]}}}},
                {"$sort": {"_id.created_at": -1}}, {"$limit": 100}]
    rows = await db.notifications.aggregate(pipeline).to_list(100)
    return [{"title": r["_id"]["title"], "type": r["_id"]["type"], "link": r["_id"].get("link", ""), "created_at": r["_id"]["created_at"],
             "recipients": r["count"], "read": r["read"]} for r in rows]


@api.delete("/admin/notifications")
async def admin_delete_notifications(title: str = Query(...), created_at: str = Query(...), admin: dict = Depends(require_admin)):
    r = await db.notifications.delete_many({"title": title, "created_at": {"$regex": f"^{re.escape(created_at)}"}})
    return {"deleted": r.deleted_count}


# ----------------------------- Admin: customers & credit -----------------------------
@api.get("/admin/customers")
async def list_customers(admin: dict = Depends(require_admin)):
    users = await db.users.find({"role": "customer"}).sort("created_at", -1).to_list(5000)
    ids = [str(u["_id"]) for u in users]
    agg = {i: {"credit": 0.0, "debit": 0.0, "paid": 0.0, "pending": 0.0} for i in ids}
    txn_rows = await db.transactions.aggregate([
        {"$match": {"user_id": {"$in": ids}, "type": {"$in": ["credit", "debit"]}}},
        {"$group": {"_id": {"u": "$user_id", "t": "$type"}, "total": {"$sum": "$amount"}}},
    ]).to_list(None)
    for r in txn_rows:
        a = agg.get(r["_id"]["u"])
        if a:
            a[r["_id"]["t"]] += float(r["total"] or 0)
    wd_rows = await db.withdrawals.aggregate([
        {"$match": {"user_id": {"$in": ids}, "status": {"$in": ["paid", "pending", "approved"]}}},
        {"$group": {"_id": {"u": "$user_id", "s": "$status"}, "total": {"$sum": "$amount"}}},
    ]).to_list(None)
    for r in wd_rows:
        a = agg.get(r["_id"]["u"])
        if not a:
            continue
        key = "paid" if r["_id"]["s"] == "paid" else "pending"
        a[key] += float(r["total"] or 0)
    out = []
    for u in users:
        a = agg[str(u["_id"])]
        pu = public_user(u)
        pu["wallet"] = {
            "balance": round(a["credit"] - a["debit"] - a["pending"], 2),
            "total_earnings": round(a["credit"], 2),
            "total_credited": round(a["credit"], 2),
            "total_withdrawn": round(a["paid"], 2),
            "pending_withdrawal": round(a["pending"], 2),
        }
        out.append(pu)
    return out


@api.post("/admin/credit")
async def credit_wallet(body: CreditIn, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"_id": ObjectId(body.user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Customer not found")
    doc = {
        "user_id": body.user_id, "amount": abs(body.amount), "type": "credit",
        "description": body.description, "ref_id": body.ref_id or f"CR-{uuid.uuid4().hex[:8].upper()}",
        "campaign_id": body.campaign_id, "status": "completed", "created_at": now_iso(),
    }
    await db.transactions.insert_one(doc)
    return {"message": "Wallet credited"}


@api.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(require_admin)):
    campaigns = await db.campaigns.find({"is_deleted": False}).to_list(5000)
    total_campaigns = len(campaigns)
    live = sum(1 for c in campaigns if c.get("status") == "live")
    paused = sum(1 for c in campaigns if c.get("status") == "paused")
    closed = sum(1 for c in campaigns if c.get("status") == "closed")
    enabled = sum(1 for c in campaigns if c.get("offer_enabled"))
    total_customers = await db.users.count_documents({"role": "customer"})
    all_txns = await db.transactions.find({}).to_list(20000)
    total_earnings = sum(t["amount"] for t in all_txns if t["type"] == "credit")
    all_wds = await db.withdrawals.find({}).to_list(20000)
    total_paid = sum(w["amount"] for w in all_wds if w["status"] == "paid")
    total_pending_amt = sum(w["amount"] for w in all_wds if w["status"] in ("pending", "approved"))
    total_wallet = total_earnings - total_paid - total_pending_amt - \
        sum(t["amount"] for t in all_txns if t["type"] == "debit" and not t.get("ref_id", "").startswith("WD"))
    recent = sorted(campaigns, key=lambda c: c.get("updated_at", ""), reverse=True)[:5]
    return {
        "total_campaigns": total_campaigns, "live": live, "paused": paused, "closed": closed,
        "enabled_offers": enabled, "disabled_offers": total_campaigns - enabled,
        "total_customers": total_customers,
        "total_wallet_balance": round(total_earnings - total_paid - total_pending_amt, 2),
        "total_earnings": round(total_earnings, 2),
        "withdrawals_total": len(all_wds),
        "withdrawals_pending": sum(1 for w in all_wds if w["status"] == "pending"),
        "withdrawals_paid": sum(1 for w in all_wds if w["status"] == "paid"),
        "recent_campaigns": [campaign_out(c) for c in recent],
    }


# ----------------------------- Image upload -----------------------------
@api.post("/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if user.get("role") != "admin" and not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    ct = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    result = put_object(path, data, ct)
    await db.files.insert_one({
        "storage_path": result["path"], "original_filename": file.filename,
        "content_type": ct, "size": result.get("size"), "is_deleted": False,
        "created_at": now_iso(),
    })
    backend = os.environ.get("PUBLIC_BASE", "")
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))


# ----------------------------- Statements -----------------------------
async def _statement_rows(user_id: str):
    txns = await db.transactions.find({"user_id": user_id}).sort("created_at", -1).to_list(5000)
    rows = []
    for t in txns:
        rows.append({
            "Date": (t.get("created_at") or "")[:19].replace("T", " "),
            "Description": t.get("description", ""),
            "Type": t.get("type", "").upper(),
            "Amount": t.get("amount", 0),
            "Reference": t.get("ref_id", ""),
            "Status": t.get("status", ""),
        })
    return rows


@api.get("/statement")
async def download_statement(format: str = "csv", user: dict = Depends(get_current_user)):
    rows = await _statement_rows(user["id"])
    wallet = await compute_wallet(user["id"])
    fname = f"radhika_statement_{datetime.now().strftime('%Y%m%d')}"
    if format == "csv":
        import csv
        buf = io.StringIO()
        w = csv.DictWriter(buf, fieldnames=["Date", "Description", "Type", "Amount", "Reference", "Status"])
        w.writeheader()
        w.writerows(rows)
        return Response(content=buf.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f"attachment; filename={fname}.csv"})
    if format == "excel":
        import pandas as pd
        buf = io.BytesIO()
        df = pd.DataFrame(rows) if rows else pd.DataFrame(columns=["Date", "Description", "Type", "Amount", "Reference", "Status"])
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Statement")
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": f"attachment; filename={fname}.xlsx"})
    if format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm)
        styles = getSampleStyleSheet()
        title = ParagraphStyle("t", parent=styles["Title"], textColor=colors.HexColor("#991B1B"))
        elems = [Paragraph("RADHIKA TRADERS", title),
                 Paragraph("Wallet Statement · Trusted Partner for Financial Growth", styles["Normal"]),
                 Spacer(1, 10),
                 Paragraph(f"Account: {user.get('name')} ({user.get('email')})", styles["Normal"]),
                 Paragraph(f"Available Balance: Rs. {wallet['balance']} | Total Earnings: Rs. {wallet['total_earnings']}", styles["Normal"]),
                 Spacer(1, 14)]
        data = [["Date", "Description", "Type", "Amount", "Reference", "Status"]]
        for r in rows:
            data.append([r["Date"], r["Description"], r["Type"], f"Rs.{r['Amount']}", r["Reference"], r["Status"]])
        if len(data) == 1:
            data.append(["-", "No transactions yet", "-", "-", "-", "-"])
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#991B1B")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elems.append(table)
        doc.build(elems)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
                                 headers={"Content-Disposition": f"attachment; filename={fname}.pdf"})
    raise HTTPException(status_code=400, detail="Invalid format")


@api.get("/")
async def root():
    return {"message": "Radhika Traders API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.otp_codes.create_index("email")
        await db.login_attempts.create_index("identifier", unique=True)
        await db.campaigns.create_index("slug")
    except Exception as e:
        logger.warning(f"Index creation: {e}")
    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "name": "Harish Bhati", "email": admin_email,
            "password_hash": hash_password(admin_password), "role": "admin",
            "email_verified": True, "referral_code": generate_referral_code(),
            "mobile": "6376541191", "address": "Bada Gawali Pura Rd, Chhawani Naka, Agar, Madhya Pradesh 465441",
            "kyc": {"status": "verified"}, "bank": {}, "created_at": now_iso(),
        })
        logger.info("Admin seeded")
    elif existing.get("role") != "admin":
        await db.users.update_one({"email": admin_email}, {"$set": {"role": "admin"}})
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await seed_demo_data()


async def seed_demo_data():
    for name in ["Demat", "Mutual Fund", "Savings A/C", "Credit Card", "Insurance", "Loan", "Digital Marketing"]:
        if not await db.categories.find_one({"slug": slugify(name)}):
            await db.categories.insert_one({"name": name, "slug": slugify(name), "enabled": True,
                                            "is_deleted": False, "created_at": now_iso()})


@app.on_event("shutdown")
async def shutdown():
    client.close()
