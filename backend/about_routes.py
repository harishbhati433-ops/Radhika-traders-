"""About page content — leadership profiles + Mission & Vision, admin-editable (settings key 'about')."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

FOUNDER_ID = "founder-harish-bhati"

DEFAULT_ABOUT = {
    "profiles": [
        {"id": FOUNDER_ID, "locked": True, "visible": True, "name": "Harish Bhati", "title": "Owner & Founder", "photo_url": "/images/harish-bhati.jpeg", "photo2_url": "/images/harish-bhati-2.jpeg", "photo_pos": "center",
         "bio": "Harish Bhati has been working in the financial & affiliate marketing market for 7 years. With deep hands-on experience across demat accounts, banking products, insurance and digital campaigns, he leads Radhika Traders with a vision to help partners earn genuinely and customers choose the right financial products.",
         "highlight": "7+", "highlight_label": "Years in the Market"},
        {"id": "radha-rajput", "locked": False, "visible": True, "name": "Radha Rajput", "title": "Head of Operations & Management", "photo_url": "/images/radha-rajput.jpeg", "photo2_url": "", "photo_pos": "top",
         "bio": "Radha Rajput leads day-to-day operations and management at Radhika Traders — from campaign execution and partner support to payouts and team coordination. Her process-driven approach keeps every lead, payment and celebration running smoothly for our partners and customers.",
         "highlight": "", "highlight_label": ""},
    ],
    "mission": {"visible": True, "title": "Our Mission",
                "text": "To make trusted financial products accessible to every Indian household while creating genuine, transparent earning opportunities for our partners — with honest campaigns, on-time payouts and real human support."},
    "vision": {"visible": True, "title": "Our Vision",
               "text": "To become India's most trusted affiliate & financial services partner — a brand where customers choose the right product with confidence and every partner grows with us, year after year."},
}


class ProfileIn(BaseModel):
    id: str = ""
    locked: bool = False
    visible: bool = True
    name: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=100)
    photo_url: str = Field("", max_length=500)
    photo2_url: str = Field("", max_length=500)
    photo_pos: str = Field("center", pattern="^(top|center|bottom)$")
    bio: str = Field("", max_length=1200)
    highlight: str = Field("", max_length=12)
    highlight_label: str = Field("", max_length=40)


class BlockIn(BaseModel):
    visible: bool = True
    title: str = Field(..., min_length=1, max_length=60)
    text: str = Field("", max_length=1500)


class AboutIn(BaseModel):
    profiles: List[ProfileIn] = Field(default_factory=list, max_length=12)
    mission: BlockIn
    vision: BlockIn


def build_router(db, require_admin, log_activity) -> APIRouter:
    r = APIRouter()

    async def current() -> dict:
        doc = await db.settings.find_one({"key": "about"}, {"_id": 0, "key": 0}) or {}
        a = {**DEFAULT_ABOUT, **doc}
        a["profiles"] = [{"photo2_url": "", "photo_pos": "center", **p} for p in a["profiles"]]
        return a

    @r.get("/about/public")
    async def about_public(response: Response):
        response.headers["Cache-Control"] = "no-store"
        a = await current()
        return {"profiles": [p for p in a["profiles"] if p.get("visible", True)],
                "mission": a["mission"] if a["mission"].get("visible", True) else None,
                "vision": a["vision"] if a["vision"].get("visible", True) else None}

    @r.get("/admin/about")
    async def admin_about(response: Response, admin: dict = Depends(require_admin)):
        response.headers["Cache-Control"] = "no-store"
        return await current()

    @r.put("/admin/about")
    async def admin_update_about(body: AboutIn, request: Request, admin: dict = Depends(require_admin)):
        if not any(p.id == FOUNDER_ID for p in body.profiles):
            raise HTTPException(status_code=400, detail="The Founder & Owner profile cannot be removed. You can hide it instead.")
        profiles = []
        for p in body.profiles:
            d = p.model_dump()
            d["id"] = d["id"] or uuid.uuid4().hex[:12]
            d["locked"] = d["id"] == FOUNDER_ID
            for k in ("name", "title", "photo_url", "photo2_url", "bio", "highlight", "highlight_label"):
                d[k] = " ".join(d[k].split()) if k != "bio" else d[k].strip()
            profiles.append(d)
        new = {"profiles": profiles, "mission": body.mission.model_dump(), "vision": body.vision.model_dump()}
        for k in ("mission", "vision"):
            new[k]["title"], new[k]["text"] = new[k]["title"].strip(), new[k]["text"].strip()
        now = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"key": "about"}, {"$set": {**new, "updated_at": now, "updated_by": admin.get("name", "")}}, upsert=True)
        shown = sum(1 for p in profiles if p["visible"])
        await log_activity(admin, "about_page_updated", request, entity_type="about", entity_id="about", entity_label="About page",
                           status="updated", detail=f"{len(profiles)} profile(s), {shown} visible · mission {'on' if new['mission']['visible'] else 'off'} · vision {'on' if new['vision']['visible'] else 'off'}")
        return {"ok": True, **(await current())}

    return r
