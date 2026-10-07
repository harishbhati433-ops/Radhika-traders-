"""Employee leave requests: apply → admin one-tap Approve (Paid/Unpaid) / Reject → attendance + salary integration."""
import logging
from datetime import datetime, timezone, timedelta, date as ddate
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from bson import ObjectId

import contact_settings
from email_service import send_leave_request_email, send_leave_decision_email

logger = logging.getLogger("leaves")
IST = timezone(timedelta(hours=5, minutes=30))
MAX_DAYS = 30


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ist_today() -> str:
    return datetime.now(timezone.utc).astimezone(IST).date().isoformat()


def working_dates(start: str, end: str) -> list[str]:
    s, e = ddate.fromisoformat(start), ddate.fromisoformat(end)
    out, d = [], s
    while d <= e:
        if d.weekday() != 6:  # Sundays are paid weekly off already
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def real_email(u: dict) -> str:
    e = (u.get("email") or "").strip().lower()
    return "" if not e or e.endswith("@employee.radhikatraders.net") else e


class LeaveIn(BaseModel):
    from_date: str
    to_date: str
    reason: str = Field(..., min_length=3, max_length=300)
    leave_type: str = Field("casual", max_length=20)  # casual / sick / emergency / other


class DecisionIn(BaseModel):
    action: str  # approve | reject | set_paid | set_unpaid | cancel
    paid: Optional[bool] = None
    note: str = Field("", max_length=300)


