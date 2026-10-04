"""Harness: attendance nudges (in-app + email cron) on a frozen Monday. Uses real DB, patched clock."""
import asyncio, os, sys
from datetime import datetime, timezone, timedelta
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient
import attendance_routes as ar
from fastapi import BackgroundTasks

EMP = "6aa4f62060cf8b2d2a38c56b"
MON = "2026-10-05"
IST = timezone(timedelta(hours=5, minutes=30))
sent_mails = []


def freeze(hh, mm):
    t = datetime(2026, 10, 5, hh, mm, tzinfo=IST).astimezone(timezone.utc)
    ar.now_utc = lambda: t
    ar.ist_today = lambda: MON


class FakeReq:
    headers = {"authorization": f"Bearer {os.environ['WEBHOOK_CRON_SECRET']}", "x-webhook-id": ""}
    base_url = "https://x.test/"
    async def body(self): return b""
    async def json(self): return {}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    async def fake_send_in(to, name, code, d, link): sent_mails.append(("checkin", to)); return "mid-in"
    async def fake_send_out(to, name, d, ci, link): sent_mails.append(("checkout", to)); return "mid-out"
    ar.send_attendance_reminder_email, ar.send_checkout_reminder_email = fake_send_in, fake_send_out
    async def noop(*a, **k): return None
    r = ar.build_router(db, lambda: None, lambda: None, noop)
    ep = {route.path: route.endpoint for route in r.routes}
    emp = {"id": EMP, "name": "Rahul Kumar", "role": "employee"}
    ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or (c or sys.exit(1))
    await db.attendance.delete_many({"employee_id": EMP, "date": MON}); await db.attendance_reminders.delete_many({"date": MON}); await db.cron_runs.delete_many({"run_id": {"$regex": "^hz-"}})

    async def cron(rid):
        FakeReq.headers["x-webhook-id"] = rid
        bg = BackgroundTasks(); res = await ep["/cron/attendance-nudges"](FakeReq(), bg)
        for t in bg.tasks: await t()
        return res

    freeze(9, 30)
    d = await ep["/employee/attendance"](None, emp)
    ok(d["nudge"] is None, "9:30 before office start → no nudge")
    await cron("hz-1"); ok(sent_mails == [], "9:30 cron → no email")

    freeze(10, 25)
    d = await ep["/employee/attendance"](None, emp)
    ok(d["nudge"] and d["nudge"]["type"] == "checkin" and "25 min late" in d["nudge"]["message"], "10:25 no check-in → in-app nudge")
    await cron("hz-2"); ok(sent_mails == [("checkin", "bhatiharish276+rahul@gmail.com")], "10:25 cron → check-in email sent")
    await cron("hz-3"); ok(len(sent_mails) == 1, "10:40 cron again → no duplicate check-in email")

    await db.attendance.insert_one(ar.derive({"employee_id": EMP, "date": MON, "check_in": datetime(2026, 10, 5, 10, 30, tzinfo=IST).astimezone(timezone.utc).isoformat(), "check_out": None, "source": "self", "note": ""}))
    freeze(14, 0)
    d = await ep["/employee/attendance"](None, emp)
    ok(d["nudge"] is None, "2 PM checked in, office running → no nudge")
    await cron("hz-4"); ok(len(sent_mails) == 1, "2 PM cron → nothing")

    freeze(17, 15)
    d = await ep["/employee/attendance"](None, emp)
    ok(d["nudge"] and d["nudge"]["type"] == "checkout", f"5:15 PM not checked out → in-app nudge: {d['nudge']['title']}")
    await cron("hz-5"); ok(sent_mails[-1] == ("checkout", "bhatiharish276+rahul@gmail.com"), "5:15 PM cron → check-out email sent")
    await cron("hz-6"); ok(len(sent_mails) == 2, "5:30 PM cron again → no duplicate check-out email")

    await db.attendance.update_one({"employee_id": EMP, "date": MON}, {"$set": {"check_out": datetime(2026, 10, 5, 17, 40, tzinfo=IST).astimezone(timezone.utc).isoformat()}})
    freeze(17, 45)
    d = await ep["/employee/attendance"](None, emp)
    ok(d["nudge"] is None, "after check-out → no nudge")

    await db.attendance.delete_many({"employee_id": EMP, "date": MON}); await db.attendance_reminders.delete_many({"date": MON}); await db.cron_runs.delete_many({"run_id": {"$regex": "^hz-"}})
    print("ALL PASS (cleaned)")

asyncio.run(main())
