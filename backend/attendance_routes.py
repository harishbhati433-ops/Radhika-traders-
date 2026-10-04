"""Employee attendance (check-in/out, statuses) + monthly salary calculation, exports and dashboard summary."""
import asyncio
import calendar
import hmac
import io
import logging
import os
from datetime import datetime, timezone, timedelta, date as ddate
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId
import pandas as pd

import contact_settings
import office_timing as ot
import attendance_policy as ap
from email_service import send_attendance_email, send_attendance_reminder_email, send_salary_paid_email, send_salary_published_email

logger = logging.getLogger("attendance")

IST = timezone(timedelta(hours=5, minutes=30))
REQUIRED_MINUTES = ot.REQUIRED_MINUTES  # office start/end/auto-close are admin-configurable via office_timing
STATUSES = ("present", "late", "short_hours", "half_day", "absent", "leave", "holiday", "weekly_off", "sunday_worked", "checkout_missing")
TIMED = ("present", "late", "short_hours", "half_day", "sunday_worked")
PAID_FULL = ("present", "late", "holiday", "weekly_off", "sunday_worked")
SALARY_DAYS = 30  # fixed 30-day basis: daily rate = monthly / 30 regardless of calendar length


def is_sunday(date_str: str) -> bool:
    return ddate.fromisoformat(date_str).weekday() == 6


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ist_today() -> str:
    return now_utc().astimezone(IST).strftime("%Y-%m-%d")


