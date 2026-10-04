"""Sim: attendance verification modes (normal / gps / gps_selfie), geofence, selfie storage + cleanup, per-employee override. Restores state."""
import asyncio, base64, io, json, os, sys
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

ENV = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"') + "/api"
EMP = "6aa4f62060cf8b2d2a38c56b"
OFFICE = (23.7117, 76.0157)


def selfie_data_url() -> str:
    from PIL import Image
    im = Image.new("RGB", (64, 64), (200, 120, 90)); b = io.BytesIO(); im.save(b, "JPEG")
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()


async def main():
    db = AsyncIOMotorClient(ENV["MONGO_URL"].strip('"'))[ENV["DB_NAME"].strip('"')]
    today_doc = None
    async with httpx.AsyncClient(timeout=60) as c:
        adm = (await c.post(f"{API}/auth/login", json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})).json()["token"]
        emp = (await c.post(f"{API}/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})).json()
        emp = emp.get("token") or emp.get("access_token")
        A, E = {"Authorization": f"Bearer {adm}"}, {"Authorization": f"Bearer {emp}"}
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
        today_doc = await db.attendance.find_one({"employee_id": EMP, "date": today})
        await db.attendance.delete_many({"employee_id": EMP, "date": today})
        orig = (await c.get(f"{API}/admin/attendance/policy", headers=A)).json()
        print("policy default:", orig["mode"], "office_set", orig["office_set"])
        ok = lambda cond, msg: print(("PASS " if cond else "FAIL ") + msg) or (cond or sys.exit(1))

        r = await c.put(f"{API}/admin/attendance/policy", headers=A, json={"mode": "gps", "radius_m": 100, "selfie_retention_days": 60})
        ok(r.status_code == 400, f"gps without office location rejected: {r.json().get('detail')}")
        r = await c.put(f"{API}/admin/attendance/policy", headers=A, json={"mode": "gps", "office_lat": OFFICE[0], "office_lng": OFFICE[1], "radius_m": 100, "selfie_retention_days": 60, "office_label": "SIM office"})
        ok(r.status_code == 200 and r.json()["mode"] == "gps", "gps mode saved")
        pol = (await c.get(f"{API}/employee/attendance", headers=E)).json()["policy"]
        ok(pol["gps_required"] and not pol["selfie_required_on_checkin"], f"employee sees policy {pol['mode']}")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={})
        ok(r.status_code == 403, f"no GPS → blocked: {r.json().get('detail')}")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={"lat": OFFICE[0] + 0.01, "lng": OFFICE[1], "accuracy": 10})
        ok(r.status_code == 403 and "away" in r.json()["detail"], f"1.1 km away → blocked: {r.json().get('detail')}")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={"lat": OFFICE[0] + 0.0005, "lng": OFFICE[1], "accuracy": 12})
        ok(r.status_code == 200 and r.json()["gps_in"]["distance_m"] < 100, f"55 m inside → check-in OK, distance {r.json().get('gps_in', {}).get('distance_m')} m")
        r = await c.post(f"{API}/employee/attendance/check-out", headers=E, json={"lat": OFFICE[0], "lng": OFFICE[1], "accuracy": 8})
        ok(r.status_code == 200 and r.json()["gps_out"]["distance_m"] < 5, "check-out with GPS OK")
        await db.attendance.delete_many({"employee_id": EMP, "date": today})

        r = await c.put(f"{API}/admin/attendance/policy", headers=A, json={"mode": "gps_selfie", "office_lat": OFFICE[0], "office_lng": OFFICE[1], "radius_m": 100, "selfie_retention_days": 60})
        ok(r.status_code == 200, "gps_selfie mode saved")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={"lat": OFFICE[0], "lng": OFFICE[1], "accuracy": 8})
        ok(r.status_code == 400 and "selfie" in r.json()["detail"].lower(), f"no selfie → blocked: {r.json().get('detail')}")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={"lat": OFFICE[0], "lng": OFFICE[1], "accuracy": 8, "selfie": selfie_data_url()})
        ok(r.status_code == 200 and r.json().get("selfie_url", "").startswith("/api/files/"), f"selfie check-in OK → {r.json().get('selfie_url')}")
        url = r.json()["selfie_url"]
        r = await c.post(f"{API}/employee/attendance/check-out", headers=E, json={"lat": OFFICE[0], "lng": OFFICE[1], "accuracy": 8})
        ok(r.status_code == 400 and "selfie" in r.json()["detail"].lower(), f"check-out without selfie → blocked: {r.json().get('detail')}")
        r = await c.post(f"{API}/employee/attendance/check-out", headers=E, json={"lat": OFFICE[0], "lng": OFFICE[1], "accuracy": 8, "selfie": selfie_data_url()})
        ok(r.status_code == 200 and r.json().get("selfie_out_url", "").startswith("/api/files/"), f"selfie check-out OK → {r.json().get('selfie_out_url')}")
        url_out = r.json()["selfie_out_url"]
        img = await c.get(API.replace("/api", "") + url)
        ok(img.status_code == 200 and img.headers["content-type"].startswith("image/"), f"selfie served ({len(img.content)} bytes)")
        rows = (await c.get(f"{API}/admin/attendance", headers=A, params={"date": today, "employee_id": EMP})).json()["items"]
        ok(rows and rows[0].get("selfie_url") == url and rows[0].get("selfie_out_url") == url_out and "selfie in" in rows[0]["gps_label"] and "selfie out" in rows[0]["gps_label"], f"admin row gps_label: {rows[0]['gps_label']}")

        # retention: backdate record to 61 days ago and run cleanup
        await db.attendance.update_one({"employee_id": EMP, "date": today}, {"$set": {"date": "2026-07-01"}})
        sec = ENV["WEBHOOK_CRON_SECRET"].strip('"')
        r = await c.post(f"{API}/cron/selfie-cleanup", headers={"Authorization": f"Bearer {sec}", "X-Webhook-Id": "sim-selfie-1"})
        ok(r.status_code == 202, "cleanup cron accepted")
        await asyncio.sleep(3)
        rec = await db.attendance.find_one({"employee_id": EMP, "date": "2026-07-01"})
        ok(rec and rec.get("selfie_url") is None and rec.get("selfie_out_url") is None and rec.get("selfie_expired"), "both selfies removed after retention, record kept")
        img = await c.get(API.replace("/api", "") + url)
        img2 = await c.get(API.replace("/api", "") + url_out)
        ok(img.status_code == 404 and img2.status_code == 404, "expired selfies no longer served")
        await db.attendance.delete_many({"employee_id": EMP, "date": "2026-07-01"})
        await db.cron_runs.delete_many({"run_id": "sim-selfie-1"})

        # per-employee override → normal: check-in without GPS works even in gps_selfie mode
        r = await c.put(f"{API}/admin/attendance/policy/employee/{EMP}", headers=A, json={"mode": "normal"})
        ok(r.status_code == 200 and [e for e in r.json()["employees"] if e["id"] == EMP][0]["effective_mode"] == "normal", "employee override → normal")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E, json={})
        ok(r.status_code == 200 and r.json().get("verify_mode") == "normal", "override employee checks in without GPS")
        await db.attendance.delete_many({"employee_id": EMP, "date": today})
        await c.put(f"{API}/admin/attendance/policy/employee/{EMP}", headers=A, json={"mode": None})

        # restore
        r = await c.put(f"{API}/admin/attendance/policy", headers=A, json={"mode": orig["mode"], "office_lat": orig["office_lat"], "office_lng": orig["office_lng"], "radius_m": orig["radius_m"], "selfie_retention_days": orig["selfie_retention_days"], "office_label": orig["office_label"]})
        ok(r.status_code == 200 and r.json()["mode"] == "normal", "policy restored to normal")
        r = await c.post(f"{API}/employee/attendance/check-in", headers=E)  # legacy call: no body at all
        ok(r.status_code == 200, "normal mode: check-in with no body still works (regression)")
        await db.attendance.delete_many({"employee_id": EMP, "date": today})
    if today_doc:
        await db.attendance.insert_one(today_doc)
    await db.files.delete_many({"kind": "attendance_selfie"})
    print("ALL PASS")

asyncio.run(main())
