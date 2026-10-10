import os, asyncio, json, base64, io, urllib.request
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw

API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0]
H = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 qa"}


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    u = await db.users.find_one({"email": "scratchtest@example.com"}, {"_id": 1})
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"assistant_blocked_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}})
    r = urllib.request.Request(API + "/api/auth/login", method="POST", data=json.dumps({"email": "scratchtest@example.com", "password": "Test@1234"}).encode(), headers=H)
    tok = json.load(urllib.request.urlopen(r))["token"]
    im = Image.new("RGB", (300, 200), (240, 240, 240)); ImageDraw.Draw(im).rectangle([20, 20, 200, 100], fill=(153, 27, 27)); b = io.BytesIO(); im.save(b, "JPEG")
    hh = {**H, "Authorization": "Bearer " + tok}
    body = {"session_id": "qablock12345", "message": "hi", "image_base64": base64.b64encode(b.getvalue()).decode()}
    try:
        urllib.request.urlopen(urllib.request.Request(API + "/api/assistant/chat", method="POST", data=json.dumps(body).encode(), headers=hh)); print("blocked image -> unexpected 200")
    except urllib.error.HTTPError as e:
        print("blocked image ->", e.code, e.read().decode()[:120])
    r = urllib.request.Request(API + "/api/assistant/chat", method="POST", data=json.dumps({"session_id": "qablock12345", "message": "Withdrawal kaise hoti hai? ek line me"}).encode(), headers=hh)
    print("text while blocked ->", urllib.request.urlopen(r, timeout=60).status)
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"assistant_blocked_until": ""}}); print("cleanup done")

asyncio.run(main())
