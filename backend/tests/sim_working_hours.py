"""Verify dynamic working-hours rules from the spec (pure derive() + paid_fraction, no DB)."""
import sys
from datetime import datetime
sys.path.insert(0, "/app/backend")
from attendance_routes import derive, paid_fraction, IST  # noqa: E402

PER_DAY = 420.0  # ₹ (so 1 minute short = ₹1 — easy to read)


def iso(hhmm):
    h, m = map(int, hhmm.split(":"))
    return datetime(2026, 10, 1, h, m, tzinfo=IST).isoformat()


cases = [  # check-in, check-out, expected status, expected short, expected deduction ₹
    ("10:20", "17:20", "present", 0, 0), ("10:30", "17:30", "present", 0, 0), ("10:45", "17:45", "present", 0, 0), ("11:00", "18:00", "present", 0, 0),
    ("10:45", "17:30", "short_hours", 15, 15), ("11:15", "18:00", "short_hours", 15, 15), ("10:00", "17:00", "present", 0, 0), ("09:50", "16:50", "present", 0, 0),
    ("10:00", "14:00", "short_hours", 180, 180),
]
ok = True
for ci, co, st, short, ded in cases:
    r = derive({"check_in": iso(ci), "check_out": iso(co)})
    d = round(PER_DAY * (1 - paid_fraction(r)))
    good = r["status"] == st and r["short_minutes"] == short and d == ded
    ok &= good
    print(f"{'PASS' if good else 'FAIL'} in {ci} out {co} → worked {r['worked_minutes']}m late {r['late_minutes']} extra {r['extra_minutes']} adj {r['adjusted_minutes']} short {r['short_minutes']} status {r['status']} deduction ₹{d}")

r = derive({"check_in": iso("10:10"), "check_out": None})
print("open session status:", r["status"], "| checkout_missing paid fraction:", paid_fraction({"status": "checkout_missing"}))
ok &= r["status"] == "present" and paid_fraction({"status": "checkout_missing"}) == 0
print("ALL PASS" if ok else "SOME FAILED")
