import os
import logging
import httpx

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "crosspost"
logger = logging.getLogger("storage")

_storage_key = None


def is_configured() -> bool:
    """Object storage is only available when an Emergent key is present."""
    return bool(os.environ.get("EMERGENT_LLM_KEY"))


async def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    if not emergent_key:
        raise RuntimeError("EMERGENT_LLM_KEY not set — object storage disabled, files are kept on local disk only")
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key})
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
    return _storage_key


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=300) as c:
        r = await c.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            content=data,
        )
        if r.status_code == 409:
            return {"path": path, "size": len(data)}
        r.raise_for_status()
        return r.json()


async def get_object(path: str) -> tuple:
    key = await init_storage()
    async with httpx.AsyncClient(timeout=300) as c:
        r = await c.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key})
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "application/octet-stream")
