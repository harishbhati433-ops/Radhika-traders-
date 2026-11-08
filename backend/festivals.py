"""Automatic Festival Theme engine — pure date compare, no background jobs, no heavy libs.
Dates for lunar festivals come from a pre-computed Drik Panchang table (2025–2035) seeded into db.festival_themes;
admin can override any year's dates, toggle, set priority, preview (admin-only) or force-active. No Muslim festivals by owner's instruction."""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

IST = timezone(timedelta(hours=5, minutes=30))
CACHE_TTL = 30

# key -> {name, headline_hi, headline_en, tagline, priority, palette, dates: {year: [start, end]}}
SEED = {
    "diwali": {"wish": "शुभ दीपावली", "name": "Diwali", "emoji": "🪔", "headline_hi": "इस दीपावली, तरक्की की नई रोशनी!", "headline_en": "This Diwali, light up a new path to growth", "tagline": "Trusted Partner for Financial Growth",
               "greeting": "शुभ दीपावली! आपके जीवन में सुख, समृद्धि और तरक्की की रोशनी सदा बनी रहे।", "priority": 100, "palette": {"bg": "#160b05", "accent": "#f59e0b", "accent2": "#fde68a", "glow": "#f97316", "text": "#fff7ed"},
               "note": "Dhanteras → Bhai Dooj",
               "dates": {2025: ["2025-10-18", "2025-10-23"], 2026: ["2026-11-06", "2026-11-10"], 2027: ["2027-10-27", "2027-10-31"], 2028: ["2028-10-15", "2028-10-19"], 2029: ["2029-11-03", "2029-11-07"], 2030: ["2030-10-24", "2030-10-28"],
                         2031: ["2031-11-12", "2031-11-16"], 2032: ["2032-10-31", "2032-11-04"], 2033: ["2033-10-20", "2033-10-24"], 2034: ["2034-11-08", "2034-11-12"], 2035: ["2035-10-28", "2035-11-01"]}},
    "holi": {"wish": "हैप्पी होली", "name": "Holi", "emoji": "🎨", "headline_hi": "रंगों के साथ बढ़े आपकी कमाई!", "headline_en": "Add colour to your earnings this Holi", "tagline": "Trusted Partner for Financial Growth",
             "greeting": "होली की हार्दिक शुभकामनाएँ! रंगों की तरह आपकी ज़िंदगी भी खुशहाल रहे।", "priority": 80, "palette": {"bg": "#1a0b2e", "accent": "#ec4899", "accent2": "#a78bfa", "glow": "#22d3ee", "text": "#fdf4ff"},
             "note": "Holika Dahan + Dhulandi",
             "dates": {2025: ["2025-03-13", "2025-03-14"], 2026: ["2026-03-03", "2026-03-04"], 2027: ["2027-03-21", "2027-03-22"], 2028: ["2028-03-10", "2028-03-11"], 2029: ["2029-02-28", "2029-03-01"], 2030: ["2030-03-19", "2030-03-20"],
                       2031: ["2031-03-08", "2031-03-09"], 2032: ["2032-03-26", "2032-03-27"], 2033: ["2033-03-15", "2033-03-16"], 2034: ["2034-03-04", "2034-03-05"], 2035: ["2035-03-23", "2035-03-24"]}},
    "navratri": {"wish": "शुभ नवरात्रि", "name": "Navratri – Dussehra", "emoji": "🔱", "headline_hi": "शक्ति के साथ, सफलता की ओर!", "headline_en": "Nine nights of power, a season of success", "tagline": "Trusted Partner for Financial Growth",
                 "greeting": "नवरात्रि व विजयादशमी की शुभकामनाएँ! माँ दुर्गा आपको शक्ति और समृद्धि दें।", "priority": 70, "palette": {"bg": "#2a0a0a", "accent": "#ef4444", "accent2": "#fbbf24", "glow": "#f43f5e", "text": "#fff1f2"},
                 "note": "Navratri day 1 → Dussehra",
                 "dates": {2025: ["2025-09-22", "2025-10-02"], 2026: ["2026-10-11", "2026-10-20"], 2027: ["2027-09-30", "2027-10-09"], 2028: ["2028-09-19", "2028-09-27"], 2029: ["2029-10-08", "2029-10-16"], 2030: ["2030-09-27", "2030-10-06"],
                           2031: ["2031-10-17", "2031-10-25"], 2032: ["2032-10-05", "2032-10-14"], 2033: ["2033-09-24", "2033-10-03"], 2034: ["2034-10-13", "2034-10-22"], 2035: ["2035-10-03", "2035-10-11"]}},
    "ganesh": {"wish": "गणपति बप्पा मोरया", "name": "Ganesh Chaturthi", "emoji": "🕉️", "headline_hi": "गणपति बप्पा मोरया! विघ्न हरें, कमाई बढ़े", "headline_en": "Ganpati Bappa Morya — remove obstacles, grow your earnings", "tagline": "Trusted Partner for Financial Growth",
               "greeting": "गणेश चतुर्थी की हार्दिक शुभकामनाएँ! बप्पा आपके सभी विघ्न दूर करें और समृद्धि लाएँ।", "priority": 75, "palette": {"bg": "#1c0a04", "accent": "#f97316", "accent2": "#fde047", "glow": "#fb923c", "text": "#fff7ed"},
               "note": "Ganesh Chaturthi → Anant Chaturdashi (10 days)",
               "dates": {2025: ["2025-08-27", "2025-09-06"], 2026: ["2026-09-14", "2026-09-25"], 2027: ["2027-09-04", "2027-09-14"], 2028: ["2028-08-23", "2028-09-02"], 2029: ["2029-09-11", "2029-09-21"], 2030: ["2030-09-01", "2030-09-10"],
                         2031: ["2031-09-20", "2031-09-29"], 2032: ["2032-09-08", "2032-09-18"], 2033: ["2033-08-28", "2033-09-08"], 2034: ["2034-09-16", "2034-09-27"], 2035: ["2035-09-05", "2035-09-16"]}},
    "janmashtami": {"wish": "शुभ जन्माष्टमी", "name": "Krishna Janmashtami", "emoji": "🪈", "headline_hi": "कान्हा की कृपा, कमाई की बरसात", "headline_en": "Blessings of Kanha, a shower of earnings", "tagline": "Trusted Partner for Financial Growth",
                    "greeting": "श्री कृष्ण जन्माष्टमी की हार्दिक शुभकामनाएँ! कान्हा की कृपा सदा आप पर बनी रहे।", "priority": 60, "palette": {"bg": "#0a1230", "accent": "#3b82f6", "accent2": "#fde68a", "glow": "#818cf8", "text": "#eff6ff"}, "note": "1 day",
                    "dates": {2025: ["2025-08-16", "2025-08-16"], 2026: ["2026-09-04", "2026-09-04"], 2027: ["2027-08-25", "2027-08-25"], 2028: ["2028-08-13", "2028-08-13"], 2029: ["2029-09-01", "2029-09-01"], 2030: ["2030-08-21", "2030-08-21"],
                              2031: ["2031-08-10", "2031-08-10"], 2032: ["2032-08-28", "2032-08-28"], 2033: ["2033-08-17", "2033-08-17"], 2034: ["2034-09-06", "2034-09-06"], 2035: ["2035-08-26", "2035-08-26"]}},
    "shivratri": {"wish": "हर हर महादेव", "name": "Maha Shivratri", "emoji": "🔱", "headline_hi": "हर हर महादेव! सफलता का संकल्प", "headline_en": "Har Har Mahadev — a resolve for success", "tagline": "Trusted Partner for Financial Growth",
                  "greeting": "महाशिवरात्रि की हार्दिक शुभकामनाएँ! भोलेनाथ आपको सुख, शांति और समृद्धि दें।", "priority": 60, "palette": {"bg": "#0b1a1f", "accent": "#14b8a6", "accent2": "#e2e8f0", "glow": "#38bdf8", "text": "#f0fdfa"}, "note": "1 day",
                  "dates": {2025: ["2025-02-26", "2025-02-26"], 2026: ["2026-02-15", "2026-02-15"], 2027: ["2027-03-06", "2027-03-06"], 2028: ["2028-02-23", "2028-02-23"], 2029: ["2029-02-11", "2029-02-11"], 2030: ["2030-03-02", "2030-03-02"],
                            2031: ["2031-02-20", "2031-02-20"], 2032: ["2032-03-10", "2032-03-10"], 2033: ["2033-02-27", "2033-02-27"], 2034: ["2034-02-17", "2034-02-17"], 2035: ["2035-03-08", "2035-03-08"]}},
    "christmas": {"wish": "Merry Christmas", "name": "Christmas", "emoji": "🎄", "headline_hi": "Merry Christmas! खुशियों के साथ कमाई भी", "headline_en": "Merry Christmas — joy and earnings together", "tagline": "Trusted Partner for Financial Growth",
                  "greeting": "क्रिसमस की हार्दिक शुभकामनाएँ! आपका जीवन खुशियों और समृद्धि से भरा रहे।", "priority": 40, "palette": {"bg": "#071a10", "accent": "#dc2626", "accent2": "#fbbf24", "glow": "#4ade80", "text": "#f0fdf4"}, "fixed": ["12-24", "12-25"]},
    "rakhi": {"wish": "हैप्पी रक्षाबंधन", "name": "Raksha Bandhan", "emoji": "🎀", "headline_hi": "रिश्तों का बंधन, भरोसे का साथ", "headline_en": "Bonds of trust, growth for the family", "tagline": "Trusted Partner for Financial Growth",
              "greeting": "रक्षाबंधन की हार्दिक शुभकामनाएँ!", "priority": 60, "palette": {"bg": "#2b0f1f", "accent": "#f472b6", "accent2": "#fcd34d", "glow": "#fb7185", "text": "#fff1f2"}, "note": "1 day",
              "dates": {2025: ["2025-08-09", "2025-08-09"], 2026: ["2026-08-28", "2026-08-28"], 2027: ["2027-08-17", "2027-08-17"], 2028: ["2028-08-05", "2028-08-05"], 2029: ["2029-08-23", "2029-08-23"], 2030: ["2030-08-13", "2030-08-13"],
                        2031: ["2031-08-02", "2031-08-02"], 2032: ["2032-08-20", "2032-08-20"], 2033: ["2033-08-10", "2033-08-10"], 2034: ["2034-07-30", "2034-07-30"], 2035: ["2035-08-18", "2035-08-18"]}},
    "independence": {"wish": "स्वतंत्रता दिवस की शुभकामनाएँ", "name": "Independence Day", "emoji": "🇮🇳", "headline_hi": "आज़ादी का जश्न, आत्मनिर्भर कमाई", "headline_en": "Celebrate freedom with independent earnings", "tagline": "Trusted Partner for Financial Growth",
                     "greeting": "स्वतंत्रता दिवस की हार्दिक शुभकामनाएँ! जय हिंद।", "priority": 50, "palette": {"bg": "#0b1a12", "accent": "#f97316", "accent2": "#22c55e", "glow": "#ffffff", "text": "#f0fdf4"}, "fixed": ["08-15", "08-15"]},
    "republic": {"wish": "गणतंत्र दिवस की शुभकामनाएँ", "name": "Republic Day", "emoji": "🇮🇳", "headline_hi": "गणतंत्र का गौरव, तरक्की का संकल्प", "headline_en": "Pride of the Republic, promise of progress", "tagline": "Trusted Partner for Financial Growth",
                 "greeting": "गणतंत्र दिवस की हार्दिक शुभकामनाएँ! जय हिंद।", "priority": 50, "palette": {"bg": "#0b1a12", "accent": "#f97316", "accent2": "#22c55e", "glow": "#ffffff", "text": "#f0fdf4"}, "fixed": ["01-26", "01-26"]},
    "newyear": {"wish": "Happy New Year", "name": "New Year", "emoji": "🎉", "headline_hi": "नया साल, नई कमाई की शुरुआत!", "headline_en": "New year, new earnings — start strong", "tagline": "Trusted Partner for Financial Growth",
                "greeting": "नव वर्ष की हार्दिक शुभकामनाएँ!", "priority": 40, "palette": {"bg": "#0b1020", "accent": "#fbbf24", "accent2": "#60a5fa", "glow": "#a78bfa", "text": "#eff6ff"}, "fixed": ["12-31", "01-02"]},
    "sankranti": {"wish": "शुभ मकर संक्रांति", "name": "Makar Sankranti", "emoji": "🪁", "headline_hi": "ऊँची उड़ान, मीठी कमाई", "headline_en": "Fly high with sweeter earnings", "tagline": "Trusted Partner for Financial Growth",
                  "greeting": "मकर संक्रांति की हार्दिक शुभकामनाएँ!", "priority": 40, "palette": {"bg": "#0c1a2a", "accent": "#f59e0b", "accent2": "#38bdf8", "glow": "#fb923c", "text": "#f0f9ff"}, "fixed": ["01-14", "01-14"]},
}