def fmt_t(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(IST).strftime("%I:%M %p") if iso else ""


def fmt_dur(mins) -> str:
    if mins is None:
        return ""
    m = int(round(mins))
    return f"{m // 60}h {m % 60:02d}m"


def _ist_minutes(iso: str) -> float:
    t = datetime.fromisoformat(iso).astimezone(IST)
    return t.hour * 60 + t.minute + t.second / 60


def is_late(check_in_iso: str) -> bool:
    return _ist_minutes(check_in_iso) > ot.start_min()


def paid_fraction(rec: dict) -> float:
    """Share of a day's salary earned by this record (1.0 = full day)."""
    st = rec.get("status")
    if st in PAID_FULL:
        return 1.0
    if st == "short_hours":
        return float(rec.get("paid_fraction") or 0)
    if st == "half_day":
        return 0.5
    if st == "leave":
        return 1.0 if rec.get("leave_paid") else 0.0
    return 0.0  # absent, checkout_missing (pending admin review)


def derive(rec: dict) -> dict:
    """Dynamic working-hours logic: full day = 7h worked regardless of arrival time; shortfall deducted minute-wise."""
    ci, co = rec.get("check_in"), rec.get("check_out")
    if not ci:
        return rec
    late = max(0.0, _ist_minutes(ci) - (ot.start_min()))
    rec["late"], rec["late_minutes"] = late > 0, int(round(late))
    if co:
        worked = max(0.0, (datetime.fromisoformat(co) - datetime.fromisoformat(ci)).total_seconds() / 60)
        extra = max(0.0, _ist_minutes(co) - (ot.end_min()))
        short = max(0.0, REQUIRED_MINUTES - worked)
        rec.update({"worked_minutes": int(round(worked)), "hours": round(worked / 60, 2), "extra_minutes": int(round(extra)),
                    "adjusted_minutes": int(round(min(late, extra))), "short_minutes": int(round(short)),
                    "paid_fraction": round(min(1.0, worked / REQUIRED_MINUTES), 4)})
        rec["status"] = "present" if rec["short_minutes"] == 0 else "short_hours"
        if rec.get("date") and is_sunday(rec["date"]):
            rec["status"] = "sunday_worked"
    else:
        rec.update({"worked_minutes": None, "hours": None, "extra_minutes": 0, "adjusted_minutes": 0, "short_minutes": None, "paid_fraction": None})
        if rec.get("status") != "checkout_missing":
            rec["status"] = "present"
    return rec


class AdminAttendanceIn(BaseModel):
    status: str
    check_in: Optional[str] = None   # "HH:MM" IST
    check_out: Optional[str] = None
    leave_paid: Optional[bool] = False
    note: Optional[str] = ""


class SalaryIn(BaseModel):
    monthly_salary: float


class AdjustIn(BaseModel):
    bonus: Optional[float] = 0
    incentive: Optional[float] = 0
    advance: Optional[float] = 0
    deduction: Optional[float] = 0
    note: Optional[str] = ""
    payment_status: Optional[str] = None  # pending | paid
    payment_date: Optional[str] = None
    proof_url: Optional[str] = None
    utr: Optional[str] = None


def build_router(db, require_admin, require_employee, log_activity) -> APIRouter:
    r = APIRouter()

    def out(a: dict, emp: Optional[dict] = None, per_day: float = 0) -> dict:
        d = {k: v for k, v in a.items() if k != "_id"}
        frac = paid_fraction(a)
        d.update({"id": str(a["_id"]), "check_in_time": fmt_t(a.get("check_in")), "check_out_time": fmt_t(a.get("check_out")),
                  "duration": fmt_dur(a.get("worked_minutes")), "paid_fraction": frac, "deduction": round(per_day * (1 - frac), 2) if per_day else None,
                  "auto_closed_time": fmt_t(a.get("auto_closed_at")) if a.get("auto_closed_at") else "",
                  "gps_label": " · ".join(x for x in [f"In {int(a['gps_in']['distance_m'])} m" if a.get("gps_in") else "", f"Out {int(a['gps_out']['distance_m'])} m" if a.get("gps_out") else "",
                                                       "selfie" if a.get("selfie_url") else ("selfie expired" if a.get("selfie_expired") else "")] if x),
                  "edited_at_label": datetime.fromisoformat(a["edited_at"]).astimezone(IST).strftime("%d %b %Y, %I:%M %p") if a.get("edited_at") else "",
                  "status_history": [{**h, "edited_at_label": datetime.fromisoformat(h["edited_at"]).astimezone(IST).strftime("%d %b %Y, %I:%M %p") if h.get("edited_at") else ""} for h in (a.get("status_history") or [])]})
        if emp:
            d.update({"employee_name": emp.get("name"), "employee_code": emp.get("employee_code", ""), "username": emp.get("original_username") or emp.get("username")})
        return d

    def per_day_of(emp: dict, month: str) -> float:
        return float((emp.get("salary") or {}).get("monthly") or 0) / SALARY_DAYS

    async def auto_close_stale() -> None:
        """Sessions without a manual check-out are closed at 6:00 PM IST and flagged for admin review (time is NOT auto-paid)."""
        now = now_utc().astimezone(IST)
        today = ist_today()
        after_close = (now.hour, now.minute) >= ot.auto_close()
        date_q = {"$lte": today} if after_close else {"$lt": today}
        close_min = ot.auto_close_min()
        stale = await db.attendance.find({"check_in": {"$ne": None}, "check_out": None, "status": {"$ne": "checkout_missing"}, "manual_override": {"$ne": True}, "date": date_q}).to_list(500)
        stale = [a for a in stale if a["date"] < today or _ist_minutes(a["check_in"]) < close_min]  # sessions started after 6 PM close next day
        if not stale:
            return
        ts = now_utc().isoformat()
        await db.attendance.update_many({"_id": {"$in": [a["_id"] for a in stale]}},
                                        {"$set": {"status": "checkout_missing", "auto_closed_at": ts, "hours": None, "worked_minutes": None, "short_minutes": None, "paid_fraction": None, "updated_at": ts}})
        for a in stale:
            asyncio.create_task(notify_punch({"id": a["employee_id"]}, {**a, "status": "checkout_missing", "auto_closed_at": ts}, "auto"))

    async def employees(ids: Optional[list] = None) -> dict:
        q = {"role": "employee", "account_status": {"$ne": "deleted"}}
        if ids is not None:
            q = {"role": "employee", "_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}
        return {str(u["_id"]): u for u in await db.users.find(q).sort("name", 1).to_list(1000)}

    def summarize(items: list, month: str, today: str, start_date: str = "") -> dict:
        y, m = map(int, month.split("-"))
        days = calendar.monthrange(y, m)[1]
        counted = {i["date"] for i in items}
        last = min(days, int(today[8:])) if today[:7] == month else (days if today[:7] > month else 0)
        now_ist = now_utc().astimezone(IST)
        # today only becomes "absent" after the 6 PM auto-close — nobody is absent at 7 AM
        absent_until = last - 1 if (today[:7] == month and last == int(today[8:]) and (now_ist.hour, now_ist.minute) < ot.auto_close()) else last
        joined = start_date[:10] if start_date else ""
        s = {k: 0 for k in ("present", "late", "short_hours", "half_day", "absent", "paid_leave", "unpaid_leave", "holiday", "weekly_off", "sunday_worked", "checkout_missing", "late_marks",
                            "late_minutes_total", "extra_minutes_total", "adjusted_minutes_total", "short_minutes_total")}
        paid = 0.0
        deduct_days = 0.0   # working-day shortfall in day units (absent=1, half=0.5, short=minutes/420, unpaid leave=1, checkout_missing=1)
        sunday_extra_days = 0.0  # Sundays worked, in day units (full=1, half=0.5, short=worked/420)
        sundays_off = 0
        for i in items:
            st = i.get("status")
            sun = is_sunday(i["date"])
            if st == "leave":
                s["paid_leave" if i.get("leave_paid") else "unpaid_leave"] += 1
            elif st in s:
                s[st] += 1
            if i.get("late"):
                s["late_marks"] += 1
            for k in ("late_minutes", "extra_minutes", "adjusted_minutes", "short_minutes"):
                s[f"{k}_total"] += int(i.get(k) or 0)
            f = paid_fraction(i)
            pf_stored = i.get("paid_fraction")
            sun_f = 0.5 if st == "half_day" else (min(1.0, float(pf_stored)) if pf_stored is not None and i.get("check_out") else 1.0)  # Sunday extra is minute-wise (7h = full), manual status without times = full
            if sun:
                if st in ("sunday_worked", "present", "late", "short_hours", "half_day"):
                    sunday_extra_days += sun_f
                else:
                    sundays_off += 1
                paid += 1.0  # Sunday itself is always a paid weekly off
            else:
                paid += f
                deduct_days += 1 - f
                if st == "sunday_worked":  # admin marked a non-Sunday (holiday/off day) as "Sunday Worked" → honour the extra
                    sunday_extra_days += sun_f
        s["pre_joining_days"] = 0
        for d in range(1, last + 1):
            ds = f"{month}-{d:02d}"
            if ds in counted:
                continue
            if joined and ds < joined:  # not employed yet: unpaid, but not an "absent"
                s["pre_joining_days"] += 1
                deduct_days += 1
            elif is_sunday(ds):
                sundays_off += 1
                paid += 1.0
            elif d <= absent_until:
                s["absent"] += 1
                deduct_days += 1
            # else: today, still in progress → neither paid nor absent yet
        s["weekly_off"] += sundays_off
        s["days_in_month"], s["days_elapsed"] = days, last
        s["paid_days"] = round(paid, 2)
        s["deduct_days"] = round(min(deduct_days, SALARY_DAYS), 4)
        s["sunday_extra_days"] = round(sunday_extra_days, 4)
        s["short_day_fraction"] = round(sum(1 - paid_fraction(i) for i in items if i.get("status") == "short_hours" and not is_sunday(i["date"])), 4)
        return s

    async def salary_row(emp: dict, month: str, today: str) -> dict:
        eid = str(emp["_id"])
        items = await db.attendance.find({"employee_id": eid, "date": {"$regex": f"^{month}"}}).to_list(100)
        joined = (emp.get("joining_date") or emp.get("created_at") or "")[:10]
        s = summarize(items, month, today, joined)
        not_joined = bool(joined) and month < joined[:7] and not items
        monthly = float((emp.get("salary") or {}).get("monthly") or 0) if not not_joined else 0.0
        per_day = monthly / SALARY_DAYS
        adj = await db.salary_adjustments.find_one({"employee_id": eid, "month": month}) or {}
        date_deds = adj.get("date_deductions") or []
        date_ded_total = round(sum(float(x.get("amount") or 0) for x in date_deds), 2)
        attendance_deduction = round(per_day * s["deduct_days"], 2)
        sunday_extra = round(per_day * s["sunday_extra_days"], 2)
        bonus, incentive = float(adj.get("bonus") or 0), float(adj.get("incentive") or 0)
        advance, manual_ded = float(adj.get("advance") or 0), float(adj.get("deduction") or 0)
        final = round(monthly + sunday_extra + bonus + incentive - attendance_deduction - advance - manual_ded - date_ded_total, 2)
        earned_to_date = round(per_day * s["paid_days"] + sunday_extra + bonus + incentive - advance - manual_ded - date_ded_total, 2)
        in_progress = today[:7] == month
        payable_now = min(earned_to_date, final) if in_progress else final  # what the employee is owed as of today (days present so far)
        return {"employee_id": eid, "employee_name": emp.get("name"), "employee_code": emp.get("employee_code", ""), "username": emp.get("original_username") or emp.get("username"),
                "month": month, "monthly_salary": monthly, "per_day": round(per_day, 2), **s, "earned": round(monthly - attendance_deduction, 2), "earned_to_date": earned_to_date, "payable_now": payable_now, "in_progress": in_progress,
                "as_of": today if in_progress else f"{month}-{calendar.monthrange(int(month[:4]), int(month[5:7]))[1]:02d}", "not_joined": not_joined, "joined_on": joined,
                "attendance_deduction": attendance_deduction, "sunday_extra": sunday_extra, "short_deduction": round(per_day * s["short_day_fraction"], 2), "absent_deduction": round(per_day * s["absent"], 2),
                "pending_review_deduction": round(per_day * s["checkout_missing"], 2),
                "bonus": bonus, "incentive": incentive, "advance": advance, "deduction": manual_ded, "date_deductions": date_deds, "date_deduction_total": date_ded_total,
                "manual_adjustment": round(advance + manual_ded + date_ded_total, 2), "note": adj.get("note", ""), "net_payable": final,
                "published": bool(adj.get("published")), "published_at": adj.get("published_at", ""), "published_by": adj.get("published_by", ""),
                "payment_status": adj.get("payment_status", "pending"), "payment_date": adj.get("payment_date", ""), "proof_url": adj.get("proof_url", ""), "utr": adj.get("utr", "")}

    def employee_view(row: dict) -> dict:
        """What the employee sees/gets: for a running month the salary is for days present till today, not the full-month projection."""
        return {**row, "net_payable": row["payable_now"]}

    async def audit(emp: dict, month: str, kind: str, amount: float, prev_final: float, new_final: float, admin: dict, reason: str, extra: Optional[dict] = None) -> None:
        await db.salary_audit.insert_one({"employee_id": str(emp["_id"]), "employee_name": emp.get("name"), "employee_code": emp.get("employee_code", ""), "month": month, "type": kind, "amount": round(float(amount), 2),
                                          "previous_final": prev_final, "new_final": new_final, "admin_id": admin.get("id", ""), "admin_name": admin.get("name", ""), "reason": (reason or "")[:300],
                                          "at": now_utc().isoformat(), **(extra or {})})

    def export(rows: list, cols: list, title: str, fmt: str, fname: str):
        df = pd.DataFrame([{c[1]: row.get(c[0], "") for c in cols} for row in rows]) if rows else pd.DataFrame(columns=[c[1] for c in cols])
        buf = io.BytesIO()
        if fmt == "csv":
            buf.write(df.to_csv(index=False).encode("utf-8-sig"))
            media, ext = "text/csv", "csv"
        elif fmt == "pdf":
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            doc = SimpleDocTemplate(buf, pagesize=landscape(A4) if len(cols) > 7 else A4, leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
            st = getSampleStyleSheet()
            data = [[c[1] for c in cols]] + [[str(row.get(c[0], "")) for c in cols] for row in rows]
            t = Table(data, repeatRows=1)
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#991B1B")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                                   ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")]))
            doc.build([Paragraph("<b>Radhika Traders</b> — " + title, st["Title"]), Paragraph(f"Generated {now_utc().astimezone(IST).strftime('%d %b %Y, %I:%M %p IST')}", st["Normal"]), Spacer(1, 10), t])
            media, ext = "application/pdf", "pdf"
        else:
            with pd.ExcelWriter(buf, engine="openpyxl") as w:
                df.to_excel(w, index=False, sheet_name=title[:30])
            media, ext = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
        buf.seek(0)
        return StreamingResponse(buf, media_type=media, headers={"Content-Disposition": f'attachment; filename="{fname}.{ext}"'})

    ATT_COLS = [("date", "Date"), ("employee_name", "Employee"), ("employee_code", "Emp ID"), ("check_in_time", "Check-In"), ("check_out_time", "Manual Check-Out"), ("duration", "Working Duration"),
                ("late_minutes", "Late Min"), ("extra_minutes", "Extra Min"), ("adjusted_minutes", "Adjusted Min"), ("short_minutes", "Short Min"), ("status_label", "Status"), ("deduction", "Deduction (Rs)"), ("gps_label", "GPS / Selfie"), ("note", "Note")]
    SAL_COLS = [("employee_name", "Employee"), ("employee_code", "Emp ID"), ("month", "Month"), ("monthly_salary", "Base Salary"), ("per_day", "Daily Rate (/30)"), ("present", "Present"), ("short_hours", "Short Days"), ("half_day", "Half Day"), ("absent", "Absent"),
                ("paid_leave", "Paid Leave"), ("unpaid_leave", "Unpaid Leave"), ("weekly_off", "Weekly Off"), ("sunday_worked", "Sunday Worked"), ("sunday_extra", "Sunday Extra"), ("checkout_missing", "Checkout Missing"), ("attendance_deduction", "Attendance Deduction"),
                ("bonus", "Bonus"), ("incentive", "Incentive"), ("manual_adjustment", "Manual Adjustment"), ("earned_to_date", "Earned Till Today"), ("net_payable", "Final Salary"), ("published", "Published"), ("payment_status", "Payment Status"), ("payment_date", "Payment Date")]

    def label(a: dict) -> str:
        st = a.get("status", "")
        if st == "leave":
            return "Leave (Paid)" if a.get("leave_paid") else "Leave (Unpaid)"
        if st == "checkout_missing":
            return "Checkout Missing – Admin Review"
        if st == "present":
            return "Present (Full Day)"
        if st == "sunday_worked":
            return "Sunday Worked"
        return st.replace("_", " ").title()

    async def notify_punch(emp: dict, rec: dict, kind: str, origin: str = "") -> None:
        full = await db.users.find_one({"_id": ObjectId(emp["id"])}) if ObjectId.is_valid(emp["id"]) else None
        if not full:
            return
        when = fmt_t(rec["check_in"] if kind == "in" else rec["check_out"] if kind == "out" else rec.get("auto_closed_at"))
        d = datetime.fromisoformat(rec["date"]).strftime("%d %b %Y")
        st = label(rec) + (" (Late)" if kind == "in" and rec.get("late") else "")
        hours = fmt_dur(rec.get("worked_minutes")) if kind == "out" else None
        extra = {"check_in": fmt_t(rec.get("check_in")), "check_out": fmt_t(rec.get("check_out")), "short_minutes": rec.get("short_minutes")} if kind != "in" else {}
        gps = rec.get("gps_in" if kind == "in" else "gps_out")
        if gps:
            extra["gps"] = f"{int(gps['distance_m'])} m from office (within {gps['radius_m']} m · GPS ±{int(gps['accuracy_m'] or 0)} m)"
        if kind == "in" and rec.get("selfie_url") and origin.startswith("https://"):
            extra["selfie_link"] = f"{origin}{rec['selfie_url']}"
        admins = await db.users.find({"role": "admin", "account_status": {"$ne": "deleted"}}, {"email": 1, "name": 1}).to_list(20)
        targets = {a["email"].lower(): (a.get("name", "Admin"), True) for a in admins if a.get("email")}
        targets.setdefault(contact_settings.CONTACT["owner_email"].lower(), ("Admin", True))
        if full.get("email"):
            targets.setdefault(full["email"].lower(), (full.get("name", ""), False))
        for to, (name, for_admin) in targets.items():
            try:
                await send_attendance_email(to, name, kind, full.get("name", ""), full.get("employee_code", ""), d, when, st, hours, for_admin, **extra)
            except Exception as e:  # never block attendance on email failure
                logger.warning(f"attendance email to {to} failed: {e}")

    # ---------------- Employee ----------------
    class PunchIn(BaseModel):
        lat: Optional[float] = None
        lng: Optional[float] = None
        accuracy: Optional[float] = None
        selfie: Optional[str] = None

    async def verify_punch(emp: dict, body: Optional[PunchIn], kind: str) -> dict:
        """Attendance mode gate: normal → nothing; gps → inside office radius; gps_selfie → + selfie on check-in. Returns extra fields to store."""
        user = await db.users.find_one({"_id": ObjectId(emp["id"])}, {"attendance_mode": 1}) if ObjectId.is_valid(emp["id"]) else None
        mode = ap.mode_for(user)
        if mode == "normal":
            return {"verify_mode": "normal"}
        b = body or PunchIn()
        gps, err = ap.verify_location(b.lat, b.lng, b.accuracy)
        if err:
            raise HTTPException(status_code=403, detail=err)
        extra = {"verify_mode": mode, f"gps_{kind}": gps}
        if mode == "gps_selfie" and kind == "in":
            if not b.selfie:
                raise HTTPException(status_code=400, detail="A live selfie is required for check-in.")
            try:
                extra["selfie_url"] = await ap.store_selfie(db, b.selfie, emp["id"])
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            extra["selfie_at"] = now_utc().isoformat()
        return extra

    @r.post("/employee/attendance/check-in")
    async def check_in(request: Request, background: BackgroundTasks, body: Optional[PunchIn] = None, emp: dict = Depends(require_employee)):
        today = ist_today()
        if await db.attendance.find_one({"employee_id": emp["id"], "date": today}):
            raise HTTPException(status_code=400, detail="Already checked in today")
        extra = await verify_punch(emp, body, "in")
        rec = derive({"employee_id": emp["id"], "date": today, "check_in": now_utc().isoformat(), "check_out": None, "source": "self", "note": "",
                      "ip": request.headers.get("x-forwarded-for", "").split(",")[0].strip(), "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(), **extra})
        res = await db.attendance.insert_one(rec)
        gps_note = f" · GPS {int(extra['gps_in']['distance_m'])} m" if extra.get("gps_in") else ""
        await log_activity(emp, "attendance_check_in", request, entity_type="attendance", entity_id=today, status=rec["status"], detail=f"Check-in {fmt_t(rec['check_in'])}{gps_note}" + (" · selfie" if extra.get("selfie_url") else ""))
        saved = await db.attendance.find_one({"_id": res.inserted_id})
        background.add_task(notify_punch, emp, saved, "in", (request.headers.get("origin") or str(request.base_url).rstrip("/")).replace("http://", "https://"))
        return out(saved)

    @r.post("/employee/attendance/check-out")
    async def check_out(request: Request, background: BackgroundTasks, body: Optional[PunchIn] = None, emp: dict = Depends(require_employee)):
        await auto_close_stale()
        rec = await db.attendance.find_one({"employee_id": emp["id"], "date": ist_today()})
        if not rec or not rec.get("check_in"):
            raise HTTPException(status_code=400, detail="Please check in first")
        if rec.get("status") == "checkout_missing":
            raise HTTPException(status_code=400, detail=f"Your session was auto-closed at {ot.auto_close_12()}. Admin will review and enter your actual check-out time.")
        if rec.get("check_out"):
            raise HTTPException(status_code=400, detail="Already checked out today")
        extra = await verify_punch(emp, body, "out")
        rec["check_out"] = now_utc().isoformat()
        manual = rec.get("manual_override") and rec.get("status")
        rec = derive(rec)
        if manual:  # admin's manually chosen status is final; only the actual times/minutes get recorded
            rec["auto_status"], rec["status"] = rec["status"], manual
        await db.attendance.update_one({"_id": rec["_id"]}, {"$set": {k: rec.get(k) for k in ("check_out", "hours", "status", "late", "late_minutes", "worked_minutes", "extra_minutes", "adjusted_minutes", "short_minutes", "paid_fraction", "auto_status")} | {"updated_at": now_utc().isoformat()} | {k: v for k, v in extra.items() if k != "verify_mode"}})
        await log_activity(emp, "attendance_check_out", request, entity_type="attendance", entity_id=rec["date"], status=rec["status"], detail=f"Check-out {fmt_t(rec['check_out'])} · {fmt_dur(rec['worked_minutes'])}" + (f" · short {rec['short_minutes']} min" if rec["short_minutes"] else ""))
        saved = await db.attendance.find_one({"_id": rec["_id"]})
        background.add_task(notify_punch, emp, saved, "out")
        return out(saved)

    @r.get("/employee/attendance")
    async def my_attendance(month: Optional[str] = None, emp: dict = Depends(require_employee)):
        await auto_close_stale()
        today = ist_today()
        month = month or today[:7]
        items = await db.attendance.find({"employee_id": emp["id"], "date": {"$regex": f"^{month}"}}).sort("date", -1).to_list(100)
        rec = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
        return {"today": out(rec) if rec else None, "date": today, "month": month, "items": [out(a) for a in items], "summary": summarize(items, month, today),
                "office": {"start": ot.start_12(), "end": ot.end_12(), "required_hours": REQUIRED_MINUTES / 60, "auto_close": ot.auto_close_12()},
                "policy": ap.employee_policy(await db.users.find_one({"_id": ObjectId(emp["id"])}, {"attendance_mode": 1}) if ObjectId.is_valid(emp["id"]) else None)}

    # ---------------- Admin ----------------
    @r.get("/admin/attendance")
    async def admin_attendance(date: Optional[str] = None, month: Optional[str] = None, employee_id: Optional[str] = None, status: Optional[str] = None, admin: dict = Depends(require_admin)):
        await auto_close_stale()
        q: dict = {}
        if date:
            q["date"] = date
        elif month:
            q["date"] = {"$regex": f"^{month}"}
        if employee_id:
            q["employee_id"] = employee_id
        if status:
            q["status"] = status
        emps = await employees()
        items = await db.attendance.find(q).sort([("date", -1), ("employee_id", 1)]).to_list(5000)
        rows = [out(a, emps.get(a["employee_id"]), per_day_of(emps[a["employee_id"]], a["date"][:7])) for a in items if a["employee_id"] in emps]

        def absent_row(eid, e, d):
            # No record for the day: Sunday → paid weekly off; today before auto-close → "not in yet"; otherwise absent (1 day deducted)
            today_, now_ist = ist_today(), now_utc().astimezone(IST)
            if is_sunday(d):
                st, ded, pf = "weekly_off", None, 1
            elif d == today_ and (now_ist.hour, now_ist.minute) < ot.auto_close():
                st, ded, pf = "not_in", None, None
            else:
                pd_ = per_day_of(e, d[:7])
                st, ded, pf = "absent", (round(pd_, 2) if pd_ else None), 0
            return {"id": "", "employee_id": eid, "date": d, "status": st, "status_label": {"weekly_off": "Weekly Off", "not_in": "Not in yet"}.get(st, "Absent"), "check_in_time": "", "check_out_time": "", "hours": None, "duration": "", "late": False, "late_minutes": 0, "extra_minutes": 0,
                    "adjusted_minutes": 0, "short_minutes": None, "paid_fraction": pf, "deduction": ded, "note": "", "virtual": True,
                    "employee_name": e.get("name"), "employee_code": e.get("employee_code", ""), "username": e.get("username")}
        if date and not status:  # show employees with no record as Absent for that day
            have = {a["employee_id"] for a in items}
            for eid, e in emps.items():
                if eid not in have and (not employee_id or employee_id == eid) and date <= ist_today():
                    rows.append(absent_row(eid, e, date))
        if status == "absent" and date:
            have = {a["employee_id"] for a in await db.attendance.find({"date": date}).to_list(1000)}
            rows = [absent_row(eid, e, date) for eid, e in emps.items() if eid not in have and (not employee_id or employee_id == eid)] + rows
        return {"items": rows, "employees": [{"id": k, "name": v.get("name"), "employee_code": v.get("employee_code", "")} for k, v in emps.items()],
                "rules": {"office_start": ot.start_12(), "office_end": ot.end_12(), "required_minutes": REQUIRED_MINUTES, "auto_close": ot.auto_close_12()}}

    @r.put("/admin/attendance/{employee_id}/{date}")
    async def admin_set_attendance(employee_id: str, date: str, body: AdminAttendanceIn, request: Request, admin: dict = Depends(require_admin)):
        if body.status not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        try:
            ddate.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date")
        if date > ist_today():
            raise HTTPException(status_code=400, detail="Attendance cannot be marked for a future date")
        old = await db.attendance.find_one({"employee_id": employee_id, "date": date})

        def to_iso(hhmm):
            if not hhmm:
                return None
            h, m = map(int, hhmm.split(":"))
            return datetime.fromisoformat(date).replace(hour=h, minute=m, tzinfo=IST).astimezone(timezone.utc).isoformat()
        rec = {"employee_id": employee_id, "date": date, "check_in": to_iso(body.check_in), "check_out": to_iso(body.check_out), "leave_paid": bool(body.leave_paid) if body.status == "leave" else False,
               "note": (body.note or "")[:200], "source": "admin", "edited_by": admin.get("name", ""), "edited_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(), "created_at": (old or {}).get("created_at") or now_utc().isoformat(),
               "auto_closed_at": None, "reviewed_by": admin.get("name", "") if (old or {}).get("status") == "checkout_missing" else (old or {}).get("reviewed_by"), "manual_override": True}
        if rec["check_in"] and rec["check_out"] and rec["check_out"] <= rec["check_in"]:
            raise HTTPException(status_code=400, detail="Check-out must be after check-in")
        if rec["check_in"]:
            rec = derive(rec)  # keeps actual times & minute metrics; status below is admin's final word
        else:
            rec.update({"hours": None, "worked_minutes": None, "late_minutes": 0, "extra_minutes": 0, "adjusted_minutes": 0, "short_minutes": None, "paid_fraction": None})
        rec["auto_status"] = rec.get("status") if rec["check_in"] and rec["check_out"] else None
        if body.status != "short_hours":  # short_hours = "use automatic minute-wise result"; everything else is a manual override
            rec["status"] = body.status
        rec["late"] = bool(rec.get("late_minutes")) if rec["check_in"] else body.status == "late"
        if body.status == "late" and not rec["check_in"]:
            rec["late"] = True
        old_status = (old or {}).get("status") or "absent"
        history_entry = {"old_status": old_status, "new_status": rec["status"], "edited_by": admin.get("name", ""), "edited_at": rec["edited_at"], "remark": rec["note"],
                         "check_in": fmt_t(rec["check_in"]), "check_out": fmt_t(rec["check_out"])}
        await db.attendance.update_one({"employee_id": employee_id, "date": date}, {"$set": rec, "$push": {"status_history": history_entry}}, upsert=True)
        def desc(a):
            times = " ".join(x for x in (fmt_t(a.get("check_in")), fmt_t(a.get("check_out"))) if x)
            return f"{label(a)}{' ' + times.replace(' ', '-', 1) if times else ''}" if a.get("check_in") and a.get("check_out") else f"{label(a)}{' ' + times if times else ''}"
        before = desc(old) if old else "Absent (no record)"
        after = desc(rec) + (f" · {fmt_dur(rec['worked_minutes'])}" if rec.get("worked_minutes") else "")
        await log_activity(admin, "attendance_edited", request, entity_type="attendance", entity_id=f"{employee_id}:{date}", entity_label=f"{emp.get('name')} · {date}", status=rec["status"], detail=f"{before} → {after}" + (f" · {rec['note']}" if rec["note"] else ""))
        return out(await db.attendance.find_one({"employee_id": employee_id, "date": date}), emp, per_day_of(emp, date[:7]))

    @r.get("/admin/attendance/dashboard")
    async def attendance_dashboard(admin: dict = Depends(require_admin)):
        await auto_close_stale()
        today = ist_today()
        emps = await employees()
        todays = await db.attendance.find({"date": today}).to_list(1000)
        by = {a["employee_id"]: a for a in todays if a["employee_id"] in emps}
        rows = [await salary_row(e, today[:7], today) for e in emps.values()]
        pending_review = await db.attendance.count_documents({"status": "checkout_missing", "employee_id": {"$in": list(emps)}})
        return {"date": today, "month": today[:7], "total_employees": len(emps),
                "present_today": sum(1 for a in by.values() if a["status"] in ("present", "late", "short_hours", "half_day", "checkout_missing")),
                "late_today": sum(1 for a in by.values() if a.get("late")), "on_leave_today": sum(1 for a in by.values() if a["status"] == "leave"),
                "absent_today": sum(1 for eid in emps if eid not in by or by[eid]["status"] == "absent"), "pending_review": pending_review,
                "day_closed": (now_utc().astimezone(IST).hour, now_utc().astimezone(IST).minute) >= ot.auto_close(),
                "total_monthly_salary": round(sum(r["monthly_salary"] for r in rows), 2), "salary_payable": round(sum(r["net_payable"] for r in rows), 2),
                "salary_paid": round(sum(r["net_payable"] for r in rows if r["payment_status"] == "paid"), 2),
                "salary_pending": round(sum(r["earned_to_date"] for r in rows if r["payment_status"] != "paid"), 2),
                "salary_projected": round(sum(r["net_payable"] for r in rows), 2)}

    @r.get("/admin/salary")
    async def salary_sheet(month: Optional[str] = None, admin: dict = Depends(require_admin)):
        await auto_close_stale()
        today = ist_today()
        month = month or today[:7]
        emps = await employees()
        return {"month": month, "rows": [await salary_row(e, month, today) for e in emps.values()]}

    @r.put("/admin/salary/{employee_id}")
    async def set_salary(employee_id: str, body: SalaryIn, request: Request, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp or body.monthly_salary < 0:
            raise HTTPException(status_code=400, detail="Invalid employee or salary")
        old = float((emp.get("salary") or {}).get("monthly") or 0)
        await db.users.update_one({"_id": emp["_id"]}, {"$set": {"salary.monthly": float(body.monthly_salary), "salary.updated_at": now_utc().isoformat()}})
        await log_activity(admin, "salary_set", request, entity_type="employee", entity_id=employee_id, entity_label=emp.get("name"), amount=body.monthly_salary, detail=f"₹{old:g} → ₹{body.monthly_salary:g}")
        return {"ok": True}

    @r.put("/admin/salary/{employee_id}/{month}")
    async def set_adjustments(employee_id: str, month: str, body: AdjustIn, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        prev = await db.salary_adjustments.find_one({"employee_id": employee_id, "month": month}) or {}
        prev_row = await salary_row(emp, month, ist_today())
        upd = {"bonus": float(body.bonus or 0), "incentive": float(body.incentive or 0), "advance": float(body.advance or 0), "deduction": float(body.deduction or 0), "note": (body.note or "")[:200], "updated_at": now_utc().isoformat()}
        newly_paid = False
        if body.payment_status in ("pending", "paid"):
            upd["payment_status"] = body.payment_status
            upd["payment_date"] = (body.payment_date or ist_today()) if body.payment_status == "paid" else ""
            upd["paid_by"] = admin.get("name", "") if body.payment_status == "paid" else ""
            upd["proof_url"] = (body.proof_url or "") if body.payment_status == "paid" else ""
            upd["utr"] = (body.utr or "")[:60] if body.payment_status == "paid" else ""
            newly_paid = body.payment_status == "paid" and prev.get("payment_status") != "paid"
        await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$set": upd, "$setOnInsert": {"employee_id": employee_id, "month": month}}, upsert=True)
        row = await salary_row(emp, month, ist_today())
        changed = {k: (prev_row[k], row[k]) for k in ("bonus", "incentive", "advance", "deduction") if prev_row[k] != row[k]}
        if changed or newly_paid or (body.payment_status == "pending" and prev.get("payment_status") == "paid"):
            kind = "post_finalize_change" if prev.get("published") and changed else ("payment" if not changed else "monthly_adjustment")
            await audit(emp, month, kind, sum(b - a for a, b in changed.values()) if changed else row["net_payable"], prev_row["net_payable"], row["net_payable"], admin, upd["note"],
                        {"changes": {k: {"from": a, "to": b} for k, (a, b) in changed.items()}, "payment_status": row["payment_status"]})
        await log_activity(admin, "salary_adjusted", request, entity_type="salary", entity_id=f"{employee_id}:{month}", entity_label=f"{emp.get('name')} · {month}", status=row["payment_status"], amount=row["net_payable"],
                           detail=f"bonus {upd['bonus']:g} · incentive {upd['incentive']:g} · advance {upd['advance']:g} · deduction {upd['deduction']:g} → net ₹{row['net_payable']:g}" + (" · marked PAID" if newly_paid else ""))
        if newly_paid and not prev.get("published"):  # paying implies finalizing → employee can see it
            await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$set": {"published": True, "published_at": now_utc().isoformat(), "published_by": admin.get("name", ""), "published_final": row["payable_now"]}})
            row = await salary_row(emp, month, ist_today())
        if newly_paid and emp.get("email"):
            origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
            link = f"{origin}{upd['proof_url']}" if upd["proof_url"].startswith("/") else upd["proof_url"]
            background.add_task(send_salary_paid_email, emp["email"], emp.get("name", ""), employee_view(row), upd["payment_date"], link, upd["utr"])
            row["email_sent_to"] = emp["email"]
        return row

    class DateDeductionIn(BaseModel):
        date: str
        amount: float
        reason: Optional[str] = ""

    @r.post("/admin/salary/{employee_id}/{month}/date-deduction")
    async def add_date_deduction(employee_id: str, month: str, body: DateDeductionIn, request: Request, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp or not body.date.startswith(month) or body.amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid employee, date (must be inside the month) or amount")
        prev_row = await salary_row(emp, month, ist_today())
        entry = {"id": uuid4().hex[:10], "date": body.date, "amount": round(body.amount, 2), "reason": (body.reason or "")[:200], "by": admin.get("name", ""), "at": now_utc().isoformat()}
        await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$push": {"date_deductions": entry}, "$setOnInsert": {"employee_id": employee_id, "month": month}}, upsert=True)
        row = await salary_row(emp, month, ist_today())
        await audit(emp, month, "date_deduction" + ("_post_finalize" if row["published"] else ""), -body.amount, prev_row["net_payable"], row["net_payable"], admin, body.reason, {"date": body.date})
        await log_activity(admin, "salary_date_deduction", request, entity_type="salary", entity_id=f"{employee_id}:{month}", entity_label=f"{emp.get('name')} · {body.date}", amount=body.amount, detail=f"₹{body.amount:g} deducted for {body.date}" + (f" · {body.reason}" if body.reason else ""))
        return row

    @r.delete("/admin/salary/{employee_id}/{month}/date-deduction/{ded_id}")
    async def remove_date_deduction(employee_id: str, month: str, ded_id: str, request: Request, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        prev_row = await salary_row(emp, month, ist_today())
        gone = next((x for x in prev_row["date_deductions"] if x["id"] == ded_id), None)
        if not gone:
            raise HTTPException(status_code=404, detail="Deduction not found")
        await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$pull": {"date_deductions": {"id": ded_id}}})
        row = await salary_row(emp, month, ist_today())
        await audit(emp, month, "date_deduction_removed", gone["amount"], prev_row["net_payable"], row["net_payable"], admin, gone.get("reason", ""), {"date": gone["date"]})
        return row

    class PublishIn(BaseModel):
        published: bool

    @r.put("/admin/salary/{employee_id}/{month}/publish")
    async def publish_salary(employee_id: str, month: str, body: PublishIn, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        row = await salary_row(emp, month, ist_today())
        upd = {"published": body.published, "published_at": now_utc().isoformat() if body.published else "", "published_by": admin.get("name", "") if body.published else "",
               "published_final": row["payable_now"] if body.published else None}
        await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$set": upd, "$setOnInsert": {"employee_id": employee_id, "month": month}}, upsert=True)
        await audit(emp, month, "published" if body.published else "unpublished", row["payable_now"], row["payable_now"], row["payable_now"], admin, "")
        await log_activity(admin, "salary_published" if body.published else "salary_unpublished", request, entity_type="salary", entity_id=f"{employee_id}:{month}", entity_label=f"{emp.get('name')} · {month}", amount=row["payable_now"])
        final = await salary_row(emp, month, ist_today())
        if body.published and emp.get("email") and final["payment_status"] != "paid":
            origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
            background.add_task(send_salary_published_email, emp["email"], emp.get("name", ""), employee_view(final), f"{origin}/employee/attendance")
            final["email_sent_to"] = emp["email"]
        return final

    @r.get("/admin/salary/audit")
    async def salary_audit_log(month: Optional[str] = None, employee_id: Optional[str] = None, admin: dict = Depends(require_admin)):
        q = {k: v for k, v in (("month", month), ("employee_id", employee_id)) if v}
        rows = await db.salary_audit.find(q, {"_id": 0}).sort("at", -1).to_list(500)
        for x in rows:
            x["at_label"] = datetime.fromisoformat(x["at"]).astimezone(IST).strftime("%d %b %Y, %I:%M %p")
        return {"items": rows}

    @r.post("/admin/salary/recalculate")
    async def recalculate(month: Optional[str] = None, employee_id: Optional[str] = None, request: Request = None, admin: dict = Depends(require_admin)):
        """Re-derive minute metrics & auto statuses for stored attendance (manual overrides untouched). Salary itself is always computed live on the fixed 30-day basis."""
        q: dict = {"check_in": {"$ne": None}, "manual_override": {"$ne": True}}
        if month:
            q["date"] = {"$regex": f"^{month}"}
        if employee_id:
            q["employee_id"] = employee_id
        n = 0
        async for a in db.attendance.find(q):
            if a.get("status") == "checkout_missing":
                continue
            new = derive(dict(a))
            await db.attendance.update_one({"_id": a["_id"]}, {"$set": {k: new.get(k) for k in ("status", "late", "late_minutes", "worked_minutes", "hours", "extra_minutes", "adjusted_minutes", "short_minutes", "paid_fraction")}})
            n += 1
        await log_activity(admin, "salary_recalculated", request, entity_type="salary", entity_id=month or "all", detail=f"{n} attendance records re-derived · daily rate = monthly ÷ 30")
        return {"ok": True, "records": n, "basis": f"Monthly ÷ {SALARY_DAYS}"}

    # ---------------- Employee: published salary only ----------------
    @r.get("/employee/salary")
    async def my_salary(emp: dict = Depends(require_employee)):
        pubs = await db.salary_adjustments.find({"employee_id": emp["id"], "published": True}).sort("month", -1).to_list(36)
        full = await db.users.find_one({"_id": ObjectId(emp["id"])})
        out_rows = []
        for p in pubs:
            r_ = employee_view(await salary_row(full, p["month"], ist_today()))
            out_rows.append({k: r_[k] for k in ("month", "monthly_salary", "per_day", "present", "late", "short_hours", "half_day", "absent", "paid_leave", "unpaid_leave", "weekly_off", "holiday", "sunday_worked",
                                                 "sunday_extra", "attendance_deduction", "manual_adjustment", "net_payable", "paid_days", "in_progress", "as_of", "payment_status", "payment_date", "published_at", "utr", "proof_url")} | {"bonus_incentive": round(r_["bonus"] + r_["incentive"], 2)})
        return {"items": out_rows}
    @r.get("/admin/attendance/export")
    async def export_attendance(format: str = "xlsx", date: Optional[str] = None, month: Optional[str] = None, employee_id: Optional[str] = None, admin: dict = Depends(require_admin)):
        data = await admin_attendance(date=date, month=month, employee_id=employee_id, status=None, admin=admin)
        rows = [{**a, "status_label": label(a)} for a in data["items"]]
        tag = date or month or "all"
        title = f"{'Daily' if date else 'Monthly' if month else ''} Attendance {tag}" + (f" — {rows[0]['employee_name']}" if employee_id and rows else "")
        return export(rows, ATT_COLS, title.strip(), format, f"attendance_{tag}")

    @r.get("/admin/salary/export")
    async def export_salary(month: str, format: str = "xlsx", admin: dict = Depends(require_admin)):
        data = await salary_sheet(month=month, admin=admin)
        return export(data["rows"], SAL_COLS, f"Salary Sheet {month}", format, f"salary_sheet_{month}")

    @r.get("/admin/salary/yearly")
    async def salary_yearly(year: Optional[int] = None, admin: dict = Depends(require_admin)):
        await auto_close_stale()
        today = ist_today()
        year = year or int(today[:4])
        emps = await employees()
        last_m = int(today[5:7]) if year == int(today[:4]) else (12 if year < int(today[:4]) else 0)
        joins = [(e.get("joining_date") or e.get("created_at") or "")[:7] for e in emps.values()]
        first = min((j for j in joins if j), default=f"{year}-01")
        start_m = int(first[5:7]) if first[:4] == str(year) else (1 if first[:4] < str(year) else 13)
        months = []
        for m in range(start_m, last_m + 1):
            mo = f"{year}-{m:02d}"
            rows = [r_ for r_ in [await salary_row(e, mo, today) for e in emps.values()] if not r_["not_joined"]]
            paid = round(sum(r["net_payable"] for r in rows if r["payment_status"] == "paid"), 2)
            total = round(sum(r["net_payable"] for r in rows), 2)
            months.append({"month": mo, "label": datetime(year, m, 1).strftime("%b %Y"), "total": total, "paid": paid, "pending": round(total - paid, 2),
                           "paid_days": round(sum(r["paid_days"] for r in rows), 2), "short_deduction": round(sum(r["short_deduction"] for r in rows), 2),
                           "is_current": mo == today[:7],
                           "employees": [{"employee_id": r["employee_id"], "net_payable": r["net_payable"], "payment_status": r["payment_status"], "paid_days": r["paid_days"]} for r in rows]})
        cur = next((x for x in months if x["is_current"]), None)
        prev = months[-2] if cur and len(months) >= 2 else (months[-1] if not cur and months else None)
        return {"year": year, "months": months, "employees": [{"id": k, "name": v.get("name"), "employee_code": v.get("employee_code", "")} for k, v in emps.items()],
                "totals": {"total": round(sum(x["total"] for x in months), 2), "paid": round(sum(x["paid"] for x in months), 2), "pending": round(sum(x["pending"] for x in months), 2)},
                "current": cur, "previous": prev}

    @r.get("/admin/salary/yearly/export")
    async def export_salary_yearly(year: int, format: str = "xlsx", admin: dict = Depends(require_admin)):
        data = await salary_yearly(year=year, admin=admin)
        emps = data["employees"]
        rows = []
        for mo in data["months"]:
            by = {e["employee_id"]: e for e in mo["employees"]}
            row = {"month": mo["label"], "total": mo["total"], "paid": mo["paid"], "pending": mo["pending"], "paid_days": mo["paid_days"]}
            for e in emps:
                row[f"emp_{e['id']}"] = by.get(e["id"], {}).get("net_payable", 0)
            rows.append(row)
        rows.append({"month": f"TOTAL {year}", **data["totals"], "paid_days": round(sum(m["paid_days"] for m in data["months"]), 2), **{f"emp_{e['id']}": round(sum(m2.get("net_payable", 0) for mo in data["months"] for m2 in mo["employees"] if m2["employee_id"] == e["id"]), 2) for e in emps}})
        cols = [("month", "Month")] + [(f"emp_{e['id']}", f"{e['name']} ({e['employee_code']})") for e in emps] + [("total", "Total Salary"), ("paid", "Paid"), ("pending", "Pending"), ("paid_days", "Paid Days")]
        return export(rows, cols, f"Yearly Salary Summary {year}", format, f"salary_yearly_{year}")

    @r.get("/admin/salary/statement/{employee_id}")
    async def salary_statement(employee_id: str, from_month: str, to_month: str, format: str = "pdf", admin: dict = Depends(require_admin)):
        """Multi-month salary slip (3 / 6 / 12 months or any range) for one employee."""
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        try:
            fy, fm = map(int, from_month.split("-")); ty, tm = map(int, to_month.split("-"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Months must be YYYY-MM")
        if (fy, fm) > (ty, tm):
            raise HTTPException(status_code=400, detail="From month must be before To month")
        today = ist_today()
        months, y, m = [], fy, fm
        while (y, m) <= (ty, tm) and f"{y}-{m:02d}" <= today[:7] and len(months) < 36:
            months.append(f"{y}-{m:02d}")
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        rows = [await salary_row(emp, mo, today) for mo in months]
        for r_ in rows:
            r_["label"] = datetime.strptime(r_["month"], "%Y-%m").strftime("%b %Y")
            r_["full_days"] = r_["present"] + r_["late"]
            r_["extras"] = round(r_["bonus"] + r_["incentive"], 2)
            r_["cuts"] = round(r_["manual_adjustment"], 2)
            r_["status_label"] = ("Paid " + r_["payment_date"]) if r_["payment_status"] == "paid" else "Pending"
        tot = {k: round(sum(r_[k] for r_ in rows), 2) for k in ("full_days", "short_hours", "half_day", "absent", "paid_days", "earned", "extras", "cuts", "net_payable")}
        paid_total = round(sum(r_['net_payable'] for r_ in rows if r_['payment_status'] == 'paid'), 2)
        tot.update({"label": "TOTAL", "monthly_salary": "", "status_label": f"Paid ₹{paid_total:,.2f}"})
        cols = [("label", "Month"), ("monthly_salary", "Monthly Salary"), ("full_days", "Full Days"), ("short_hours", "Short Days"), ("half_day", "Half"), ("absent", "Absent"), ("paid_days", "Paid Days"),
                ("earned", "Base − Att. Ded."), ("extras", "Bonus+Inc"), ("cuts", "Manual Adj"), ("net_payable", "Final Salary"), ("status_label", "Payment")]
        title = f"Salary Statement {months[0] if months else from_month} to {months[-1] if months else to_month}"
        fname = f"salary_statement_{emp.get('employee_code') or employee_id}_{from_month}_{to_month}"
        if format != "pdf":
            return export(rows + [tot], cols, title, format, fname)
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        try:
            pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")); pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
            font, fontb, rs = "DV", "DVB", "₹"
        except Exception:
            font, fontb, rs = "Helvetica", "Helvetica-Bold", "Rs "
            tot["status_label"] = f"Paid Rs {paid_total:,.2f}"
        money = {"monthly_salary", "earned", "extras", "cuts", "net_payable"}
        def cell(r_, k):
            v = r_.get(k, "")
            return f"{rs}{v:,.2f}" if k in money and isinstance(v, (int, float)) else str(v)
        data = [[c[1] for c in cols]] + [[cell(r_, c[0]) for c in cols] for r_ in rows + [tot]]
        t = Table(data, repeatRows=1)
        n = len(data) - 1
        t.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), font), ("FONTNAME", (0, 0), (-1, 0), fontb), ("FONTNAME", (0, n), (-1, n), fontb), ("FONTSIZE", (0, 0), (-1, -1), 8),
                               ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#991B1B")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("BACKGROUND", (0, n), (-1, n), colors.HexColor("#FEF3C7")),
                               ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")), ("ROWBACKGROUNDS", (0, 1), (-1, n - 1), [colors.white, colors.HexColor("#F8FAFC")]), ("PADDING", (0, 0), (-1, -1), 5)]))
        st = getSampleStyleSheet()
        head = Table([[f"Employee: {emp.get('name')}", f"Employee ID: {emp.get('employee_code', '')}", f"Period: {rows[0]['label'] if rows else from_month} – {rows[-1]['label'] if rows else to_month} ({len(rows)} months)"]], colWidths=[250, 200, 300])
        head.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), fontb), ("FONTSIZE", (0, 0), (-1, -1), 9), ("PADDING", (0, 0), (-1, -1), 4)]))
        summary = Paragraph(f"<b>Total Net Payable for period: {rs}{tot['net_payable']:,.2f}</b> &nbsp;·&nbsp; Paid Days {tot['paid_days']} &nbsp;·&nbsp; {tot['status_label']}", st["Normal"])
        buf = io.BytesIO()
        SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=28, bottomMargin=24).build(
            [Paragraph("<b>Radhika Traders</b> — Salary Statement", st["Title"]), Paragraph(f"Agar, Madhya Pradesh · Generated {now_utc().astimezone(IST).strftime('%d %b %Y')}", st["Normal"]), Spacer(1, 8), head, Spacer(1, 8), t, Spacer(1, 12), summary,
             Spacer(1, 18), Paragraph("This is a system-generated salary statement. Current month figures are provisional until month end.", st["Italic"])])
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'})

    @r.get("/admin/salary/slip/{employee_id}")
    async def salary_slip(employee_id: str, month: str, format: str = "pdf", admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        row = await salary_row(emp, month, ist_today())
        fields = [("Employee Name", row["employee_name"]), ("Employee ID", row["employee_code"]), ("Salary Month", month), ("Base Monthly Salary", f"₹{row['monthly_salary']:,.2f}"), ("Daily Salary Rate (÷30)", f"₹{row['per_day']:,.2f}"),
                  ("Present Days (7h+)", row["present"] + row["late"]), ("Short-Hour Days", row["short_hours"]), ("Total Short Minutes", row["short_minutes_total"]), ("Half Days", row["half_day"]),
                  ("Absent Days", row["absent"]), ("Paid Leave", row["paid_leave"]), ("Unpaid Leave", row["unpaid_leave"]), ("Weekly Off (Sunday, paid)", row["weekly_off"]), ("Holiday", row["holiday"]),
                  ("Checkout Missing (unpaid, pending review)", row["checkout_missing"]), ("Sunday Worked", row["sunday_worked"]), ("Sunday Extra (+)", f"₹{row['sunday_extra']:,.2f}"),
                  ("Attendance Deduction (−)", f"₹{row['attendance_deduction']:,.2f}"), ("Bonus / Incentive (+)", f"₹{row['bonus'] + row['incentive']:,.2f}"),
                  ("Manual Salary Adjustment (−)", f"₹{row['manual_adjustment']:,.2f}"),
                  ("Final Payable Salary", f"₹{row['net_payable']:,.2f}"), ("Payment Status", row["payment_status"].title()), ("Payment Date", row["payment_date"] or "—")]
        net_i = next(i for i, f in enumerate(fields) if f[0] == "Final Payable Salary")
        if format == "pdf":
            from reportlab.lib.pagesizes import A4
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            buf = io.BytesIO()
            try:
                pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
                pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
                font, fontb = "DV", "DVB"
            except Exception:
                font, fontb = "Helvetica", "Helvetica-Bold"
                fields = [(k, str(v).replace("₹", "Rs ")) for k, v in fields]
            st = getSampleStyleSheet()
            t = Table([[k, str(v)] for k, v in fields], colWidths=[220, 220])
            t.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), font), ("FONTNAME", (0, 0), (0, -1), fontb), ("FONTSIZE", (0, 0), (-1, -1), 10), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                                   ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]), ("BACKGROUND", (0, net_i), (-1, net_i), colors.HexColor("#FEF3C7")), ("FONTNAME", (0, net_i), (-1, net_i), fontb), ("PADDING", (0, 0), (-1, -1), 7)]))
            SimpleDocTemplate(buf, pagesize=A4, topMargin=36).build([Paragraph("<b>Radhika Traders</b> — Salary Slip", st["Title"]), Paragraph(f"Agar, Madhya Pradesh · Generated {now_utc().astimezone(IST).strftime('%d %b %Y')}", st["Normal"]), Spacer(1, 14), t,
                                                                     Spacer(1, 24), Paragraph("This is a system-generated salary slip.", st["Italic"])])
            buf.seek(0)
            return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="salary_slip_{row["employee_code"] or employee_id}_{month}.pdf"'})
        return export([{"field": k, "value": v} for k, v in fields], [("field", "Field"), ("value", "Value")], f"Salary Slip {month}", format, f"salary_slip_{row['employee_code'] or employee_id}_{month}")

    # ---------------- Office timing (admin-configurable) ----------------
    class OfficeTimingIn(BaseModel):
        start: str
        end: str
        auto_close: str

    @r.get("/admin/attendance/settings")
    async def get_office_timing(admin: dict = Depends(require_admin)):
        return ot.current()

    @r.put("/admin/attendance/settings")
    async def set_office_timing(body: OfficeTimingIn, request: Request, admin: dict = Depends(require_admin)):
        err = ot.validate(body.start, body.end, body.auto_close)
        if err:
            raise HTTPException(status_code=400, detail=err)
        old = ot.current()
        cur = await ot.save(db, body.start, body.end, body.auto_close, admin.get("name", ""))
        await log_activity(admin, "office_timing_changed", request, entity_type="settings", entity_id="office_timing", entity_label="Office Timing",
                           detail=f"{old['start_12']}–{old['end_12']} (close {old['auto_close_12']}) → {cur['start_12']}–{cur['end_12']} (close {cur['auto_close_12']})")
        return cur

    # ---------------- Attendance verification policy (Normal / GPS / GPS + Selfie) ----------------
    class PolicyIn(BaseModel):
        mode: str
        office_lat: Optional[float] = None
        office_lng: Optional[float] = None
        radius_m: int = 100
        selfie_retention_days: int = 60
        office_label: Optional[str] = ""

    class EmpModeIn(BaseModel):
        mode: Optional[str] = None  # None = follow global default

    @r.get("/admin/attendance/policy")
    async def get_policy(admin: dict = Depends(require_admin)):
        emps = await db.users.find({"role": "employee", "account_status": {"$ne": "deleted"}}, {"name": 1, "employee_code": 1, "attendance_mode": 1}).to_list(500)
        return {**ap.current(), "modes": [{"value": m, "label": ap.MODE_LABELS[m]} for m in ap.MODES],
                "employees": [{"id": str(e["_id"]), "name": e.get("name"), "employee_code": e.get("employee_code", ""), "attendance_mode": e.get("attendance_mode") if e.get("attendance_mode") in ap.MODES else None,
                               "effective_mode": ap.mode_for(e)} for e in emps]}

    @r.put("/admin/attendance/policy")
    async def set_policy(body: PolicyIn, request: Request, admin: dict = Depends(require_admin)):
        err = ap.validate_settings(body.model_dump())
        if err:
            raise HTTPException(status_code=400, detail=err)
        old = ap.current()
        cur = await ap.save(db, body.model_dump(), admin.get("name", ""))
        await log_activity(admin, "attendance_policy_changed", request, entity_type="settings", entity_id="attendance_policy", entity_label="Attendance Mode",
                           detail=f"{old['mode_label']} → {cur['mode_label']} · radius {cur['radius_m']} m · selfie kept {cur['selfie_retention_days']} days" + (" · office location set" if cur["office_set"] else ""))
        return await get_policy(admin)

    @r.put("/admin/attendance/policy/employee/{employee_id}")
    async def set_employee_mode(employee_id: str, body: EmpModeIn, request: Request, admin: dict = Depends(require_admin)):
        if body.mode is not None and body.mode not in ap.MODES:
            raise HTTPException(status_code=400, detail="Invalid attendance mode")
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        await db.users.update_one({"_id": ObjectId(employee_id)}, {"$set": {"attendance_mode": body.mode}} if body.mode else {"$unset": {"attendance_mode": ""}})
        await log_activity(admin, "attendance_mode_override", request, entity_type="employee", entity_id=employee_id, entity_label=emp.get("name", ""),
                           detail=f"Attendance mode → {ap.MODE_LABELS[body.mode] if body.mode else 'Default (global)'}")
        return await get_policy(admin)

    @r.post("/cron/selfie-cleanup", status_code=202)
    async def cron_selfie_cleanup(request: Request, background: BackgroundTasks):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else ""
        if not secret or not token or not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        run_id = request.headers.get("x-webhook-id") or str(uuid4())
        if await db.cron_runs.find_one({"run_id": run_id}):
            return {"ok": True, "duplicate": True, "run_id": run_id}
        await db.cron_runs.insert_one({"run_id": run_id, "schedule": "selfie-cleanup", "started_at": now_utc().isoformat()})

        async def run():
            n = await ap.cleanup_selfies(db)
            await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"finished_at": now_utc().isoformat(), "deleted": n}})
            logger.info(f"selfie cleanup {run_id}: {n} selfie(s) removed")
        background.add_task(run)
        return {"ok": True, "queued": True, "run_id": run_id}

    # ---------------- Cron: 10 AM attendance reminder ----------------
    async def run_attendance_reminder(run_id: str, origin: str) -> None:
        today = ist_today()
        if is_sunday(today):
            return
        marked = {a["employee_id"] for a in await db.attendance.find({"date": today}, {"employee_id": 1}).to_list(1000)}
        already = {x["employee_id"] for x in await db.attendance_reminders.find({"date": today}, {"employee_id": 1}).to_list(1000)}
        d = datetime.fromisoformat(today).strftime("%d %b %Y")
        link = f"{origin}/employee/attendance"
        sent = 0
        async for emp in db.users.find({"role": "employee", "account_status": {"$nin": ["deleted", "disabled", "inactive"]}}, {"name": 1, "email": 1, "employee_code": 1, "joining_date": 1, "created_at": 1}):
            eid = str(emp["_id"])
            joined = (emp.get("joining_date") or emp.get("created_at") or "")[:10]
            if eid in marked or eid in already or not emp.get("email") or (joined and joined > today):
                continue
            try:
                mid = await send_attendance_reminder_email(emp["email"], emp.get("name", ""), emp.get("employee_code", ""), d, link)
            except Exception as e:
                logger.warning(f"attendance reminder to {emp['email']} failed: {e}")
                mid = None
            await db.attendance_reminders.insert_one({"employee_id": eid, "date": today, "email": emp["email"], "sent_at": now_utc().isoformat(), "run_id": run_id, "email_id": mid})
            sent += 1
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"finished_at": now_utc().isoformat(), "sent": sent}})
        logger.info(f"attendance reminder {run_id}: {sent} email(s) sent for {today}")

    @r.post("/cron/attendance-reminder", status_code=202)
    async def cron_attendance_reminder(request: Request, background: BackgroundTasks):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.lower().startswith("bearer ") else ""
        if not secret or not token or not hmac.compare_digest(token, secret):
            raise HTTPException(status_code=401, detail="Unauthorized")
        try:
            body = await request.json() if await request.body() else {}
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Invalid request body")
        run_id = request.headers.get("x-webhook-id") or body.get("run_id") or str(uuid4())
        if await db.cron_runs.find_one({"run_id": run_id}):
            return {"ok": True, "duplicate": True, "run_id": run_id}
        await db.cron_runs.insert_one({"run_id": run_id, "schedule": "attendance-reminder", "started_at": now_utc().isoformat()})
        origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
        if not origin.startswith("https://") and "localhost" not in origin and "127.0.0.1" not in origin:
            origin = "https://" + origin.split("://", 1)[-1]
        background.add_task(run_attendance_reminder, run_id, origin)
        return {"ok": True, "queued": True, "run_id": run_id}

    return r
