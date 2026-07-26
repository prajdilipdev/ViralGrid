"""Durable media storage in MongoDB (GridFS).

The local uploads directory is ephemeral on most hosts — Render wipes it on
every restart and redeploy — which breaks publishing, because Instagram
downloads the video from us *after* the upload happened. Keeping a copy in
MongoDB means the file survives and can be restored on demand.

Files are streamed in chunks in both directions, so a large video never sits
in memory in full. Anything above MEDIA_DB_MAX_MB is skipped to protect a
small Atlas quota (the free M0 tier is 512 MB in total).
"""
import os
import logging
from pathlib import Path

import aiofiles
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

logger = logging.getLogger("media_store")

CHUNK = 1024 * 1024
BUCKET = "media"
MAX_MB = int(os.environ.get("MEDIA_DB_MAX_MB", "60"))


def _bucket(db) -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name=BUCKET)


async def exists(db, filename: str) -> bool:
    return await db[f"{BUCKET}.files"].find_one({"filename": filename}, {"_id": 1}) is not None


async def delete(db, filename: str) -> None:
    """Remove any existing copies of this filename."""
    bucket = _bucket(db)
    async for doc in db[f"{BUCKET}.files"].find({"filename": filename}, {"_id": 1}):
        try:
            await bucket.delete(doc["_id"])
        except Exception as e:
            logger.warning(f"Could not delete old GridFS copy of {filename}: {e}")


async def store(db, local_path: Path, filename: str, content_type: str) -> bool:
    """Stream a local file into GridFS. Returns True when stored."""
    try:
        size_mb = local_path.stat().st_size / (1024 * 1024)
    except OSError as e:
        logger.error(f"Cannot stat {local_path}: {e}")
        return False
    if size_mb > MAX_MB:
        logger.warning(
            f"Skipping durable copy of {filename}: {size_mb:.1f}MB exceeds "
            f"MEDIA_DB_MAX_MB={MAX_MB}MB — it will not survive a restart"
        )
        return False

    await delete(db, filename)
    grid_in = _bucket(db).open_upload_stream(filename, metadata={"contentType": content_type})
    try:
        async with aiofiles.open(local_path, "rb") as f:
            while chunk := await f.read(CHUNK):
                await grid_in.write(chunk)
        await grid_in.close()
        logger.info(f"Stored {filename} in MongoDB ({size_mb:.1f}MB)")
        return True
    except Exception as e:
        logger.error(f"Failed storing {filename} in MongoDB: {e}")
        try:
            await grid_in.abort()
        except Exception:
            pass
        return False


async def restore(db, filename: str, dest: Path) -> bool:
    """Stream a file back out of GridFS onto local disk."""
    try:
        stream = await _bucket(db).open_download_stream_by_name(filename)
    except Exception as e:
        logger.warning(f"No durable copy of {filename}: {e}")
        return False
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        async with aiofiles.open(tmp, "wb") as f:
            while chunk := await stream.readchunk():
                await f.write(chunk)
        tmp.replace(dest)
        logger.info(f"Restored {filename} from MongoDB")
        return True
    except Exception as e:
        logger.error(f"Failed restoring {filename} from MongoDB: {e}")
        tmp.unlink(missing_ok=True)
        return False
    finally:
        try:
            await stream.close()
        except Exception:
            pass


async def content_type(db, filename: str) -> str:
    doc = await db[f"{BUCKET}.files"].find_one({"filename": filename}, {"metadata": 1})
    return ((doc or {}).get("metadata") or {}).get("contentType") or "application/octet-stream"
