"""Owner / Customer-care contact details — DB-backed, cached in memory for sync template builders."""
import re
import time

FIELDS = [
    ("owner_mobile", "Owner Mobile Number", "mobile"),
    ("support_mobile", "Customer Care Mobile Number", "mobile"),
    ("whatsapp_number", "WhatsApp Chat Number", "mobile"),
    ("support_email", "Support Gmail", "email"),
    ("owner_email", "Owner Gmail", "email"),
    ("instagram_url", "Instagram Page Link", "url"),
    ("facebook_url", "Facebook Page Link", "url"),
    ("youtube_url", "YouTube Channel Link", "url"),
    ("telegram_url", "Telegram Channel Link (leave blank to hide)", "url"),
]
DEFAULTS = {"owner_mobile": "6376541191", "support_mobile": "6376541191", "whatsapp_number": "6376541191",
            "support_email": "radhikatradersofficial@gmail.com", "owner_email": "bhatiharish276@gmail.com",
            "instagram_url": "https://www.instagram.com/growthwithharishbhati", "facebook_url": "https://www.facebook.com/share/1BadZkWMoV/",
            "youtube_url": "https://youtube.com/@radhikatradersofficial", "telegram_url": ""}
OPTIONAL = {"telegram_url"}
PUBLIC_FIELDS = ("owner_mobile", "support_mobile", "whatsapp_number", "support_email", "instagram_url", "facebook_url", "youtube_url", "telegram_url")
CONTACT = dict(DEFAULTS)

_MOBILE = re.compile(r"^[6-9]\d{9}$")
_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_URL = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.I)


def clean_mobile(v: str) -> str:
    d = re.sub(r"\D", "", v or "")
    return d[-10:] if len(d) >= 10 else d


def validate(field: str, kind: str, v: str) -> str:
    label = dict((f, l) for f, l, _ in FIELDS)[field]
    if kind == "mobile":
        v = clean_mobile(v)
        if not _MOBILE.match(v):
            raise ValueError(f"{label}: enter a valid 10-digit Indian mobile number")
        return v
    if kind == "url":
        v = (v or "").strip()
        if not v and field in OPTIONAL:
            return ""
        if not v.lower().startswith(("http://", "https://")):
            v = f"https://{v}"
        if not _URL.match(v):
            raise ValueError(f"{label}: enter a valid link (https://...)")
        return v
    v = (v or "").strip().lower()
    if not _EMAIL.match(v):
        raise ValueError(f"{label}: enter a valid email address")
    return v


_loaded_at = 0.0


async def load_contact(db) -> dict:
    global _loaded_at
    doc = await db.settings.find_one({"key": "contact"}) or {}
    for k in DEFAULTS:
        CONTACT[k] = doc.get(k) if (k in OPTIONAL and k in doc) else (doc.get(k) or DEFAULTS[k])
    _loaded_at = time.monotonic()
    return dict(CONTACT)


async def refresh_if_stale(db, ttl: float = 2.0) -> None:
    if time.monotonic() - _loaded_at > ttl:
        await load_contact(db)


def wa_number() -> str:
    d = CONTACT["whatsapp_number"]
    return f"+91 {d[:5]} {d[5:]}"


def wa_link(text: str = "") -> str:
    from urllib.parse import quote
    return f"https://wa.me/91{CONTACT['whatsapp_number']}" + (f"?text={quote(text)}" if text else "")
