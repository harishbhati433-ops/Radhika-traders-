"""Employee attendance (check-in/out, statuses) + monthly salary calculation, exports and dashboard summary."""
import calendar
import io
from datetime import datetime, timezone, timedelta, date as ddate
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId
import pandas as pd

IST = timezone(timedelta(hours=5, minutes=30))
OFFICE_START, OFFICE_END = (10, 0), (17, 0)
HALF_DAY_HOURS = 4.0
STATUSES = ("present", "late", "half_day", "absent", "leave", "holiday", "weekly_off")
PAID_FULL = ("present", "late", "holiday", "weekly_off")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ist_today() -> str:
    return now_utc().astimezone(IST).strftime("%Y-%m-%d")


def fmt_t(iso: str) -> str:
    return datetime.fromisoformat(iso).astimezone(IST).strftime("%I:%M %p") if iso else ""


def is_late(check_in_iso: str) -> bool:
    t = datetime.fromisoformat(check_in_iso).astimezone(IST)
    return (t.hour, t.minute) > OFFICE_START


def derive(rec: dict) -> dict:
    """Fill hours/late/status from check-in/out for self-marked records."""
    ci, co = rec.get("check_in"), rec.get("check_out")
    rec["late"] = bool(ci) and is_late(ci)
    if ci and co:
        rec["hours"] = round((datetime.fromisoformat(co) - datetime.fromisoformat(ci)).total_seconds() / 3600, 2)
        rec["status"] = "half_day" if rec["hours"] < HALF_DAY_HOURS else ("late" if rec["late"] else "present")
    elif ci:
        rec["hours"] = None
        rec["status"] = "late" if rec["late"] else "present"
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


