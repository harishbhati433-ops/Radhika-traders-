"""Sim: employee KYC — validation, submit, admin view/edit/verify/reject/enable/delete, history. Cleans up."""
import asyncio, sys
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

ENV = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l)
API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip('"') + "/api"
EMP = "6aa4f62060cf8b2d2a38c56b"
GOOD = {"mobile": "9876543210", "father_name": "Suresh Kumar", "email": "rahul.test@gmail.com", "dob": "1995-05-15", "address": "12, Station Road, Agar Malwa, MP 465441",
        "aadhaar": "234567890124", "pan": "ABCPK1234F", "ifsc": "HDFC0000001", "bank_account": "123456789012", "bank_account_confirm": "123456789012"}


def verhoeff_ok(a):
    d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]]
    p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]]
    c = 0
    for i, ch in enumerate(reversed(a)):
        c = d[c][p[i % 8][int(ch)]]
    return c == 0


async def main():
    db = AsyncIOMotorClient(ENV["MONGO_URL"].strip('"'))[ENV["DB_NAME"].strip('"')]
    # find a Verhoeff-valid aadhaar
    base = "23456789012"
    GOOD["aadhaar"] = next(base + str(x) for x in range(10) if verhoeff_ok(base + str(x)))
    ok = lambda cond, msg: print(("PASS " if cond else "FAIL ") + msg) or (cond or sys.exit(1))
    async with httpx.AsyncClient(timeout=60) as c:
        adm = (await c.post(f"{API}/auth/login", json={"email": "bhatiharish276@gmail.com", "password": "Radhika@2023", "portal": "admin"})).json()["token"]
        e = (await c.post(f"{API}/auth/employee/login", json={"username": "rahul.k", "password": "Emp@1234"})).json()
        A, E = {"Authorization": f"Bearer {adm}"}, {"Authorization": f"Bearer {e.get('token') or e.get('access_token')}"}
        await db.employee_kyc.delete_many({"employee_id": EMP})
        r = (await c.get(f"{API}/employee/kyc", headers=E)).json()
        ok(r["kyc"] is None and r["prefill"]["full_name"] == "Rahul Kumar" and r["prefill"]["employee_code"], f"prefill: {r['prefill']}")
        for field, bad, msg in [("aadhaar", "123456789012", "aadhaar starting 1"), ("aadhaar", "234567890125" if GOOD["aadhaar"] != "234567890125" else "234567890126", "aadhaar bad checksum"), ("pan", "ABCDE1234F", "PAN 4th letter not P"),
                                ("pan", "ABCP1234F", "PAN format"), ("ifsc", "HDFC1234567", "IFSC format"), ("ifsc", "ZZZZ0999999", "IFSC not found"), ("mobile", "12345", "mobile"), ("email", "abc", "email"),
                                ("dob", "2015-01-01", "dob under 18"), ("bank_account_confirm", "999999999999", "account mismatch")]:
            r = await c.post(f"{API}/employee/kyc", headers=E, json={**GOOD, field: bad})
            ok(r.status_code == 400, f"rejects {msg}: {r.json().get('detail', '')[:70]}")
        r = await c.post(f"{API}/employee/kyc", headers=E, json=GOOD)
        ok(r.status_code == 200 and r.json()["status"] == "pending" and r.json()["bank_name"], f"submit OK → pending, bank {r.json().get('bank_name')} / {r.json().get('branch')}")
        ok("history" not in r.json() and r.json()["aadhaar_masked"].startswith("XXXX"), "employee view hides history, masks aadhaar")
        lst = (await c.get(f"{API}/admin/employee-kyc", headers=A)).json()
        ok(any(k["employee_id"] == EMP for k in lst["items"]) and lst["counts"].get("pending", 0) >= 1, f"admin list counts {lst['counts']}")
        r = await c.put(f"{API}/admin/employee-kyc/{EMP}", headers=A, json={**GOOD, "father_name": "Suresh K. Edited"})
        ok(r.status_code == 200 and r.json()["father_name"] == "Suresh K. Edited" and r.json()["history"][-1]["action"] == "edited", "admin edit + history")
        r = await c.put(f"{API}/admin/employee-kyc/{EMP}/reject", headers=A, json={"reason": "PAN photo mismatch"})
        ok(r.status_code == 200 and r.json()["status"] == "rejected", "admin reject")
        r = (await c.get(f"{API}/employee/kyc", headers=E)).json()["kyc"]
        ok(r["status"] == "rejected" and r["rejection_reason"] == "PAN photo mismatch", "employee sees rejection reason")
        r = await c.post(f"{API}/employee/kyc", headers=E, json=GOOD)
        ok(r.status_code == 200 and r.json()["status"] == "pending", "employee resubmits after rejection → pending")
        r = await c.put(f"{API}/admin/employee-kyc/{EMP}/verify", headers=A)
        ok(r.status_code == 200 and r.json()["status"] == "verified" and r.json()["verified_by"], "admin verify")
        r = await c.post(f"{API}/employee/kyc", headers=E, json=GOOD)
        ok(r.status_code == 400, "verified KYC locked for employee")
        r = await c.put(f"{API}/admin/employee-kyc/{EMP}/enable", headers=A, json={"enabled": False})
        ok(r.status_code == 200 and r.json()["enabled"] is False, "admin disable")
        r = await c.put(f"{API}/admin/employee-kyc/{EMP}/enable", headers=A, json={"enabled": True})
        ok(r.json()["enabled"] is True, "admin enable")
        r = (await c.get(f"{API}/admin/employee-kyc/{EMP}", headers=A)).json()
        ok([h["action"] for h in r["history"]] == ["submitted", "edited", "rejected", "resubmitted", "verified", "disabled", "enabled"], f"full record history: {[h['action'] for h in r['history']]}")
        r = await c.delete(f"{API}/admin/employee-kyc/{EMP}", headers=A)
        ok(r.status_code == 200 and (await c.get(f"{API}/admin/employee-kyc/{EMP}", headers=A)).status_code == 404, "admin delete (archived copy kept)")
        ok(await db.employee_kyc_deleted.count_documents({"employee_id": EMP}) >= 1, "archive exists")
        await db.employee_kyc_deleted.delete_many({"employee_id": EMP})
        # legacy employee record for frontend test: leave none
    print("ALL PASS")

asyncio.run(main())
