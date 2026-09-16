"""Admin-only Contact & Support settings + public read endpoint."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

import contact_settings as cs


class ContactIn(BaseModel):
    owner_mobile: str
    support_mobile: str
    whatsapp_number: str
    support_email: str
    owner_email: str


def build_router(db, require_admin, log_activity) -> APIRouter:
    r = APIRouter()

    @r.get("/contact/public")
    async def contact_public(response: Response):
        await cs.load_contact(db)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        return {k: cs.CONTACT[k] for k in cs.PUBLIC_FIELDS}

    @r.get("/admin/contact")
    async def admin_contact(response: Response, admin: dict = Depends(require_admin)):
        await cs.load_contact(db)
        response.headers["Cache-Control"] = "no-store"
        doc = await db.settings.find_one({"key": "contact"}, {"_id": 0, "updated_at": 1, "updated_by": 1}) or {}
        return {**cs.CONTACT, "updated_at": doc.get("updated_at", ""), "updated_by": doc.get("updated_by", ""),
                "fields": [{"key": f, "label": l, "kind": k} for f, l, k in cs.FIELDS]}

    @r.put("/admin/contact")
    async def admin_update_contact(body: ContactIn, request: Request, admin: dict = Depends(require_admin)):
        try:
            new = {f: cs.validate(f, k, getattr(body, f)) for f, _, k in cs.FIELDS}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        await cs.load_contact(db)
        changes = [(f, l, cs.CONTACT[f], new[f]) for f, l, _ in cs.FIELDS if new[f] != cs.CONTACT[f]]
        if not changes:
            raise HTTPException(status_code=400, detail="No changes to save — all details are the same as before")
        now = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"key": "contact"}, {"$set": {**new, "updated_at": now, "updated_by": admin.get("name", "")}}, upsert=True)
        await db.contact_history.insert_many([{"field": f, "label": l, "old": o, "new": n, "changed_by": admin.get("name", ""),
                                                "changed_by_id": admin.get("id", ""), "created_at": now} for f, l, o, n in changes])
        for f, l, o, n in changes:
            await log_activity(admin, "contact_details_updated", request, entity_type="contact", entity_id=f, entity_label=l,
                               status="updated", detail=f"{l}: {o} → {n}")
        await cs.load_contact(db)
        return {"ok": True, "changed": [{"field": f, "label": l, "old": o, "new": n} for f, l, o, n in changes], **cs.CONTACT}

    @r.get("/admin/contact/history")
    async def admin_contact_history(admin: dict = Depends(require_admin)):
        items = await db.contact_history.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return {"items": items}

    return r