class FestivalUpdate(BaseModel):
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    force_active: Optional[bool] = None
    preview: Optional[bool] = None
    year: Optional[int] = None
    start: Optional[str] = None
    end: Optional[str] = None
    headline_hi: Optional[str] = None
    headline_en: Optional[str] = None
    greeting: Optional[str] = None


def _window(f: dict, year: int):
    ov = (f.get("overrides") or {}).get(str(year))
    if ov:
        return date.fromisoformat(ov[0]), date.fromisoformat(ov[1])
    d = (f.get("dates") or {}).get(str(year))
    if d:
        return date.fromisoformat(d[0]), date.fromisoformat(d[1])
    fx = f.get("fixed")
    if fx:
        s = date.fromisoformat(f"{year}-{fx[0]}")
        e = date.fromisoformat(f"{year}-{fx[1]}")
        if e < s:
            e = date.fromisoformat(f"{year + 1}-{fx[1]}")
        return s, e
    return None


def _windows_around(f: dict, today: date):
    # New Year spans year boundary, so check previous year's window too.
    for y in (today.year - 1, today.year):
        w = _window(f, y)
        if w:
            yield y, w


FIREWORKS_ALWAYS = {"diwali", "newyear"}
FIREWORKS_LAST_DAY = {"navratri": "शुभ विजयादशमी"}  # Dussehra = last day of the Navratri window


