"""Sim: admin forgot-password → 5-min OTP → wrong attempts lock → reset → old JWT revoked → new login works. Uses a temp admin user."""
import asyncio, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
import httpx  # noqa: E402
import server  # noqa: E402
import password_reset  # noqa: E402
import email_service  # noqa: E402
from auth_utils import hash_password  # noqa: E402

API = "http://localhost:8001/api"
CAPTURED = {}


async def fake_send_otp(to, name, code, purpose):
    CAPTURED["code"] = code
    return "fake-id"


async def main():
    db = server.db
    ts = str(int(time.time()))
    email = f"simadmin{ts}@gmail.com"
    uid = (await db.users.insert_one({"name": "Sim Admin", "email": email, "role": "admin", "password_hash": hash_password("OldPass@123"),
                                      "email_verified": True, "created_at": server.now_iso(), "account_status": "active"})).inserted_id
    # in-process patch works only for the in-process app; the running uvicorn is a separate process → we call functions directly through TestClient-like httpx ASGI
    password_reset.send_otp_email = fake_send_otp
    email_service.send_password_changed_email = lambda *a, **k: asyncio.sleep(0)
    password_reset.send_password_changed_email = lambda *a, **k: asyncio.sleep(0)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://t") as c:
        old = (await c.post("/api/auth/login", json={"email": email, "password": "OldPass@123", "portal": "admin"})).json()["token"]
        print("old token /me:", (await c.get("/api/auth/me", headers={"Authorization": f"Bearer {old}"})).status_code)
        # customer portal must not reveal/serve admin
        r = await c.post("/api/auth/forgot-password", json={"email": email, "portal": "customer"})
        print("customer-portal forgot for admin email → generic:", r.json()["message"], "| captured:", "code" in CAPTURED)
        r = await c.post("/api/auth/forgot-password", json={"email": email, "portal": "admin"})
        print("admin forgot:", r.status_code, r.json()["message"], "expires_in", r.json()["expires_in"])
        rec = await db.pwd_reset_otps.find_one({"email": email})
        ttl = (server.datetime.fromisoformat(rec["expires_at"]) - server.datetime.fromisoformat(rec["created_at"])).total_seconds()
        print("OTP hashed at rest:", "code" not in rec and len(rec["code_hash"]) == 64, "| TTL sec:", ttl)
        r = await c.post("/api/auth/forgot-password", json={"email": email, "portal": "admin"})
        print("resend within 60s →", r.status_code, r.json()["detail"][:60])
        good = CAPTURED["code"]
        for i in range(4):
            r = await c.post("/api/auth/reset-password", json={"email": email, "code": "000000", "new_password": "NewPass@123", "portal": "admin"})
            print(f"wrong #{i+1}:", r.status_code, r.json()["detail"])
        r = await c.post("/api/auth/reset-password", json={"email": email, "code": "000000", "new_password": "NewPass@123", "portal": "admin"})
        print("wrong #5:", r.status_code, r.json()["detail"])
        r = await c.post("/api/auth/reset-password", json={"email": email, "code": good, "new_password": "NewPass@123", "portal": "admin"})
        print("correct OTP while locked:", r.status_code, r.json()["detail"][:50])
        r = await c.post("/api/auth/forgot-password", json={"email": email, "portal": "admin"})
        print("request OTP while locked:", r.status_code)
        # unlock manually (simulate 15 min passing) and do a clean reset
        await db.otp_locks.delete_many({"identifier": f"reset:{email}"})
        r = await c.post("/api/auth/forgot-password", json={"email": email, "portal": "admin"})
        good = CAPTURED["code"]
        r = await c.post("/api/auth/reset-password", json={"email": email, "code": good, "new_password": "short", "portal": "admin"})
        print("weak password:", r.status_code, r.json()["detail"])
        r = await c.post("/api/auth/reset-password", json={"email": email, "code": good, "new_password": "NewPass@123", "portal": "admin"})
        print("reset:", r.status_code, r.json()["message"][:60])
        r = await c.post("/api/auth/reset-password", json={"email": email, "code": good, "new_password": "NewPass@123", "portal": "admin"})
        print("reuse same OTP:", r.status_code)
        r = await c.get("/api/auth/me", headers={"Authorization": f"Bearer {old}"})
        print("OLD token after reset →", r.status_code, r.json()["detail"][:60])
        print("old password login:", (await c.post("/api/auth/login", json={"email": email, "password": "OldPass@123", "portal": "admin"})).status_code)
        new = (await c.post("/api/auth/login", json={"email": email, "password": "NewPass@123", "portal": "admin"})).json()["token"]
        print("new password login + /me:", (await c.get("/api/auth/me", headers={"Authorization": f"Bearer {new}"})).status_code)
        # in-panel reset
        r = await c.post("/api/security/reset-password/otp", headers={"Authorization": f"Bearer {new}"})
        print("in-panel send:", r.status_code, r.json()["message"][:40])
        r = await c.post("/api/security/reset-password", json={"code": CAPTURED["code"], "new_password": "Third@12345"}, headers={"Authorization": f"Bearer {new}"})
        print("in-panel reset:", r.status_code, "| new token issued:", "token" in r.json())
        print("prev token revoked:", (await c.get("/api/auth/me", headers={"Authorization": f"Bearer {new}"})).status_code,
              "| fresh token ok:", (await c.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})).status_code)
        # expiry: backdate OTP
        await c.post("/api/security/reset-password/otp", headers={"Authorization": f"Bearer {r.json()['token']}"})
        await db.pwd_reset_otps.update_many({"email": email}, {"$set": {"expires_at": "2000-01-01T00:00:00+00:00"}})
        r2 = await c.post("/api/security/reset-password", json={"code": CAPTURED["code"], "new_password": "Fourth@12345"}, headers={"Authorization": f"Bearer {r.json()['token']}"})
        print("expired OTP:", r2.status_code, r2.json()["detail"][:40])
        logs = [x["event"] for x in await db.security_logs.find({"user_id": str(uid)}).to_list(50)]
        print("security events:", sorted(set(logs)))
    for coll in ("pwd_reset_otps", "otp_locks"):
        await db[coll].delete_many({"email": email})
    await db.otp_locks.delete_many({"identifier": f"reset:{email}"})
    await db.security_logs.delete_many({"user_id": str(uid)})
    await db.users.delete_one({"_id": uid})
    print("cleaned")

asyncio.run(main())
