"""Emergent object storage helper."""
import os
import time
import logging
import requests

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "radhika-traders"

storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    last_err = None
    for attempt in range(3):
        try:
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data, timeout=60,
            )
            if resp.status_code == 404:
                key = init_storage(force=True)
                continue
            if resp.status_code >= 500:
                last_err = requests.HTTPError(f"{resp.status_code} from storage", response=resp)
                time.sleep(1.0 * (attempt + 1))
                continue
            resp.raise_for_status()
            return resp.json()
        except (requests.ConnectionError, requests.Timeout) as e:
            last_err = e
            time.sleep(1.0 * (attempt + 1))
    raise last_err or RuntimeError("Storage upload failed")


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def stream_object(path: str, chunk: int = 1024 * 1024):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60, stream=True)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60, stream=True)
    resp.raise_for_status()
    with resp:
        yield from resp.iter_content(chunk)


def delete_object(path: str) -> bool:
    key = init_storage()
    resp = requests.delete(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=30)
    if resp.status_code in (200, 202, 204, 404):
        return True
    resp.raise_for_status()
    return True


MEDIA_CACHE_DIR = "/tmp/rt_media_cache"
MEDIA_CACHE_MAX = 400 * 1024 * 1024


def cache_object(path: str) -> str:
    """Download an object to the local disk cache once (streamed, no RAM spike) so it can be served with HTTP Range instantly."""
    import hashlib
    import uuid
    os.makedirs(MEDIA_CACHE_DIR, exist_ok=True)
    fp = os.path.join(MEDIA_CACHE_DIR, hashlib.sha1(path.encode()).hexdigest())
    if os.path.exists(fp) and os.path.getsize(fp) > 0:
        os.utime(fp, None)
        return fp
    tmp = f"{fp}.{uuid.uuid4().hex}.part"
    with open(tmp, "wb") as f:
        for chunk in stream_object(path):
            f.write(chunk)
    os.replace(tmp, fp)
    files = sorted((os.path.join(MEDIA_CACHE_DIR, n) for n in os.listdir(MEDIA_CACHE_DIR) if not n.endswith(".part")), key=os.path.getmtime)
    total = sum(os.path.getsize(x) for x in files)
    for x in files:
        if total <= MEDIA_CACHE_MAX or x == fp:
            break
        total -= os.path.getsize(x)
        os.remove(x)
    return fp


def is_cached(path: str) -> bool:
    import hashlib
    return os.path.exists(os.path.join(MEDIA_CACHE_DIR, hashlib.sha1(path.encode()).hexdigest()))
