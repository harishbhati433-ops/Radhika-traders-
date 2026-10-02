"""Homepage 'Radhika Traders Team' section — admin-editable photos, heading & visibility."""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

DEFAULT_TEAM = {
    "visible": True,
    "eyebrow": "Our People",
    "heading": "Radhika Traders Team",
    "description": "The team behind every campaign, payout and celebration at our Agar (M.P.) office.",
    "photos": [{"url": f"/images/team-{i}.jpeg", "caption": ""} for i in range(1, 5)],
}


class PhotoIn(BaseModel):
    url: str
    caption: str = ""


class TeamIn(BaseModel):
    visible: bool = True
    eyebrow: str = Field("", max_length=60)
    heading: str = Field(..., min_length=1, max_length=80)
    description: str = Field("", max_length=600)
    photos: List[PhotoIn] = Field(default_factory=list, max_length=12)


def build_router(db, require_admin, log_activity) -> APIRouter:
    r = APIRouter()

    async def current() -> dict:
        doc = await db.settings.find_one({"key": "team"}, {"_id": 0, "key": 0}) or {}
        return {**DEFAULT_TEAM, **doc}

    @r.get("/team/public")
    async def team_public(response: Response):
        response.headers["Cache-Control"] = "no-store"
        t = await current()
        return {k: t[k] for k in DEFAULT_TEAM}

    @r.get("/admin/team")
    async def admin_team(response: Response, admin: dict = Depends(require_admin)):
        response.headers["Cache-Control"] = "no-store"
        return await current()

    @r.put("/admin/team")
    async def admin_update_team(body: TeamIn, request: Request, admin: dict = Depends(require_admin)):
        photos = [{"url": p.url.strip(), "caption": p.caption.strip()[:80]} for p in body.photos if p.url.strip()]
        if body.visible and not photos:
            raise HTTPException(status_code=400, detail="Add at least one photo, or hide the Team section.")
        new = {"visible": body.visible, "eyebrow": body.eyebrow.strip(), "heading": body.heading.strip(), "description": body.description.strip(), "photos": photos}
        now = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"key": "team"}, {"$set": {**new, "updated_at": now, "updated_by": admin.get("name", "")}}, upsert=True)
        await log_activity(admin, "team_section_updated", request, entity_type="team", entity_id="homepage", entity_label="Team section",
                           status="updated", detail=f"{len(photos)} photo(s) · {'visible' if body.visible else 'hidden'}")
        return {"ok": True, **(await current())}

    return r
