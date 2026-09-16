"""Owner / Customer-care contact details — DB-backed, cached in memory for sync template builders."""
import re

FIELDS = [
    ("owner_mobile", "Owner Mobile Number", "mobile"),
    ("support_mobile", "Customer Care Mobile Number", "mobile"),
    ("whatsapp_number", "WhatsApp Chat Number", "mobile"),
    ("support_email", "Support Gmail", "email"),
    ("owner_email", "Owner Gmail", "email"),
]
DEFAULTS = {"owner_mobile": "6376541191", "support_mobile": "6376541191", "whatsapp_number": "6376541191",
            "support_email": "radhikatradersofficial@gmail.com", "owner_email": "bhatiharish276@gmail.com"}
PUBLIC_FIELDS = ("owner_mobile", "support_mobile", "whatsapp_number", "support_email")
CONTACT = dict(DEFAULTS)

_MOBILE = re.compile(r"^[6-9]\d{9}$")
_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def clean_mobile(v: str) -> str:
    d = re.sub(r"\D", "", v or "")
    return d[-10:] if len(d) >= 10 else d


def validate(field: str, kind: str, v: str) -> str:
    if kind == "mobile":
        v = clean_mobile(v)
        if not _MOBILE.match(v):
            raise ValueError(f"{dict((f, l) for f, l, _ in FIELDS)[field]}: enter a valid 10-digit Indian mobile number")
        return v
    v = (v or "").strip().lower()
    if not _EMAIL.match(v):
        raise ValueError(f"{dict((f, l) for f, l, _ in FIELDS)[field]}: enter a valid email address")
    return v


async def load_contact(db) -> dict:
    doc = await db.settings.find_one({"key": "contact"}) or {}
    for k in DEFAULTS:
        CONTACT[k] = doc.get(k) or DEFAULTS[k]
    return dict(CONTACT)


def wa_number() -> str:
    d = CONTACT["whatsapp_number"]
    return f"+91 {d[:5]} {d[5:]}"


def wa_link(text: str = "") -> str:
    from urllib.parse import quote
    return f"https://wa.me/91{CONTACT['whatsapp_number']}" + (f"?text={quote(text)}" if text else "")
