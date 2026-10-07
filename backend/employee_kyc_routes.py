"""Employee KYC: employee submits identity + bank details (strictly validated); admin views/edits/verifies/rejects/enables/deletes."""
import re
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from bson import ObjectId

from email_service import send_employee_kyc_email
import push_service

FIELDS = ("full_name", "employee_code", "mobile", "father_name", "email", "dob", "address", "aadhaar", "pan", "ifsc", "bank_account", "bank_name", "branch")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EmployeeKycIn(BaseModel):
    mobile: str
    father_name: str
    email: str
    dob: str
    address: str
    aadhaar: str
    pan: str
    ifsc: str
    bank_account: str
    bank_account_confirm: str


class RejectIn(BaseModel):
    reason: str


class EnableIn(BaseModel):
    enabled: bool


def build_router(db, require_admin, require_employee, log_activity, pan_error, aadhaar_error, lookup_ifsc_info) -> APIRouter:
    r = APIRouter()

    def out(k: dict) -> dict:
        d = {x: v for x, v in k.items() if x != "_id"}
        d["id"] = str(k["_id"])
        d["aadhaar_masked"] = f"XXXX XXXX {k['aadhaar'][-4:]}" if k.get("aadhaar") else ""
        d["account_masked"] = f"••••{k['bank_account'][-4:]}" if k.get("bank_account") else ""
        return d

    def employee_view(k: dict) -> dict:
        d = out(k)
        d.pop("history", None)
        return d

    async def validate(body: EmployeeKycIn) -> dict:
        mobile = re.sub(r"\D", "", body.mobile or "")
        if not re.fullmatch(r"[6-9]\d{9}", mobile):
            raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number")
        if not body.father_name.strip():
            raise HTTPException(status_code=400, detail="Father's name is required")
        email = (body.email or "").strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", email):
            raise HTTPException(status_code=400, detail="Enter a valid Gmail / email ID")
        try:
            d = date.fromisoformat(body.dob)
        except ValueError:
            raise HTTPException(status_code=400, detail="Enter a valid date of birth")
        today = datetime.now(timezone.utc).date()
        age = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
        if age < 18 or age > 80:
            raise HTTPException(status_code=400, detail="Employee must be between 18 and 80 years old")
        if len(body.address.strip()) < 10:
            raise HTTPException(status_code=400, detail="Enter the full address (at least 10 characters)")
        aadhaar = re.sub(r"\s", "", body.aadhaar or "")
        if aadhaar_error(aadhaar):
            raise HTTPException(status_code=400, detail=aadhaar_error(aadhaar))
        pan = body.pan.strip().upper()
        if pan_error(pan):
            raise HTTPException(status_code=400, detail=pan_error(pan))
        ifsc = body.ifsc.strip().upper()
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc):
            raise HTTPException(status_code=400, detail="Invalid IFSC code (e.g. HDFC0001234)")
        info = await lookup_ifsc_info(ifsc)
        if not info.get("available") and info.get("reason") in ("invalid_format", "not_found"):
            raise HTTPException(status_code=400, detail=f"IFSC {ifsc} is not a valid bank branch code. Check your passbook / cheque.")
        acct = re.sub(r"\s", "", body.bank_account or "")
        if not re.fullmatch(r"\d{9,18}", acct):
            raise HTTPException(status_code=400, detail="Bank account number must be 9–18 digits")
        if re.sub(r"\s", "", body.bank_account_confirm or "") != acct:
            raise HTTPException(status_code=400, detail="Account numbers do not match. Please re-enter.")
        return {"mobile": mobile, "father_name": body.father_name.strip()[:80], "email": email, "dob": body.dob, "address": body.address.strip()[:300],
                "aadhaar": aadhaar, "pan": pan, "ifsc": ifsc, "bank_account": acct, "bank_name": info.get("bank") or "", "branch": info.get("branch") or ""}

    async def user_of(emp_id: str) -> dict:
        u = await db.users.find_one({"_id": ObjectId(emp_id)}) if ObjectId.is_valid(emp_id) else None
        if not u or u.get("role") != "employee":
            raise HTTPException(status_code=404, detail="Employee not found")
        return u

    def prefill(u: dict) -> dict:
        return {"full_name": u.get("name", ""), "employee_code": u.get("employee_code", ""), "mobile": u.get("mobile", ""), "email": u.get("email", "") if "@employee.radhikatraders.net" not in (u.get("email") or "") else ""}

    # ---------------- Employee ----------------
    @r.get("/employee/kyc")
    async def my_kyc(emp: dict = Depends(require_employee)):
        u = await user_of(emp["id"])
        k = await db.employee_kyc.find_one({"employee_id": emp["id"]})
        return {"prefill": prefill(u), "kyc": employee_view(k) if k else None}

    @r.post("/employee/kyc")
    async def submit_kyc(body: EmployeeKycIn, request: Request, emp: dict = Depends(require_employee)):
        u = await user_of(emp["id"])
        old = await db.employee_kyc.find_one({"employee_id": emp["id"]})
        if old and old.get("status") == "verified":
            raise HTTPException(status_code=400, detail="Your KYC is already verified. Contact the admin to change any detail.")
        if old and old.get("enabled") is False:
            raise HTTPException(status_code=403, detail="KYC submission is disabled for your account. Contact the admin.")
        vals = await validate(body)
        ts = now_iso()
        doc = {**vals, "full_name": u.get("name", ""), "employee_code": u.get("employee_code", ""), "employee_id": emp["id"], "status": "pending", "enabled": True,
               "submitted_at": ts, "updated_at": ts, "rejection_reason": "", "verified_at": None, "verified_by": "",
               "history": ((old or {}).get("history") or []) + [{"action": "resubmitted" if old else "submitted", "by": u.get("name", ""), "at": ts, "note": ""}]}
        await db.employee_kyc.update_one({"employee_id": emp["id"]}, {"$set": doc}, upsert=True)
        await log_activity(emp, "employee_kyc_submitted", request, entity_type="employee_kyc", entity_id=emp["id"], entity_label=u.get("name", ""), status="pending", detail=f"PAN {vals['pan']} · {vals['bank_name']}")
        await push_service.notify_many([{"user_id": aid, "title": f"Employee KYC {'re-' if old else ''}submitted: {u.get('name', '')}", "body": f"PAN {vals['pan']} · {vals['bank_name']} · awaiting verification",
                                         "link": "/admin/employee-kyc", "type": "kyc", "read": False, "created_at": ts} for aid in await push_service.admin_ids()])
        return employee_view(await db.employee_kyc.find_one({"employee_id": emp["id"]}))

    # ---------------- Admin ----------------
    @r.get("/admin/employee-kyc")
    async def list_kyc(status: Optional[str] = None, admin: dict = Depends(require_admin)):
        q = {"status": status} if status in ("pending", "verified", "rejected") else {}
        items = await db.employee_kyc.find(q).sort("updated_at", -1).to_list(500)
        counts = {c["_id"]: c["n"] async for c in db.employee_kyc.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])}
        emps = await db.users.find({"role": "employee", "account_status": {"$ne": "deleted"}}, {"name": 1, "employee_code": 1}).to_list(500)
        done = {k["employee_id"] for k in items} if not q else {k["employee_id"] for k in await db.employee_kyc.find({}, {"employee_id": 1}).to_list(500)}
        return {"items": [out(k) for k in items], "counts": counts, "not_submitted": [{"id": str(e["_id"]), "name": e.get("name"), "employee_code": e.get("employee_code", "")} for e in emps if str(e["_id"]) not in done]}

    @r.get("/admin/employee-kyc/{employee_id}")
    async def get_kyc(employee_id: str, admin: dict = Depends(require_admin)):
        k = await db.employee_kyc.find_one({"employee_id": employee_id})
        if not k:
            raise HTTPException(status_code=404, detail="KYC not found")
        return out(k)

    async def _update(employee_id: str, upd: dict, action: str, admin: dict, request: Request, note: str = "", log_action: str = "") -> dict:
        k = await db.employee_kyc.find_one({"employee_id": employee_id})
        if not k:
            raise HTTPException(status_code=404, detail="KYC not found")
        ts = now_iso()
        await db.employee_kyc.update_one({"_id": k["_id"]}, {"$set": {**upd, "updated_at": ts}, "$push": {"history": {"action": action, "by": admin.get("name", ""), "at": ts, "note": note[:300]}}})
        await log_activity(admin, log_action or f"employee_kyc_{action}", request, entity_type="employee_kyc", entity_id=employee_id, entity_label=k.get("full_name", ""), status=upd.get("status", k.get("status")), detail=note[:200])
        return await db.employee_kyc.find_one({"_id": k["_id"]})

    def portal_link(request: Request) -> str:
        return (request.headers.get("origin") or str(request.base_url).rstrip("/")).replace("http://", "https://") + "/employee/kyc"

    @r.put("/admin/employee-kyc/{employee_id}")
    async def edit_kyc(employee_id: str, body: EmployeeKycIn, request: Request, admin: dict = Depends(require_admin)):
        vals = await validate(body)
        k = await _update(employee_id, vals, "edited", admin, request, "Details edited by admin")
        return out(k)

    @r.put("/admin/employee-kyc/{employee_id}/verify")
    async def verify_kyc(employee_id: str, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
        k = await _update(employee_id, {"status": "verified", "verified_at": now_iso(), "verified_by": admin.get("name", ""), "rejection_reason": ""}, "verified", admin, request)
        if k.get("email"):
            background.add_task(send_employee_kyc_email, k["email"], k.get("full_name", ""), "verified", "", portal_link(request))
        await push_service.notify_one({"user_id": employee_id, "title": "KYC Verified ✓", "body": "Your employee KYC has been verified by the admin.",
                                       "link": "/employee/kyc", "type": "kyc", "read": False, "created_at": now_iso()})
        return out(k)

    @r.put("/admin/employee-kyc/{employee_id}/reject")
    async def reject_kyc(employee_id: str, body: RejectIn, request: Request, background: BackgroundTasks, admin: dict = Depends(require_admin)):
        if not body.reason.strip():
            raise HTTPException(status_code=400, detail="Please give a reason for rejection")
        k = await _update(employee_id, {"status": "rejected", "rejection_reason": body.reason.strip()[:300], "verified_at": None, "verified_by": ""}, "rejected", admin, request, body.reason.strip())
        if k.get("email"):
            background.add_task(send_employee_kyc_email, k["email"], k.get("full_name", ""), "rejected", k["rejection_reason"], portal_link(request))
        await push_service.notify_one({"user_id": employee_id, "title": "KYC Rejected — action needed", "body": f"Reason: {k['rejection_reason']}. Please correct and resubmit.",
                                       "link": "/employee/kyc", "type": "kyc", "read": False, "created_at": now_iso()})
        return out(k)

    @r.put("/admin/employee-kyc/{employee_id}/enable")
    async def enable_kyc(employee_id: str, body: EnableIn, request: Request, admin: dict = Depends(require_admin)):
        k = await _update(employee_id, {"enabled": body.enabled}, "enabled" if body.enabled else "disabled", admin, request)
        return out(k)

    @r.delete("/admin/employee-kyc/{employee_id}")
    async def delete_kyc(employee_id: str, request: Request, admin: dict = Depends(require_admin)):
        k = await db.employee_kyc.find_one({"employee_id": employee_id})
        if not k:
            raise HTTPException(status_code=404, detail="KYC not found")
        await db.employee_kyc_deleted.insert_one({**k, "deleted_at": now_iso(), "deleted_by": admin.get("name", "")})  # keep an archived copy
        await db.employee_kyc.delete_one({"_id": k["_id"]})
        await log_activity(admin, "employee_kyc_deleted", request, entity_type="employee_kyc", entity_id=employee_id, entity_label=k.get("full_name", ""), detail=f"PAN {k.get('pan', '')}")
        return {"ok": True}

    return r
