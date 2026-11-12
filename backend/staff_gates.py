"""Secret entry links for the staff panels. Slugs live only in the DB (never in the frontend bundle) and can be rotated by the admin."""
import secrets
from datetime import datetime, timezone
from urllib.parse import quote

_cache: dict = {}


def _new_slug() -> str:
    return f"rt-{secrets.token_hex(5)}"


async def load(db) -> dict:
    doc = await db.staff_gates.find_one({"_id": "gates"})
    if not doc:
        doc = {"_id": "gates", "admin": _new_slug(), "employee": _new_slug(), "rotated_at": datetime.now(timezone.utc).isoformat()}
        await db.staff_gates.insert_one(doc)
    _cache.clear()
    _cache.update(doc)
    return doc


async def rotate(db, portal: str | None = None) -> dict:
    upd = {p: _new_slug() for p in (("admin", "employee") if portal is None else (portal,))}
    upd["rotated_at"] = datetime.now(timezone.utc).isoformat()
    await db.staff_gates.update_one({"_id": "gates"}, {"$set": upd}, upsert=True)
    return await load(db)


def portal_for(slug: str) -> str | None:
    for p in ("admin", "employee"):
        if _cache.get(p) and secrets.compare_digest(_cache[p], slug):
            return p
    return None


def slug(portal: str) -> str:
    return _cache.get(portal, "")


def link(origin: str, portal: str, next_path: str = "") -> str:
    base = f"{origin.rstrip('/')}/{slug(portal)}"
    return f"{base}?next={quote(next_path, safe='')}" if next_path else base