def build_router(db, require_admin, require_employee, log_activity) -> APIRouter:
    r = APIRouter()

    def out(l: dict) -> dict:
        d = {k: v for k, v in l.items() if k != "_id"}
        d["id"] = str(l["_id"])
        d["pay_label"] = ("Paid" if l.get("paid") else "Unpaid") if l.get("status") == "approved" else ""
        return d

    async def apply_to_attendance(l: dict, admin: dict):
        """Approved leave → one attendance row per working day (status=leave, leave_paid). Salary sheet picks it up automatically."""
        for dt in l["dates"]:
            old = await db.attendance.find_one({"employee_id": l["employee_id"], "date": dt})
            if old and old.get("status") in ("present", "late", "short_hours", "half_day", "sunday_worked") and old.get("check_in"):
                continue  # employee actually worked that day — keep real attendance
            rec = {"employee_id": l["employee_id"], "date": dt, "status": "leave", "leave_paid": bool(l["paid"]), "check_in": None, "check_out": None,
                   "hours": None, "worked_minutes": None, "late": False, "late_minutes": 0, "extra_minutes": 0, "adjusted_minutes": 0, "short_minutes": None, "paid_fraction": None,
                   "note": f"Leave request · {l.get('reason', '')}"[:200], "source": "leave_request", "leave_request_id": str(l["_id"]), "manual_override": True,
                   "edited_by": admin.get("name", ""), "edited_at": now_iso(), "updated_at": now_iso(), "created_at": (old or {}).get("created_at") or now_iso()}
            hist = {"old_status": (old or {}).get("status") or "absent", "new_status": "leave", "edited_by": admin.get("name", ""), "edited_at": rec["edited_at"],
                    "remark": f"Leave {'Paid' if l['paid'] else 'Unpaid'} (request approved)", "check_in": "", "check_out": ""}
            await db.attendance.update_one({"employee_id": l["employee_id"], "date": dt}, {"$set": rec, "$push": {"status_history": hist}}, upsert=True)

    async def remove_from_attendance(l: dict):
        await db.attendance.delete_many({"employee_id": l["employee_id"], "leave_request_id": str(l["_id"]), "status": "leave"})

    def origin_of(request: Request) -> str:
        o = request.headers.get("origin") or str(request.base_url).rstrip("/")
        return o.replace("http://", "https://") if "localhost" not in o else o

    # ---------------- Employee ----------------
    @r.get("/employee/leaves")
    async def my_leaves(emp: dict = Depends(require_employee)):
        items = await db.leave_requests.find({"employee_id": emp["id"]}).sort("created_at", -1).to_list(200)
        yr = ist_today()[:4]
        appr = [l for l in items if l["status"] == "approved" and l["from_date"].startswith(yr)]
        return {"items": [out(l) for l in items],
                "summary": {"pending": sum(1 for l in items if l["status"] == "pending"), "paid_days": sum(l["days"] for l in appr if l.get("paid")),
                            "unpaid_days": sum(l["days"] for l in appr if not l.get("paid")), "year": yr}}

    @r.post("/employee/leaves", status_code=201)
    async def apply_leave(body: LeaveIn, request: Request, background: BackgroundTasks, emp: dict = Depends(require_employee)):
        try:
            s, e = ddate.fromisoformat(body.from_date), ddate.fromisoformat(body.to_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date")
        if e < s:
            raise HTTPException(status_code=400, detail="'To' date must be on or after 'From' date")
        if (e - s).days + 1 > MAX_DAYS:
            raise HTTPException(status_code=400, detail=f"A single request can cover at most {MAX_DAYS} days")
        if body.from_date < (ddate.fromisoformat(ist_today()) - timedelta(days=30)).isoformat():
            raise HTTPException(status_code=400, detail="Leave can be applied for the last 30 days or any future date")
        dates = working_dates(body.from_date, body.to_date)
        if not dates:
            raise HTTPException(status_code=400, detail="Selected dates are Sundays (already weekly off)")
        clash = await db.leave_requests.find_one({"employee_id": emp["id"], "status": {"$in": ["pending", "approved"]}, "from_date": {"$lte": body.to_date}, "to_date": {"$gte": body.from_date}})
        if clash:
            raise HTTPException(status_code=400, detail=f"You already have a {clash['status']} leave request overlapping these dates")
        full = await db.users.find_one({"_id": ObjectId(emp["id"])}) if ObjectId.is_valid(emp["id"]) else {}
        doc = {"employee_id": emp["id"], "employee_name": emp.get("name", ""), "employee_code": (full or {}).get("employee_code", ""),
               "from_date": body.from_date, "to_date": body.to_date, "dates": dates, "days": len(dates), "reason": body.reason.strip(), "leave_type": body.leave_type,
               "status": "pending", "paid": None, "admin_note": "", "decided_by": "", "decided_at": None, "created_at": now_iso(), "updated_at": now_iso()}
        res = await db.leave_requests.insert_one(doc)
        doc["_id"] = res.inserted_id
        await log_activity(emp, "leave_requested", request, entity_type="leave", entity_id=str(res.inserted_id), entity_label=emp.get("name", ""), status="pending",
                           detail=f"{body.from_date} → {body.to_date} · {len(dates)} day(s) · {body.reason[:80]}")
        admins = await db.users.find({"role": "admin", "account_status": {"$ne": "deleted"}}, {"email": 1, "name": 1}).to_list(20)
        targets = {a["email"].lower(): a.get("name", "Admin") for a in admins if a.get("email")}
        targets.setdefault(contact_settings.CONTACT["owner_email"].lower(), "Admin")
        link = f"{origin_of(request)}/rt-control-hb27?next=/admin/attendance"
        for to, name in targets.items():
            background.add_task(send_leave_request_email, to, name, out(doc), link)
        return out(doc)

    @r.delete("/employee/leaves/{lid}")
    async def cancel_leave(lid: str, request: Request, emp: dict = Depends(require_employee)):
        l = await db.leave_requests.find_one({"_id": ObjectId(lid), "employee_id": emp["id"]}) if ObjectId.is_valid(lid) else None
        if not l:
            raise HTTPException(status_code=404, detail="Request not found")
        if l["status"] != "pending":
            raise HTTPException(status_code=400, detail="Only pending requests can be withdrawn")
        await db.leave_requests.update_one({"_id": l["_id"]}, {"$set": {"status": "cancelled", "updated_at": now_iso()}})
        await log_activity(emp, "leave_withdrawn", request, entity_type="leave", entity_id=lid, entity_label=emp.get("name", ""), status="cancelled")
        return {"ok": True}

    # ---------------- Admin ----------------
    @r.get("/admin/leaves")
    async def admin_leaves(status: Optional[str] = None, month: Optional[str] = None, admin: dict = Depends(require_admin)):
        q = {}
        if status:
            q["status"] = status
        if month:
            q["from_date"] = {"$regex": f"^{month}"}
        items = await db.leave_requests.find(q).sort([("status", 1), ("created_at", -1)]).to_list(500)
        items.sort(key=lambda l: (0 if l["status"] == "pending" else 1, l["created_at"]), reverse=False)
        items = sorted(items, key=lambda l: (l["status"] != "pending", -datetime.fromisoformat(l["created_at"]).timestamp()))
        return {"items": [out(l) for l in items], "pending": await db.leave_requests.count_documents({"status": "pending"})}

    @r.patch("/admin/leaves/{lid}")
    async def decide_leave(lid: str, body: DecisionIn, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
        l = await db.leave_requests.find_one({"_id": ObjectId(lid)}) if ObjectId.is_valid(lid) else None
        if not l:
            raise HTTPException(status_code=404, detail="Request not found")
        a = body.action
        upd = {"updated_at": now_iso(), "decided_by": admin.get("name", ""), "decided_at": now_iso()}
        if body.note:
            upd["admin_note"] = body.note.strip()
        if a == "approve":
            if l["status"] not in ("pending", "rejected"):
                raise HTTPException(status_code=400, detail="Only pending requests can be approved")
            if body.paid is None:
                raise HTTPException(status_code=400, detail="Choose Paid or Unpaid leave")
            upd.update({"status": "approved", "paid": bool(body.paid)})
        elif a == "reject":
            if l["status"] == "rejected":
                raise HTTPException(status_code=400, detail="Already rejected")
            upd.update({"status": "rejected", "paid": None})
        elif a in ("set_paid", "set_unpaid"):
            if l["status"] != "approved":
                raise HTTPException(status_code=400, detail="Only approved leave can be switched Paid/Unpaid")
            upd["paid"] = a == "set_paid"
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
        await db.leave_requests.update_one({"_id": l["_id"]}, {"$set": upd})
        new = await db.leave_requests.find_one({"_id": l["_id"]})
        if new["status"] == "approved":
            await remove_from_attendance(new)
            await apply_to_attendance(new, admin)
        else:
            await remove_from_attendance(new)
        label = {"approve": f"Approved · {'Paid' if new.get('paid') else 'Unpaid'}", "reject": "Rejected", "set_paid": "Changed to Paid", "set_unpaid": "Changed to Unpaid"}[a]
        await log_activity(admin, "leave_decided", request, entity_type="leave", entity_id=lid, entity_label=new.get("employee_name", ""), status=new["status"],
                           detail=f"{label} · {new['from_date']} → {new['to_date']} · {new['days']} day(s)" + (f" · {body.note}" if body.note else ""))
        emp = await db.users.find_one({"_id": ObjectId(new["employee_id"])}) if ObjectId.is_valid(new["employee_id"]) else None
        if emp and real_email(emp):
            background.add_task(send_leave_decision_email, real_email(emp), emp.get("name", ""), out(new), label, f"{origin_of(request)}/rt-team-9k4e?next=/employee/attendance")
        return out(new)

    return r
