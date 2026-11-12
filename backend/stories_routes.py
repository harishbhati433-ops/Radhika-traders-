"""Stories (WhatsApp/Instagram style) — admin-managed + automatic live-campaign stories, 24h auto-expiry, real view tracking."""
import asyncio
import hmac
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from storage_service import put_object, delete_object

logger = logging.getLogger(__name__)
APP_NAME = "radhika-traders"
CATEGORIES = ("Radhika Updates", "Live Campaigns", "Offers", "Festival Updates", "Office Celebrations", "Other")
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE = 8 * 1024 * 1024
MAX_VIDEO = 20 * 1024 * 1024
EXPIRY_HOURS = 24
MEDIA_GRACE_DAYS = 7
VIEW_DEDUP_SECONDS = 30
REACTIONS = ("heart", "fire")

now = lambda: datetime.now(timezone.utc)
iso = lambda d: d.isoformat()


def _parse(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


class StoryIn(BaseModel):
    title: str = Field("", max_length=80)
    caption: str = Field("", max_length=300)
    category: str = "Radhika Updates"
    media_type: str = "image"  # image | video | text
    media_path: str = ""
    media_url: str = ""
    thumb_path: str = ""
    thumb_url: str = ""
    bg_color: str = Field("#7c1d1d", max_length=16)
    font: str = Field("display", max_length=20)
    link: str = Field("", max_length=500)
    campaign_id: str = ""
    auto_expire: bool = True
    active: bool = True


def expires_at(s: dict) -> Optional[datetime]:
    if not s.get("auto_expire"):
        return None
    p = _parse(s.get("published_at"))
    return p + timedelta(hours=EXPIRY_HOURS) if p else None


def is_expired(s: dict, at: Optional[datetime] = None) -> bool:
    e = expires_at(s)
    return bool(e and e <= (at or now()))


def build_router(db, require_perm, get_current_user, log_activity, announce=None) -> APIRouter:
    r = APIRouter()
    manage = require_perm("campaigns", "edit")
    view_mgmt = require_perm("campaigns", "view")

    async def ensure_indexes():
        await db.stories.create_index([("kind", 1), ("campaign_id", 1)], unique=True, partialFilterExpression={"kind": "campaign"}, name="uniq_campaign_story")
        await db.stories.create_index([("active", 1), ("published_at", -1)])
        await db.story_views.create_index([("story_id", 1), ("user_id", 1)], unique=True)
        await db.story_views.create_index([("story_id", 1), ("viewed_at", -1)])
        await db.story_reactions.create_index([("story_id", 1), ("user_id", 1)], unique=True)

    asyncio.get_event_loop().create_task(ensure_indexes())
    last_sync = {"at": 0.0}

    # ---------- campaign sync (no duplicate media: campaign poster/logo referenced at read time) ----------
    async def sync_campaign_stories(force: bool = False):
        import time
        if not force and time.monotonic() - last_sync["at"] < 60:
            return
        last_sync["at"] = time.monotonic()
        live = await db.campaigns.find({"status": "live"}, {"_id": 1, "offer_name": 1, "updated_at": 1}).to_list(500)
        live_ids = {str(c["_id"]) for c in live}
        for c in live:
            cid = str(c["_id"])
            try:
                res = await db.stories.update_one({"kind": "campaign", "campaign_id": cid},
                                                  {"$setOnInsert": {"kind": "campaign", "campaign_id": cid, "category": "Live Campaigns", "auto_expire": True, "active": True,
                                                                    "published_at": iso(now()), "created_at": iso(now()), "media_type": "image"}}, upsert=True)
            except Exception:  # concurrent insert lost the race on the unique index — the doc exists now
                res = None
            if res is None or res.upserted_id is None:
                # republish automatically when a paused campaign goes live again (new publish time → fresh 24h window)
                await db.stories.update_one({"kind": "campaign", "campaign_id": cid, "live_cycle": {"$ne": c.get("updated_at", "")}, "campaign_live": False},
                                            {"$set": {"published_at": iso(now())}})
            await db.stories.update_one({"kind": "campaign", "campaign_id": cid}, {"$set": {"campaign_live": True, "live_cycle": c.get("updated_at", "")}})
        await db.stories.update_many({"kind": "campaign", "campaign_id": {"$nin": list(live_ids)}, "campaign_live": {"$ne": False}}, {"$set": {"campaign_live": False}})

    def _campaign_fields(c: dict) -> dict:
        benefit = (c.get("customer_benefit") or c.get("banner_tagline") or "").strip()
        payout = c.get("payout_amount")
        return {"title": c.get("offer_name", ""), "caption": benefit or (f"Payout ₹{payout} · Live now" if payout else "Live campaign"),
                "media_url": c.get("poster_url") or c.get("logo_url") or "", "media_type": "image" if (c.get("poster_url") or c.get("logo_url")) else "text",
                "link": f"/campaign/{c.get('slug', '')}" if c.get("slug") else "/campaigns", "company": c.get("company", ""), "payout": payout, "logo_url": c.get("logo_url", "")}

    async def hydrate(stories: list) -> list:
        cids = [ObjectId(s["campaign_id"]) for s in stories if s.get("kind") == "campaign" and ObjectId.is_valid(s.get("campaign_id", ""))]
        camps = {str(c["_id"]): c for c in await db.campaigns.find({"_id": {"$in": cids}}, {"offer_name": 1, "customer_benefit": 1, "banner_tagline": 1, "payout_amount": 1, "poster_url": 1, "logo_url": 1, "slug": 1, "company": 1, "status": 1}).to_list(500)} if cids else {}
        out = []
        for s in stories:
            d = {k: v for k, v in s.items() if k != "_id"}
            d["id"] = str(s["_id"])
            if s.get("kind") == "campaign":
                c = camps.get(s.get("campaign_id"))
                if not c:
                    continue
                d.update(_campaign_fields(c))
                d["campaign_live"] = c.get("status") == "live"
            e = expires_at(s)
            d["expires_at"] = iso(e) if e else None
            d["expired"] = is_expired(s)
            d["visible"] = bool(d.get("active")) and not d["expired"] and (d.get("kind") != "campaign" or d.get("campaign_live"))
            out.append(d)
        return out

    # ---------- customer ----------
    @r.get("/stories")
    async def list_stories(user: dict = Depends(get_current_user)):
        await sync_campaign_stories()
        cutoff = iso(now() - timedelta(hours=EXPIRY_HOURS))
        flt = {"active": True, "$and": [{"$or": [{"auto_expire": {"$ne": True}}, {"published_at": {"$gte": cutoff}}]},
                                        {"$or": [{"kind": {"$ne": "campaign"}}, {"campaign_live": True}]}]}
        docs = await db.stories.find(flt, {"viewers": 0}).sort("published_at", -1).to_list(100)
        items = [s for s in await hydrate(docs) if s["visible"]]
        seen = {v["story_id"] for v in await db.story_views.find({"user_id": user["id"], "story_id": {"$in": [s["id"] for s in items]}}, {"story_id": 1}).to_list(200)}
        mine = {x["story_id"]: x["emoji"] for x in await db.story_reactions.find({"user_id": user["id"], "story_id": {"$in": [s["id"] for s in items]}}, {"story_id": 1, "emoji": 1}).to_list(200)}
        public_keys = ("id", "kind", "title", "caption", "category", "media_type", "media_url", "thumb_url", "bg_color", "font", "link", "published_at", "expires_at", "company", "payout", "logo_url", "campaign_id")
        return [{**{k: s.get(k) for k in public_keys}, "seen": s["id"] in seen, "my_reaction": mine.get(s["id"])} for s in items]

    class ReactIn(BaseModel):
        emoji: Optional[str] = None  # "heart" | "fire" | None (remove)

    @r.post("/stories/{sid}/react")
    async def react(sid: str, body: ReactIn, user: dict = Depends(get_current_user)):
        if user.get("role") != "customer" or not ObjectId.is_valid(sid):
            raise HTTPException(status_code=403, detail="Only customers can react")
        if body.emoji is not None and body.emoji not in REACTIONS:
            raise HTTPException(status_code=400, detail="Invalid reaction")
        s = await db.stories.find_one({"_id": ObjectId(sid), "active": True}, {"auto_expire": 1, "published_at": 1})
        if not s or is_expired(s):
            raise HTTPException(status_code=404, detail="Story not found")
        key = {"story_id": sid, "user_id": user["id"]}
        if body.emoji is None:
            await db.story_reactions.delete_one(key)
        else:
            await db.story_reactions.update_one(key, {"$set": {"emoji": body.emoji, "reacted_at": iso(now()), "user_name": user.get("name", "")}}, upsert=True)
        return {"ok": True, "my_reaction": body.emoji}

    @r.post("/stories/{sid}/view", status_code=202)
    async def record_view(sid: str, user: dict = Depends(get_current_user)):
        if user.get("role") != "customer" or not ObjectId.is_valid(sid):
            return {"ok": False}
        s = await db.stories.find_one({"_id": ObjectId(sid), "active": True}, {"auto_expire": 1, "published_at": 1})
        if not s or is_expired(s):
            return {"ok": False}
        t = now()
        prev = await db.story_views.find_one({"story_id": sid, "user_id": user["id"]}, {"viewed_at": 1})
        if prev and (t - _parse(prev["viewed_at"])).total_seconds() < VIEW_DEDUP_SECONDS:
            return {"ok": True, "deduped": True}
        await db.story_views.update_one({"story_id": sid, "user_id": user["id"]},
                                        {"$set": {"viewed_at": iso(t), "user_name": user.get("name", ""), "avatar_url": user.get("avatar_url", "")},
                                         "$inc": {"count": 1}, "$setOnInsert": {"first_viewed_at": iso(t)}}, upsert=True)
        return {"ok": True}

    # ---------- admin ----------
    async def _stats(ids: list) -> dict:
        agg = await db.story_views.aggregate([{"$match": {"story_id": {"$in": ids}}}, {"$group": {"_id": "$story_id", "unique": {"$sum": 1}, "total": {"$sum": "$count"}}}]).to_list(500)
        out = {a["_id"]: {"total_views": a["total"], "unique_viewers": a["unique"], "hearts": 0, "fires": 0} for a in agg}
        ragg = await db.story_reactions.aggregate([{"$match": {"story_id": {"$in": ids}}}, {"$group": {"_id": {"s": "$story_id", "e": "$emoji"}, "n": {"$sum": 1}}}]).to_list(1000)
        for a in ragg:
            d = out.setdefault(a["_id"]["s"], {"total_views": 0, "unique_viewers": 0, "hearts": 0, "fires": 0})
            d["hearts" if a["_id"]["e"] == "heart" else "fires"] += a["n"]
        return out

    EMPTY_STATS = {"total_views": 0, "unique_viewers": 0, "hearts": 0, "fires": 0}

    @r.get("/admin/stories")
    async def admin_list(_: dict = Depends(view_mgmt)):
        await sync_campaign_stories(force=True)
        docs = await db.stories.find({}).sort([("created_at", -1)]).to_list(300)
        items = await hydrate(docs)
        stats = await _stats([s["id"] for s in items])
        for s in items:
            s.update(stats.get(s["id"], EMPTY_STATS))
        return {"manual": [s for s in items if s["kind"] != "campaign"], "campaign": [s for s in items if s["kind"] == "campaign"], "categories": list(CATEGORIES)}

    @r.post("/admin/stories/upload")
    async def upload_media(request: Request, file: UploadFile = File(...), _: dict = Depends(manage)):
        ct = (file.content_type or "").lower()
        if ct not in IMAGE_TYPES and ct not in VIDEO_TYPES:
            raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP, GIF images or MP4/WEBM videos are allowed")
        is_video = ct in VIDEO_TYPES
        limit = MAX_VIDEO if is_video else MAX_IMAGE
        data = bytearray()
        while chunk := await file.read(1024 * 1024):
            data.extend(chunk)
            if len(data) > limit:
                raise HTTPException(status_code=413, detail=f"File too large — max {limit // (1024 * 1024)} MB")
        data = bytes(data)
        if is_video:
            ext, out, out_ct = ("webm" if "webm" in ct else "mp4"), data, ("video/webm" if "webm" in ct else "video/mp4")
        else:
            out, ext, out_ct = await asyncio.to_thread(_to_webp, data, ct), "webp", "image/webp"
            if out is None:
                out, ext, out_ct = data, (ct.split("/")[-1].replace("jpeg", "jpg")), ct
        path = f"{APP_NAME}/stories/{uuid.uuid4().hex}.{ext}"
        res = await asyncio.to_thread(put_object, path, out, out_ct)
        await db.files.insert_one({"storage_path": res["path"], "original_filename": file.filename, "content_type": out_ct, "size": len(out), "is_deleted": False, "created_at": iso(now()), "purpose": "story"})
        return {"path": res["path"], "url": f"/api/files/{res['path']}", "media_type": "video" if is_video else "image", "size": len(out)}

    @r.post("/admin/stories", status_code=201)
    async def create_story(body: StoryIn, request: Request, background: BackgroundTasks, admin: dict = Depends(manage)):
        if body.category not in CATEGORIES:
            raise HTTPException(status_code=400, detail="Invalid category")
        if body.media_type in ("image", "video") and not body.media_url:
            raise HTTPException(status_code=400, detail="Please upload a photo or video first")
        if body.media_type == "text" and not (body.title or body.caption):
            raise HTTPException(status_code=400, detail="Text story needs a title or caption")
        link = body.link
        if body.campaign_id and ObjectId.is_valid(body.campaign_id):
            c = await db.campaigns.find_one({"_id": ObjectId(body.campaign_id)}, {"slug": 1})
            link = f"/campaign/{c['slug']}" if c and c.get("slug") else link
        doc = {**body.model_dump(), "link": link, "kind": "manual", "published_at": iso(now()) if body.active else None, "created_at": iso(now()), "updated_at": iso(now()),
               "created_by": admin.get("name", ""), "campaign_live": None}
        res = await db.stories.insert_one(doc)
        if body.active and announce:
            background.add_task(announce, {**doc, "id": str(res.inserted_id)})  # bell + push to every active customer the moment a story is published
        await log_activity(admin, "story_created", request, entity_type="story", entity_id=str(res.inserted_id), entity_label=body.title or body.caption[:40], detail=f"{body.media_type} · {body.category}")
        return (await hydrate([{**doc, "_id": res.inserted_id}]))[0]

    class StoryPatch(BaseModel):
        title: Optional[str] = Field(None, max_length=80)
        caption: Optional[str] = Field(None, max_length=300)
        category: Optional[str] = None
        media_type: Optional[str] = None
        media_path: Optional[str] = None
        media_url: Optional[str] = None
        thumb_path: Optional[str] = None
        thumb_url: Optional[str] = None
        bg_color: Optional[str] = Field(None, max_length=16)
        font: Optional[str] = Field(None, max_length=20)
        link: Optional[str] = Field(None, max_length=500)
        auto_expire: Optional[bool] = None
        active: Optional[bool] = None
        republish: Optional[bool] = None

    @r.put("/admin/stories/{sid}")
    async def update_story(sid: str, body: StoryPatch, request: Request, background: BackgroundTasks, admin: dict = Depends(manage)):
        if not ObjectId.is_valid(sid):
            raise HTTPException(status_code=404, detail="Story not found")
        s = await db.stories.find_one({"_id": ObjectId(sid)})
        if not s:
            raise HTTPException(status_code=404, detail="Story not found")
        upd = {k: v for k, v in body.model_dump(exclude_none=True).items() if k != "republish"}
        if s.get("kind") == "campaign":
            upd = {k: v for k, v in upd.items() if k in ("auto_expire", "active")}  # campaign stories mirror the campaign; only expiry/visibility are editable
        if body.republish or (body.active and not s.get("active")) or (body.republish is None and s.get("active") and is_expired(s) and "auto_expire" in upd):
            upd["published_at"] = iso(now())
            upd["active"] = True
        if "media_url" in upd and upd["media_url"] != s.get("media_url") and s.get("media_path"):
            await _delete_media(s["media_path"])
        if "thumb_url" in upd and upd["thumb_url"] != s.get("thumb_url") and s.get("thumb_path"):
            await _delete_media(s["thumb_path"])
        upd["updated_at"] = iso(now())
        await db.stories.update_one({"_id": s["_id"]}, {"$set": upd})
        if body.republish and s.get("kind") != "campaign" and announce:
            background.add_task(announce, {**s, **upd, "id": sid})
        await log_activity(admin, "story_updated", request, entity_type="story", entity_id=sid, entity_label=s.get("title", ""), detail=", ".join(sorted(upd)))
        fresh = await db.stories.find_one({"_id": s["_id"]})
        out = (await hydrate([fresh]))[0]
        out.update((await _stats([sid])).get(sid, EMPTY_STATS))
        return out

    async def _delete_media(path: str):
        if not path:
            return
        await db.files.update_one({"storage_path": path}, {"$set": {"is_deleted": True, "deleted_at": iso(now())}})
        try:
            await asyncio.to_thread(delete_object, path)
        except Exception as e:  # object may already be gone; DB flag already hides it
            logger.warning("story media delete failed for %s: %s", path, e)

    @r.delete("/admin/stories/{sid}")
    async def delete_story(sid: str, request: Request, admin: dict = Depends(manage)):
        if not ObjectId.is_valid(sid):
            raise HTTPException(status_code=404, detail="Story not found")
        s = await db.stories.find_one({"_id": ObjectId(sid)})
        if not s:
            raise HTTPException(status_code=404, detail="Story not found")
        if s.get("kind") == "campaign":
            raise HTTPException(status_code=400, detail="Campaign stories follow the campaign — pause/close the campaign or deactivate the story instead")
        await db.stories.delete_one({"_id": s["_id"]})
        await db.story_views.delete_many({"story_id": sid})
        await db.story_reactions.delete_many({"story_id": sid})
        await _delete_media(s.get("media_path", ""))
        await _delete_media(s.get("thumb_path", ""))
        await log_activity(admin, "story_deleted", request, entity_type="story", entity_id=sid, entity_label=s.get("title", ""))
        return {"ok": True}

    @r.get("/admin/stories/{sid}/viewers")
    async def viewers(sid: str, q: str = "", page: int = 1, limit: int = 30, admin: dict = Depends(view_mgmt)):
        if not ObjectId.is_valid(sid):
            raise HTTPException(status_code=404, detail="Story not found")
        limit = max(1, min(limit, 100)); skip = (max(page, 1) - 1) * limit
        flt = {"story_id": sid}
        if q.strip():
            flt["user_name"] = {"$regex": q.strip(), "$options": "i"}
        total_docs = await db.story_views.count_documents({"story_id": sid})
        rows = await db.story_views.find(flt).sort("viewed_at", -1).skip(skip).limit(limit).to_list(limit)
        ids = [ObjectId(v["user_id"]) for v in rows if ObjectId.is_valid(v["user_id"])]
        users = {str(u["_id"]): u for u in await db.users.find({"_id": {"$in": ids}}, {"name": 1, "mobile": 1, "customer_id": 1, "avatar_url": 1, "referral_code": 1}).to_list(limit)} if ids else {}
        reactions = {x["user_id"]: x["emoji"] for x in await db.story_reactions.find({"story_id": sid, "user_id": {"$in": [v["user_id"] for v in rows]}}, {"user_id": 1, "emoji": 1}).to_list(limit)}
        show_mobile = admin.get("role") == "admin"
        items = []
        for v in rows:
            u = users.get(v["user_id"], {})
            items.append({"user_id": v["user_id"], "name": u.get("name") or v.get("user_name", ""), "customer_id": u.get("customer_id") or u.get("referral_code") or v["user_id"][-6:].upper(),
                          "avatar_url": u.get("avatar_url") or v.get("avatar_url") or "", "viewed_at": v["viewed_at"], "first_viewed_at": v.get("first_viewed_at"), "count": v.get("count", 1),
                          "mobile": (u.get("mobile") or "") if show_mobile else None, "reaction": reactions.get(v["user_id"])})
        stats = (await _stats([sid])).get(sid, EMPTY_STATS)
        filtered = await db.story_views.count_documents(flt) if q.strip() else total_docs
        return {**stats, "items": items, "page": page, "limit": limit, "filtered": filtered, "has_more": skip + len(items) < filtered}

    # ---------- cron: media cleanup for expired auto-expire stories (7-day grace so admin can republish) ----------
    async def cleanup():
        cutoff = now() - timedelta(days=MEDIA_GRACE_DAYS)
        cur = db.stories.find({"kind": "manual", "auto_expire": True, "media_path": {"$nin": ["", None]}, "media_deleted": {"$ne": True}}, {"published_at": 1, "auto_expire": 1, "media_path": 1, "thumb_path": 1})
        n = 0
        async for s in cur:
            if is_expired(s, cutoff):
                await _delete_media(s["media_path"])
                await db.stories.update_one({"_id": s["_id"]}, {"$set": {"media_deleted": True, "active": False, "media_url": "", "media_path": "", "thumb_url": "", "thumb_path": ""}})
                await _delete_media(s.get("thumb_path", ""))
                n += 1
        logger.info("stories cleanup: removed media of %d expired stories", n)

    @r.post("/cron/stories-cleanup", status_code=202)
    async def cron_cleanup(request: Request, background: BackgroundTasks):
        secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else ""
        if not secret or not token or not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        background.add_task(cleanup)
        return {"accepted": True}

    r.sync_campaign_stories = sync_campaign_stories
    return r


def _to_webp(data: bytes, ct: str) -> Optional[bytes]:
    """Resize to max 1080x1920 and encode as WebP (lazy PIL import keeps idle RAM low)."""
    if ct == "image/gif":
        return None
    try:
        from io import BytesIO
        from PIL import Image, ImageOps
        im = Image.open(BytesIO(data))
        im = ImageOps.exif_transpose(im)
        im.thumbnail((1080, 1920))
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
        buf = BytesIO()
        im.save(buf, "WEBP", quality=82, method=4)
        return buf.getvalue()
    except Exception as e:
        logger.warning("webp convert failed: %s", e)
        return None
