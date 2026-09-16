"""Employee management, employee login and activity log routes (super admin)."""
import re
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from bson import ObjectId

from auth_utils import hash_password, verify_password, create_access_token, get_current_user_from_db
from rbac import PERMISSION_MODULES, normalize_permissions

USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")
MAX_ATTEMPTS, LOCK_MINUTES = 5, 30
IST = timezone(timedelta(hours=5, minutes=30))


class EmployeeLoginIn(BaseModel):
    username: str
    password: str


class EmployeeIn(BaseModel):
    name: str
    username: str
    password: str
    mobile: Optional[str] = ""
    permissions: dict = {}


class EmployeeUpdateIn(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    permissions: Optional[dict] = None
    status: Optional[str] = None
    password: Optional[str] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def employee_out(u: dict) -> dict:
    return {"id": str(u["_id"]), "name": u.get("name"), "username": u.get("username"), "mobile": u.get("mobile", ""),
            "employee_code": u.get("employee_code", ""), "permissions": normalize_permissions(u.get("permissions")),
            "account_status": u.get("account_status", "active"), "created_at": u.get("created_at"), "last_login_at": u.get("last_login_at"),
            "created_by": u.get("created_by", "")}


def build_router(db, require_admin, log_activity, public_user) -> APIRouter:
    r = APIRouter()

    async def require_employee(request: Request) -> dict:
        user = await get_current_user_from_db(request, db)
        if user.get("role") != "employee":
            raise HTTPException(status_code=403, detail="Employee access required")
        return user

    @r.post("/auth/employee/login")
    async def employee_login(body: EmployeeLoginIn, request: Request):
        username = body.username.strip().lower()
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()
        identifier = f"{ip}:emp:{username}"
        now = _now()
        rec, user = await asyncio.gather(db.login_attempts.find_one({"identifier": identifier}),
                                         db.users.find_one({"username": username, "role": "employee"}))
        if rec and rec.get("count", 0) >= MAX_ATTEMPTS and (rec.get("locked_until") or "") > now:
            raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again after {LOCK_MINUTES} minutes.")
        if rec and (rec.get("locked_until") or "") and rec["locked_until"] <= now:
            await db.login_attempts.delete_one({"_id": rec["_id"]})
            rec = None
        ok = bool(user) and await asyncio.to_thread(verify_password, body.password, user.get("password_hash", ""))
        if not ok:
            count = (rec.get("count", 0) if rec else 0) + 1
            upd = {"$set": {"identifier": identifier, "email": username, "count": count, "updated_at": now}}
            if count >= MAX_ATTEMPTS:
                upd["$set"]["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()
            await db.login_attempts.update_one({"identifier": identifier}, upd, upsert=True)
            if user:
                await log_activity({"id": str(user["_id"]), "name": user.get("name"), "role": "employee", "username": username},
                                   "employee_login_failed", request, entity_type="employee", entity_id=str(user["_id"]), status="failed",
                                   detail=f"attempt {count}")
            if count >= MAX_ATTEMPTS:
                raise HTTPException(status_code=429, detail=f"Too many failed attempts. Locked for {LOCK_MINUTES} minutes.")
            raise HTTPException(status_code=401, detail=f"Invalid username or password. {MAX_ATTEMPTS - count} attempt(s) left.")
        if rec:
            await db.login_attempts.delete_one({"identifier": identifier})
        st = user.get("account_status", "active")
        if st == "deleted":
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        if st != "active":
            raise HTTPException(status_code=403, detail="Your employee account is disabled. Contact the Super Admin.")
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now, "last_login_ip": ip}})
        token = create_access_token(str(user["_id"]), user["email"], "employee", user.get("token_version", 0))
        pu = public_user(user)
        await log_activity({"id": pu["id"], "name": pu["name"], "role": "employee", "username": username}, "employee_login", request,
                           entity_type="employee", entity_id=pu["id"], status="success")
        return {"token": token, "user": pu}

    @r.post("/employee/change-password")
    async def employee_change_password(body: ChangePasswordIn, request: Request, emp: dict = Depends(require_employee)):
        full = await db.users.find_one({"_id": ObjectId(emp["id"])})
        if not verify_password(body.current_password, full.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        if len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        await db.users.update_one({"_id": full["_id"]}, {"$set": {"password_hash": hash_password(body.new_password), "password_changed_at": _now()}})
        await log_activity(emp, "employee_password_changed", request, entity_type="employee", entity_id=emp["id"], status="success")
        return {"message": "Password changed"}

    @r.get("/employee/my-activity")
    async def my_activity(emp: dict = Depends(require_employee)):
        items = await db.activity_logs.find({"actor_id": emp["id"]}).sort("created_at", -1).to_list(50)
        return [{**{k: v for k, v in i.items() if k != "_id"}, "id": str(i["_id"])} for i in items]

    # ---------------- Super admin: employees ----------------
    @r.get("/admin/employees")
    async def list_employees(admin: dict = Depends(require_admin)):
        items = await db.users.find({"role": "employee", "account_status": {"$ne": "deleted"}}).sort("created_at", -1).to_list(500)
        counts = await db.activity_logs.aggregate([{"$match": {"actor_role": "employee"}}, {"$group": {"_id": "$actor_id", "n": {"$sum": 1}}}]).to_list(1000)
        cmap = {c["_id"]: c["n"] for c in counts}
        return [{**employee_out(u), "activity_count": cmap.get(str(u["_id"]), 0)} for u in items]

    @r.post("/admin/employees")
    async def create_employee(body: EmployeeIn, request: Request, admin: dict = Depends(require_admin)):
        username = body.username.strip().lower()
        if not USERNAME_RE.match(username):
            raise HTTPException(status_code=400, detail="Username: 3-30 chars, lowercase letters, numbers, dot or underscore only")
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="Name is required")
        if await db.users.find_one({"username": username}):
            raise HTTPException(status_code=400, detail="Username already taken")
        email = f"{username}@employee.radhikatraders.net"
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="Username already taken")
        doc = {"name": body.name.strip()[:80], "username": username, "email": email, "mobile": (body.mobile or "").strip()[:15],
               "password_hash": await asyncio.to_thread(hash_password, body.password), "role": "employee",
               "employee_code": "EMP-" + secrets.token_hex(2).upper(), "permissions": normalize_permissions(body.permissions),
               "account_status": "active", "email_verified": True, "kyc": {"status": "not_applicable"}, "bank": {},
               "created_by": admin.get("email"), "created_at": _now()}
        res = await db.users.insert_one(doc)
        u = await db.users.find_one({"_id": res.inserted_id})
        await log_activity(admin, "employee_created", request, entity_type="employee", entity_id=str(u["_id"]), entity_label=username,
                           status="active", detail=", ".join(f"{m}={v}" for m, v in doc["permissions"].items() if v != "none"))
        return employee_out(u)

    @r.patch("/admin/employees/{eid}")
    async def update_employee(eid: str, body: EmployeeUpdateIn, request: Request, admin: dict = Depends(require_admin)):
        u = await db.users.find_one({"_id": ObjectId(eid), "role": "employee"}) if ObjectId.is_valid(eid) else None
        if not u or u.get("account_status") == "deleted":
            raise HTTPException(status_code=404, detail="Employee not found")
        upd, actions = {}, []
        if body.name is not None and body.name.strip():
            upd["name"] = body.name.strip()[:80]
            actions.append("employee_updated")
        if body.mobile is not None:
            upd["mobile"] = body.mobile.strip()[:15]
        if body.permissions is not None:
            upd["permissions"] = normalize_permissions(body.permissions)
            actions.append("employee_permissions_changed")
        if body.status is not None:
            if body.status not in ("active", "disabled"):
                raise HTTPException(status_code=400, detail="Status must be active or disabled")
            upd["account_status"] = body.status
            actions.append("employee_enabled" if body.status == "active" else "employee_disabled")
        if body.password:
            if len(body.password) < 6:
                raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
            upd["password_hash"] = await asyncio.to_thread(hash_password, body.password)
            upd["password_changed_at"] = _now()
            actions.append("employee_password_reset")
        if not upd:
            raise HTTPException(status_code=400, detail="Nothing to update")
        upd["updated_at"] = _now()
        await db.users.update_one({"_id": u["_id"]}, {"$set": upd})
        u = await db.users.find_one({"_id": u["_id"]})
        for a in (actions or ["employee_updated"]):
            await log_activity(admin, a, request, entity_type="employee", entity_id=eid, entity_label=u.get("username"),
                               status=u.get("account_status"), detail=", ".join(f"{m}={v}" for m, v in upd.get("permissions", {}).items() if v != "none") if a == "employee_permissions_changed" else "")
        return employee_out(u)

    @r.delete("/admin/employees/{eid}")
    async def delete_employee(eid: str, request: Request, admin: dict = Depends(require_admin)):
        u = await db.users.find_one({"_id": ObjectId(eid), "role": "employee"}) if ObjectId.is_valid(eid) else None
        if not u or u.get("account_status") == "deleted":
            raise HTTPException(status_code=404, detail="Employee not found")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"account_status": "deleted", "deleted_at": _now(), "deleted_by": admin.get("email"),
                                                             "username": f"{u['username']}__deleted_{stamp}", "email": f"{u['username']}__deleted_{stamp}@employee.radhikatraders.net",
                                                             "original_username": u["username"]}})
        await log_activity(admin, "employee_deleted", request, entity_type="employee", entity_id=eid, entity_label=u.get("username"), status="deleted")
        return {"message": f"Employee {u.get('name')} deleted"}

    # ---------------- Super admin: activity logs (read-only) ----------------
    @r.get("/admin/activity-logs")
    async def activity_logs(employee_id: Optional[str] = None, action: Optional[str] = None, campaign_id: Optional[str] = None,
                            entity: Optional[str] = None, status: Optional[str] = None, date_from: Optional[str] = None,
                            date_to: Optional[str] = None, role: Optional[str] = None, limit: int = 200, admin: dict = Depends(require_admin)):
        q: dict = {}
        if employee_id:
            q["actor_id"] = employee_id
        if role in ("admin", "employee"):
            q["actor_role"] = role
        if action:
            q["action"] = action
        if campaign_id:
            q["campaign_id"] = campaign_id
        if status:
            q["status"] = status
        if entity:
            rx = {"$regex": re.escape(entity.strip()), "$options": "i"}
            q["$or"] = [{"entity_id": rx}, {"entity_label": rx}, {"client_id": rx}, {"client_name": rx}, {"detail": rx}]
        if date_from or date_to:
            rng = {}
            if date_from:
                rng["$gte"] = datetime.fromisoformat(date_from).replace(tzinfo=IST).astimezone(timezone.utc).isoformat()
            if date_to:
                rng["$lt"] = (datetime.fromisoformat(date_to).replace(tzinfo=IST) + timedelta(days=1)).astimezone(timezone.utc).isoformat()
            q["created_at"] = rng
        items = await db.activity_logs.find(q).sort("created_at", -1).to_list(min(max(limit, 1), 1000))
        total = await db.activity_logs.count_documents(q)
        return {"total": total, "items": [{**{k: v for k, v in i.items() if k != "_id"}, "id": str(i["_id"])} for i in items]}

    @r.get("/admin/activity-logs/meta")
    async def activity_meta(admin: dict = Depends(require_admin)):
        actions = await db.activity_logs.distinct("action")
        statuses = [s for s in await db.activity_logs.distinct("status") if s]
        emps = await db.users.find({"role": "employee"}, {"name": 1, "username": 1, "account_status": 1}).to_list(500)
        admins = await db.users.find({"role": "admin"}, {"name": 1, "email": 1}).to_list(20)
        camps = await db.campaigns.find({}, {"offer_name": 1}).sort("created_at", -1).to_list(500)
        return {"actions": sorted(actions), "statuses": sorted(statuses),
                "actors": [{"id": str(a["_id"]), "name": a.get("name"), "username": a.get("email"), "role": "admin"} for a in admins]
                + [{"id": str(e["_id"]), "name": e.get("name"), "username": e.get("original_username") or e.get("username"), "role": "employee",
                    "status": e.get("account_status", "active")} for e in emps],
                "campaigns": [{"id": str(c["_id"]), "name": c.get("offer_name")} for c in camps], "modules": list(PERMISSION_MODULES)}

    return r
