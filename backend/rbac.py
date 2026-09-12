"""Role/permission checks + immutable activity log helpers."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, Request
from auth_utils import get_current_user_from_db

PERMISSION_MODULES = ("leads", "withdrawals", "campaigns", "reports", "clients", "payments")
PERMISSION_LEVELS = ("none", "view", "edit")


def normalize_permissions(perms: Optional[dict]) -> dict:
    perms = perms or {}
    return {m: (perms.get(m) if perms.get(m) in PERMISSION_LEVELS else "none") for m in PERMISSION_MODULES}


def has_perm(user: dict, module: str, level: str = "view") -> bool:
    if user.get("role") == "admin":
        return True
    if user.get("role") != "employee":
        return False
    have = (user.get("permissions") or {}).get(module, "none")
    return have == "edit" or (level == "view" and have == "view")


def make_require_perm(db):
    def require_perm(module: str, level: str = "view"):
        async def dep(request: Request) -> dict:
            user = await get_current_user_from_db(request, db)
            if user.get("role") == "admin":
                return user
            if user.get("role") == "employee":
                if has_perm(user, module, level):
                    return user
                raise HTTPException(status_code=403, detail=f"You don't have {level} permission for {module}")
            raise HTTPException(status_code=403, detail="Admin access required")
        return dep
    return require_perm


def client_ip(request: Optional[Request]) -> str:
    if request is None:
        return ""
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()


def make_log_activity(db):
    async def log_activity(actor: dict, action: str, request: Optional[Request] = None, *, entity_type: str = "", entity_id: str = "",
                           entity_label: str = "", campaign_id: str = "", campaign_name: str = "", client_id: str = "",
                           client_name: str = "", status: str = "", amount: Optional[float] = None, detail: str = ""):
        doc = {
            "actor_id": actor.get("id", ""), "actor_name": actor.get("name", ""), "actor_role": actor.get("role", ""),
            "actor_username": actor.get("username") or actor.get("email", ""),
            "action": action, "entity_type": entity_type, "entity_id": str(entity_id or ""), "entity_label": entity_label,
            "campaign_id": str(campaign_id or ""), "campaign_name": campaign_name, "client_id": str(client_id or ""), "client_name": client_name,
            "status": status, "amount": amount, "detail": (detail or "")[:500], "ip": client_ip(request),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.activity_logs.insert_one(doc)
    return log_activity