def _public(f: dict, start=None, end=None, mode="scheduled", today=None) -> dict:
    key = f["key"]
    last_day = bool(end and today and end == today)
    wish = f.get("wish") or SEED.get(key, {}).get("wish") or f["name"]
    if last_day and key in FIREWORKS_LAST_DAY:
        wish = FIREWORKS_LAST_DAY[key]
    return {"key": key, "name": f["name"], "emoji": f.get("emoji", ""), "headline_hi": f["headline_hi"], "headline_en": f["headline_en"], "tagline": f["tagline"], "greeting": f.get("greeting", ""), "wish": wish,
            "fireworks": key in FIREWORKS_ALWAYS or (last_day and key in FIREWORKS_LAST_DAY),
            "palette": f["palette"], "start": start.isoformat() if start else None, "end": end.isoformat() if end else None, "mode": mode}


def build_festival_router(db, require_admin, get_current_user_optional, log_activity) -> APIRouter:
    r = APIRouter()
    cache = {"at": 0.0, "value": None}

    async def ensure_seed():
        if await db.festival_themes.estimated_document_count() >= len(SEED):
            return
        for key, f in SEED.items():
            doc = {"key": key, "enabled": True, "force_active": False, "preview": False, "overrides": {}, **{k: v for k, v in f.items() if k != "dates"}}
            if "dates" in f:
                doc["dates"] = {str(y): v for y, v in f["dates"].items()}
            await db.festival_themes.update_one({"key": key}, {"$setOnInsert": doc}, upsert=True)

    def pick(fests: list, today: date, include_preview: bool):
        best = None
        for f in fests:
            if f.get("force_active"):
                cand = (10_000 + int(f.get("priority", 0)), today, f, None, None, "forced")
            elif f.get("enabled") or (include_preview and f.get("preview")):
                hit = next(((y, s, e) for y, (s, e) in _windows_around(f, today) if s <= today <= e), None)
                if hit:
                    cand = (int(f.get("priority", 0)), -hit[1].toordinal(), f, hit[1], hit[2], "scheduled" if f.get("enabled") else "preview")
                elif include_preview and f.get("preview"):
                    w = _window(f, today.year)
                    cand = (-1, 0, f, w[0] if w else None, w[1] if w else None, "preview")
                else:
                    continue
            else:
                continue
            if best is None or (cand[0], cand[1]) > (best[0], best[1]):
                best = cand
        return best

    @r.get("/festival/active")
    async def active(request: Request, response: Response):
        import time
        response.headers["Cache-Control"] = "no-store"
        user = await get_current_user_optional(request)
        is_admin = bool(user and user.get("role") == "admin")
        now = time.time()
        if not is_admin and cache["value"] is not None and now - cache["at"] < CACHE_TTL:
            return cache["value"]
        await ensure_seed()
        fests = await db.festival_themes.find({}, {"_id": 0}).to_list(50)
        today = datetime.now(IST).date()
        best = pick(fests, today, include_preview=is_admin)
        out = {"active": _public(best[2], best[3], best[4], best[5], today) if best else None, "today": today.isoformat()}
        if not is_admin:
            cache["at"], cache["value"] = now, out
        return out

    @r.get("/admin/festivals")
    async def list_festivals(admin: dict = Depends(require_admin)):
        await ensure_seed()
        fests = await db.festival_themes.find({}, {"_id": 0}).sort("priority", -1).to_list(50)
        today = datetime.now(IST).date()
        out = []
        for f in fests:
            years = {}
            for y in range(today.year, today.year + 3):
                w = _window(f, y)
                if w:
                    years[str(y)] = {"start": w[0].isoformat(), "end": w[1].isoformat(), "overridden": str(y) in (f.get("overrides") or {})}
            w = next(((s, e) for _, (s, e) in _windows_around(f, today) if s <= today <= e), None)
            out.append({**f, "years": years, "active_now": bool(w) and f.get("enabled", False), "today": today.isoformat()})
        return out

    @r.put("/admin/festivals/{key}")
    async def update_festival(key: str, body: FestivalUpdate, request: Request, admin: dict = Depends(require_admin)):
        f = await db.festival_themes.find_one({"key": key})
        if not f:
            raise HTTPException(status_code=404, detail="Festival not found")
        upd = {k: v for k, v in body.model_dump(exclude_none=True).items() if k not in ("year", "start", "end")}
        if body.year and body.start and body.end:
            try:
                s, e = date.fromisoformat(body.start), date.fromisoformat(body.end)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date")
            if e < s:
                raise HTTPException(status_code=400, detail="End date must be after start date")
            upd[f"overrides.{body.year}"] = [body.start, body.end]
        if body.force_active:
            await db.festival_themes.update_many({"key": {"$ne": key}}, {"$set": {"force_active": False}})
        if upd:
            await db.festival_themes.update_one({"key": key}, {"$set": upd})
        cache["value"] = None
        await log_activity(admin, "festival_update", request, entity_type="festival", entity_id=key, entity_label=f["name"], status="updated", detail=", ".join(f"{k}={v}" for k, v in upd.items()))
        return await db.festival_themes.find_one({"key": key}, {"_id": 0})

    @r.delete("/admin/festivals/{key}/override/{year}")
    async def clear_override(key: str, year: int, admin: dict = Depends(require_admin)):
        await db.festival_themes.update_one({"key": key}, {"$unset": {f"overrides.{year}": ""}})
        cache["value"] = None
        return {"ok": True}

    return r