def build_router(db, require_admin, require_employee, log_activity) -> APIRouter:
    r = APIRouter()

    def out(a: dict, emp: Optional[dict] = None) -> dict:
        d = {k: v for k, v in a.items() if k != "_id"}
        d.update({"id": str(a["_id"]), "check_in_time": fmt_t(a.get("check_in")), "check_out_time": fmt_t(a.get("check_out"))})
        if emp:
            d.update({"employee_name": emp.get("name"), "employee_code": emp.get("employee_code", ""), "username": emp.get("original_username") or emp.get("username")})
        return d

    async def employees(ids: Optional[list] = None) -> dict:
        q = {"role": "employee", "account_status": {"$ne": "deleted"}}
        if ids is not None:
            q = {"role": "employee", "_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}
        return {str(u["_id"]): u for u in await db.users.find(q).sort("name", 1).to_list(1000)}

    def summarize(items: list, month: str, today: str) -> dict:
        y, m = map(int, month.split("-"))
        days = calendar.monthrange(y, m)[1]
        counted = {i["date"] for i in items}
        last = min(days, int(today[8:])) if today[:7] == month else (days if today[:7] > month else 0)
        s = {k: 0 for k in ("present", "late", "half_day", "absent", "paid_leave", "unpaid_leave", "holiday", "weekly_off", "late_marks")}
        for i in items:
            st = i.get("status")
            if st == "leave":
                s["paid_leave" if i.get("leave_paid") else "unpaid_leave"] += 1
            elif st in s:
                s[st] += 1
            if i.get("late"):
                s["late_marks"] += 1
        s["absent"] += sum(1 for d in range(1, last + 1) if f"{month}-{d:02d}" not in counted)
        s["days_in_month"], s["days_elapsed"] = days, last
        s["paid_days"] = round(s["present"] + s["late"] + s["holiday"] + s["weekly_off"] + s["paid_leave"] + 0.5 * s["half_day"], 1)
        return s

    async def salary_row(emp: dict, month: str, today: str) -> dict:
        eid = str(emp["_id"])
        items = await db.attendance.find({"employee_id": eid, "date": {"$regex": f"^{month}"}}).to_list(100)
        s = summarize(items, month, today)
        monthly = float((emp.get("salary") or {}).get("monthly") or 0)
        per_day = monthly / s["days_in_month"] if s["days_in_month"] else 0
        adj = await db.salary_adjustments.find_one({"employee_id": eid, "month": month}) or {}
        earned = round(per_day * s["paid_days"], 2)
        extras = float(adj.get("bonus") or 0) + float(adj.get("incentive") or 0)
        cuts = float(adj.get("advance") or 0) + float(adj.get("deduction") or 0)
        return {"employee_id": eid, "employee_name": emp.get("name"), "employee_code": emp.get("employee_code", ""), "username": emp.get("original_username") or emp.get("username"),
                "month": month, "monthly_salary": monthly, "per_day": round(per_day, 2), **s, "earned": earned,
                "bonus": float(adj.get("bonus") or 0), "incentive": float(adj.get("incentive") or 0), "advance": float(adj.get("advance") or 0),
                "deduction": float(adj.get("deduction") or 0), "note": adj.get("note", ""), "net_payable": round(earned + extras - cuts, 2),
                "payment_status": adj.get("payment_status", "pending"), "payment_date": adj.get("payment_date", "")}

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

    ATT_COLS = [("date", "Date"), ("employee_name", "Employee"), ("employee_code", "Emp ID"), ("check_in_time", "Check-In"), ("check_out_time", "Check-Out"), ("hours", "Hours"), ("status_label", "Status"), ("note", "Note")]
    SAL_COLS = [("employee_name", "Employee"), ("employee_code", "Emp ID"), ("month", "Month"), ("monthly_salary", "Monthly Salary"), ("present", "Present"), ("late", "Late"), ("half_day", "Half Day"), ("absent", "Absent"),
                ("paid_leave", "Paid Leave"), ("unpaid_leave", "Unpaid Leave"), ("paid_days", "Paid Days"), ("earned", "Earned"), ("bonus", "Bonus"), ("incentive", "Incentive"), ("advance", "Advance"), ("deduction", "Deduction"),
                ("net_payable", "Net Payable"), ("payment_status", "Payment Status"), ("payment_date", "Payment Date")]

    def label(a: dict) -> str:
        st = a.get("status", "")
        return ("Leave (Paid)" if a.get("leave_paid") else "Leave (Unpaid)") if st == "leave" else st.replace("_", " ").title()

    # ---------------- Employee ----------------
    @r.post("/employee/attendance/check-in")
    async def check_in(request: Request, emp: dict = Depends(require_employee)):
        today = ist_today()
        if await db.attendance.find_one({"employee_id": emp["id"], "date": today}):
            raise HTTPException(status_code=400, detail="Already checked in today")
        rec = derive({"employee_id": emp["id"], "date": today, "check_in": now_utc().isoformat(), "check_out": None, "source": "self", "note": "",
                      "ip": request.headers.get("x-forwarded-for", "").split(",")[0].strip(), "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()})
        res = await db.attendance.insert_one(rec)
        await log_activity(emp, "attendance_check_in", request, entity_type="attendance", entity_id=today, status=rec["status"], detail=f"Check-in {fmt_t(rec['check_in'])}")
        return out(await db.attendance.find_one({"_id": res.inserted_id}))

    @r.post("/employee/attendance/check-out")
    async def check_out(request: Request, emp: dict = Depends(require_employee)):
        rec = await db.attendance.find_one({"employee_id": emp["id"], "date": ist_today()})
        if not rec or not rec.get("check_in"):
            raise HTTPException(status_code=400, detail="Please check in first")
        if rec.get("check_out"):
            raise HTTPException(status_code=400, detail="Already checked out today")
        rec["check_out"] = now_utc().isoformat()
        rec = derive(rec)
        await db.attendance.update_one({"_id": rec["_id"]}, {"$set": {"check_out": rec["check_out"], "hours": rec["hours"], "status": rec["status"], "late": rec["late"], "updated_at": now_utc().isoformat()}})
        await log_activity(emp, "attendance_check_out", request, entity_type="attendance", entity_id=rec["date"], status=rec["status"], detail=f"Check-out {fmt_t(rec['check_out'])} · {rec['hours']} h")
        return out(await db.attendance.find_one({"_id": rec["_id"]}))

    @r.get("/employee/attendance")
    async def my_attendance(month: Optional[str] = None, emp: dict = Depends(require_employee)):
        today = ist_today()
        month = month or today[:7]
        items = await db.attendance.find({"employee_id": emp["id"], "date": {"$regex": f"^{month}"}}).sort("date", -1).to_list(100)
        rec = await db.attendance.find_one({"employee_id": emp["id"], "date": today})
        return {"today": out(rec) if rec else None, "date": today, "month": month, "items": [out(a) for a in items], "summary": summarize(items, month, today),
                "office": {"start": "10:00 AM", "end": "05:00 PM"}}

    # ---------------- Admin ----------------
    @r.get("/admin/attendance")
    async def admin_attendance(date: Optional[str] = None, month: Optional[str] = None, employee_id: Optional[str] = None, status: Optional[str] = None, admin: dict = Depends(require_admin)):
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
        rows = [out(a, emps.get(a["employee_id"])) for a in items if a["employee_id"] in emps]
        if date and not status:  # show employees with no record as Absent for that day
            have = {a["employee_id"] for a in items}
            for eid, e in emps.items():
                if eid not in have and (not employee_id or employee_id == eid) and date <= ist_today():
                    rows.append({"id": "", "employee_id": eid, "date": date, "status": "absent", "check_in_time": "", "check_out_time": "", "hours": None, "late": False, "note": "", "virtual": True,
                                 "employee_name": e.get("name"), "employee_code": e.get("employee_code", ""), "username": e.get("username")})
        if status == "absent" and date:
            have = {a["employee_id"] for a in await db.attendance.find({"date": date}).to_list(1000)}
            rows = [{"id": "", "employee_id": eid, "date": date, "status": "absent", "check_in_time": "", "check_out_time": "", "hours": None, "late": False, "note": "", "virtual": True,
                     "employee_name": e.get("name"), "employee_code": e.get("employee_code", ""), "username": e.get("username")} for eid, e in emps.items() if eid not in have and (not employee_id or employee_id == eid)] + rows
        return {"items": rows, "employees": [{"id": k, "name": v.get("name"), "employee_code": v.get("employee_code", "")} for k, v in emps.items()]}

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
        old = await db.attendance.find_one({"employee_id": employee_id, "date": date})

        def to_iso(hhmm):
            if not hhmm:
                return None
            h, m = map(int, hhmm.split(":"))
            return datetime.fromisoformat(date).replace(hour=h, minute=m, tzinfo=IST).astimezone(timezone.utc).isoformat()
        rec = {"employee_id": employee_id, "date": date, "check_in": to_iso(body.check_in), "check_out": to_iso(body.check_out), "leave_paid": bool(body.leave_paid) if body.status == "leave" else False,
               "note": (body.note or "")[:200], "source": "admin", "edited_by": admin.get("name", ""), "updated_at": now_utc().isoformat(), "created_at": (old or {}).get("created_at") or now_utc().isoformat()}
        if body.status in ("present", "late", "half_day") and rec["check_in"] and rec["check_out"]:
            rec = derive(rec)
            if body.status == "half_day":
                rec["status"] = "half_day"
        else:
            rec["status"], rec["late"] = body.status, body.status == "late"
            rec["hours"] = round((datetime.fromisoformat(rec["check_out"]) - datetime.fromisoformat(rec["check_in"])).total_seconds() / 3600, 2) if rec["check_in"] and rec["check_out"] else None
        await db.attendance.update_one({"employee_id": employee_id, "date": date}, {"$set": rec}, upsert=True)
        def desc(a):
            times = " ".join(x for x in (fmt_t(a.get("check_in")), fmt_t(a.get("check_out"))) if x)
            return f"{label(a)}{' ' + times.replace(' ', '-', 1) if times else ''}" if a.get("check_in") and a.get("check_out") else f"{label(a)}{' ' + times if times else ''}"
        before = desc(old) if old else "Absent (no record)"
        after = desc(rec)
        await log_activity(admin, "attendance_edited", request, entity_type="attendance", entity_id=f"{employee_id}:{date}", entity_label=f"{emp.get('name')} · {date}", status=rec["status"], detail=f"{before} → {after}" + (f" · {rec['note']}" if rec["note"] else ""))
        return out(await db.attendance.find_one({"employee_id": employee_id, "date": date}), emp)

    @r.get("/admin/attendance/dashboard")
    async def attendance_dashboard(admin: dict = Depends(require_admin)):
        today = ist_today()
        emps = await employees()
        todays = await db.attendance.find({"date": today}).to_list(1000)
        by = {a["employee_id"]: a for a in todays if a["employee_id"] in emps}
        rows = [await salary_row(e, today[:7], today) for e in emps.values()]
        return {"date": today, "month": today[:7], "total_employees": len(emps),
                "present_today": sum(1 for a in by.values() if a["status"] in ("present", "late", "half_day")),
                "late_today": sum(1 for a in by.values() if a.get("late")), "on_leave_today": sum(1 for a in by.values() if a["status"] == "leave"),
                "absent_today": sum(1 for eid in emps if eid not in by or by[eid]["status"] == "absent"),
                "total_monthly_salary": round(sum(r["monthly_salary"] for r in rows), 2), "salary_payable": round(sum(r["net_payable"] for r in rows), 2),
                "salary_paid": round(sum(r["net_payable"] for r in rows if r["payment_status"] == "paid"), 2),
                "salary_pending": round(sum(r["net_payable"] for r in rows if r["payment_status"] != "paid"), 2)}

    @r.get("/admin/salary")
    async def salary_sheet(month: Optional[str] = None, admin: dict = Depends(require_admin)):
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
    async def set_adjustments(employee_id: str, month: str, body: AdjustIn, request: Request, admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        upd = {"bonus": float(body.bonus or 0), "incentive": float(body.incentive or 0), "advance": float(body.advance or 0), "deduction": float(body.deduction or 0), "note": (body.note or "")[:200], "updated_at": now_utc().isoformat()}
        if body.payment_status in ("pending", "paid"):
            upd["payment_status"] = body.payment_status
            upd["payment_date"] = (body.payment_date or ist_today()) if body.payment_status == "paid" else ""
            upd["paid_by"] = admin.get("name", "") if body.payment_status == "paid" else ""
        await db.salary_adjustments.update_one({"employee_id": employee_id, "month": month}, {"$set": upd, "$setOnInsert": {"employee_id": employee_id, "month": month}}, upsert=True)
        row = await salary_row(emp, month, ist_today())
        await log_activity(admin, "salary_adjusted", request, entity_type="salary", entity_id=f"{employee_id}:{month}", entity_label=f"{emp.get('name')} · {month}", status=row["payment_status"], amount=row["net_payable"],
                           detail=f"bonus {upd['bonus']:g} · incentive {upd['incentive']:g} · advance {upd['advance']:g} · deduction {upd['deduction']:g} → net ₹{row['net_payable']:g}")
        return row

    # ---------------- Exports ----------------
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

    @r.get("/admin/salary/slip/{employee_id}")
    async def salary_slip(employee_id: str, month: str, format: str = "pdf", admin: dict = Depends(require_admin)):
        emp = (await employees([employee_id])).get(employee_id)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        row = await salary_row(emp, month, ist_today())
        fields = [("Employee Name", row["employee_name"]), ("Employee ID", row["employee_code"]), ("Salary Month", month), ("Monthly Salary", f"₹{row['monthly_salary']:,.2f}"),
                  ("Present Days", row["present"] + row["late"]), ("Late Marks", row["late_marks"]), ("Half Days", row["half_day"]), ("Absent Days", row["absent"]),
                  ("Paid Leave", row["paid_leave"]), ("Unpaid Leave", row["unpaid_leave"]), ("Paid Days", row["paid_days"]), ("Earned Salary", f"₹{row['earned']:,.2f}"),
                  ("Bonus / Incentive", f"₹{row['bonus'] + row['incentive']:,.2f}"), ("Advance", f"₹{row['advance']:,.2f}"), ("Other Deduction", f"₹{row['deduction']:,.2f}"),
                  ("Net Payable Salary", f"₹{row['net_payable']:,.2f}"), ("Payment Status", row["payment_status"].title()), ("Payment Date", row["payment_date"] or "—")]
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
                                   ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]), ("BACKGROUND", (0, 15), (-1, 15), colors.HexColor("#FEF3C7")), ("FONTNAME", (0, 15), (-1, 15), fontb), ("PADDING", (0, 0), (-1, -1), 7)]))
            SimpleDocTemplate(buf, pagesize=A4, topMargin=36).build([Paragraph("<b>Radhika Traders</b> — Salary Slip", st["Title"]), Paragraph(f"Agar, Madhya Pradesh · Generated {now_utc().astimezone(IST).strftime('%d %b %Y')}", st["Normal"]), Spacer(1, 14), t,
                                                                     Spacer(1, 24), Paragraph("This is a system-generated salary slip.", st["Italic"])])
            buf.seek(0)
            return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="salary_slip_{row["employee_code"] or employee_id}_{month}.pdf"'})
        return export([{"field": k, "value": v} for k, v in fields], [("field", "Field"), ("value", "Value")], f"Salary Slip {month}", format, f"salary_slip_{row['employee_code'] or employee_id}_{month}")

    return r
