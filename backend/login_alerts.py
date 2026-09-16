"""Admin login alerts — email the owner when the admin panel is opened from a new device or IP."""
import hashlib
import re
from datetime import datetime, timezone, timedelta
from fastapi import Request

import contact_settings
from email_service import send_login_alert_email

IST = timezone(timedelta(hours=5, minutes=30))


def describe_ua(ua: str) -> tuple[str, str]:
    ua = ua or ""
    os_name = next((n for p, n in (("Windows", "Windows"), ("Android", "Android"), ("iPhone", "iPhone"), ("iPad", "iPad"), ("Mac OS", "Mac"), ("Linux", "Linux")) if p in ua), "Unknown OS")
    browser = "Unknown browser"
    for pat, name in ((r"EdgA?/", "Edge"), (r"OPR/|Opera", "Opera"), (r"SamsungBrowser", "Samsung Internet"), (r"Chrome/", "Chrome"), (r"Firefox/", "Firefox"), (r"Safari/", "Safari")):
        if re.search(pat, ua):
            browser = name
            break
    return browser, os_name


def _fingerprint(ip: str, ua: str) -> str:
    browser, os_name = describe_ua(ua)
    return hashlib.sha256(f"{ip}|{browser}|{os_name}".encode()).hexdigest()[:24]


async def record_admin_login(db, user: dict, request: Request, ip: str, origin: str, log_security) -> None:
    ua = request.headers.get("user-agent", "")[:300]
    browser, os_name = describe_ua(ua)
    fp = _fingerprint(ip, ua)
    now = datetime.now(timezone.utc).isoformat()
    uid = str(user["_id"])
    known = await db.admin_devices.find_one({"user_id": uid, "fingerprint": fp})
    await db.admin_devices.update_one({"user_id": uid, "fingerprint": fp},
                                      {"$set": {"ip": ip, "browser": browser, "os": os_name, "user_agent": ua, "last_seen": now}, "$inc": {"logins": 1},
                                       "$setOnInsert": {"first_seen": now}}, upsert=True)
    if known:
        return
    when = datetime.now(IST).strftime("%d %b %Y, %I:%M %p IST")
    device = f"{browser} on {os_name}"
    await log_security(uid, "admin_login_new_device", request, f"{device} · IP {ip}")
    await db.notifications.insert_one({"user_id": uid, "title": "New device login to Admin Panel", "body": f"{device} · IP {ip} · {when}. Not you? Reset your password now.",
                                       "link": "/admin/security", "type": "security", "read": False, "created_at": now})
    recipients = {(user.get("email") or "").lower(), contact_settings.CONTACT["owner_email"]} - {""}
    for to in recipients:
        await send_login_alert_email(to, user.get("name", ""), when, ip, device, f"{origin}/admin/forgot-password", f"{origin}/admin/security")
