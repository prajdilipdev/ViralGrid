import os
import json
import uuid
import random
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import httpx
import aiofiles

from platforms import PLATFORM_SPECS, validate_media_for_platform, build_optimization_plan
from media_utils import UPLOAD_DIR, THUMB_DIR, OPT_DIR, probe_media, generate_thumbnail, transcode_video
from storage import APP_NAME, init_storage, put_object, get_object, is_configured as storage_configured
import instagram

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise RuntimeError(
        "MONGO_URL environment variable is not set. "
        "Set it to your MongoDB connection string (e.g. a MongoDB Atlas URI) in backend/.env or the host's environment."
    )
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'viralgrid')]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crosspost")

app = FastAPI()
api = APIRouter(prefix="/api")

AUTH_API = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ---------- Auth ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


async def get_current_user(request: Request) -> User:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


class SessionRequest(BaseModel):
    session_id: str


@api.post("/auth/session")
async def create_session(body: SessionRequest, response: Response):
    async with httpx.AsyncClient() as hc:
        resp = await hc.get(AUTH_API, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session ID")
    data = resp.json()
    # Private instance: if ALLOWED_EMAILS is set, only those Google accounts may sign in
    allowed = [e.strip().lower() for e in os.environ.get("ALLOWED_EMAILS", "").split(",") if e.strip()]
    if allowed and data["email"].strip().lower() not in allowed:
        raise HTTPException(status_code=403, detail="This is a private workspace — your account is not authorized")
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": data["name"], "picture": data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": data["email"], "name": data["name"],
            "picture": data.get("picture"), "created_at": datetime.now(timezone.utc).isoformat(),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie("session_token", session_token, max_age=7 * 24 * 3600, httponly=True, secure=True, samesite="none", path="/")
    # The cookie is cross-site (frontend and backend are different hosts), and
    # Safari/iOS blocks those by default. Also hand the token back so the client
    # can authenticate with an Authorization header, which always works.
    return {
        "user_id": user_id, "email": data["email"], "name": data["name"],
        "picture": data.get("picture"), "session_token": session_token,
    }


@api.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.get("/health")
async def health():
    """Cheap unauthenticated ping — used by the frontend to wake a sleeping
    free-tier instance and to show a 'server starting' indicator."""
    return {"ok": True, "instagram": instagram.is_configured()}


# ---------- Platform connections (simulated) ----------
@api.get("/platforms")
async def list_platforms():
    return [{"id": k, **{kk: vv for kk, vv in v.items()}} for k, v in PLATFORM_SPECS.items()]


# Never expose stored OAuth tokens to the client.
CONN_PROJECTION = {"_id": 0, "access_token": 0}

INSTAGRAM = "instagram_reels"


@api.get("/connections")
async def get_connections(user: User = Depends(get_current_user)):
    conns = await db.connections.find({"user_id": user.user_id}, CONN_PROJECTION).to_list(50)
    return conns


class ConnectRequest(BaseModel):
    platform: str


@api.post("/connections")
async def connect_platform(body: ConnectRequest, user: User = Depends(get_current_user)):
    if body.platform not in PLATFORM_SPECS:
        raise HTTPException(status_code=400, detail="Unknown platform")
    if body.platform == INSTAGRAM and instagram.is_configured():
        raise HTTPException(status_code=400, detail="Use /api/instagram/authorize to connect Instagram")
    handle = f"@{user.name.split()[0].lower()}_{body.platform.split('_')[0]}"
    doc = {
        "user_id": user.user_id, "platform": body.platform, "handle": handle,
        "status": "connected", "simulated": True,
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.connections.update_one({"user_id": user.user_id, "platform": body.platform}, {"$set": doc}, upsert=True)
    return doc


@api.delete("/connections/{platform}")
async def disconnect_platform(platform: str, user: User = Depends(get_current_user)):
    await db.connections.delete_one({"user_id": user.user_id, "platform": platform})
    return {"ok": True}


# ---------- Instagram (real publishing) ----------
def _frontend_url() -> str:
    origins = os.environ.get("CORS_ORIGINS", "").split(",")
    first = next((o.strip().rstrip("/") for o in origins if o.strip() and o.strip() != "*"), "")
    return first


@api.get("/instagram/status")
async def instagram_status():
    """Tells the UI whether real Instagram publishing is available."""
    return {"configured": instagram.is_configured()}


@api.get("/instagram/authorize")
async def instagram_authorize(user: User = Depends(get_current_user)):
    if not instagram.is_configured():
        raise HTTPException(status_code=503, detail="Instagram is not configured on this server")
    state = uuid.uuid4().hex
    await db.oauth_states.insert_one({
        "state": state, "user_id": user.user_id, "platform": INSTAGRAM,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        return {"url": instagram.authorize_url(state)}
    except instagram.InstagramError as e:
        raise HTTPException(status_code=503, detail=str(e))


@api.get("/instagram/callback")
async def instagram_callback(request: Request, code: Optional[str] = None,
                             state: Optional[str] = None, error: Optional[str] = None):
    """Instagram redirects the browser here after the user approves access."""
    frontend = _frontend_url()
    def back(status: str, message: str = ""):
        from urllib.parse import urlencode
        q = urlencode({"ig": status, **({"msg": message[:200]} if message else {})})
        target = f"{frontend}/connections?{q}" if frontend else f"/api/instagram/result?{q}"
        return RedirectResponse(target, status_code=303)

    if error or not code or not state:
        return back("error", error or "Authorization was cancelled")

    record = await db.oauth_states.find_one_and_delete({"state": state, "platform": INSTAGRAM})
    if not record:
        return back("error", "Invalid or expired authorization state")

    try:
        tokens = await instagram.exchange_code(code)
        profile = await instagram.get_profile(tokens["access_token"])
    except instagram.InstagramError as e:
        logger.error(f"Instagram connect failed: {e}")
        return back("error", str(e))
    except Exception as e:
        logger.error(f"Instagram connect failed: {e}")
        return back("error", "Could not complete Instagram connection")

    if not profile["ig_user_id"]:
        return back("error", "Instagram did not return a professional account id")

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(tokens["expires_in"]))
    await db.connections.update_one(
        {"user_id": record["user_id"], "platform": INSTAGRAM},
        {"$set": {
            "user_id": record["user_id"], "platform": INSTAGRAM,
            "handle": f"@{profile['username']}" if profile["username"] else "@instagram",
            "status": "connected", "simulated": False,
            "ig_user_id": profile["ig_user_id"],
            "account_type": profile.get("account_type"),
            "access_token": tokens["access_token"],
            "token_expires_at": expires_at.isoformat(),
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return back("connected", profile["username"])


@api.get("/instagram/result")
async def instagram_result(ig: str = "", msg: str = ""):
    """Fallback landing page when CORS_ORIGINS has no explicit frontend URL."""
    return {"status": ig, "message": msg}


# ---------- Media ----------
CATEGORY_DIRS = {"uploads": UPLOAD_DIR, "thumbs": THUMB_DIR, "optimized": OPT_DIR}


async def persist_file(local_path: Path, category: str, filename: str, content_type: str) -> Optional[str]:
    """Upload a local file to Emergent object storage and record the reference.

    No-op when object storage isn't configured — reading the file would otherwise
    pull the whole thing into memory for a call that is guaranteed to fail.
    """
    if not storage_configured():
        return None
    storage_path = f"{APP_NAME}/{category}/{filename}"
    try:
        result = await put_object(storage_path, local_path.read_bytes(), content_type)
        await db.stored_files.update_one(
            {"filename": filename},
            {"$set": {
                "filename": filename, "storage_path": result["path"], "category": category,
                "content_type": content_type, "is_deleted": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return result["path"]
    except Exception as e:
        logger.error(f"Object storage persist failed for {filename}: {e}")
        return None


@api.post("/media/upload")
async def upload_media(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    ext = Path(file.filename or "file").suffix.lower() or ".bin"
    media_id = f"media_{uuid.uuid4().hex[:12]}"
    fname = f"{media_id}{ext}"
    dest = UPLOAD_DIR / fname
    size = 0
    async with aiofiles.open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            await f.write(chunk)
    mime = file.content_type or ""
    mtype = "video" if mime.startswith("video") or ext in (".mp4", ".mov", ".webm", ".mkv", ".avi") else "image"
    info = await probe_media(str(dest))
    thumb = None
    if mtype == "video":
        thumb = await generate_thumbnail(str(dest), f"{media_id}.jpg")
    storage_path = await persist_file(dest, "uploads", fname, mime or "application/octet-stream")
    thumb_storage_path = None
    if thumb:
        thumb_storage_path = await persist_file(THUMB_DIR / thumb, "thumbs", thumb, "image/jpeg")
    doc = {
        "media_id": media_id, "user_id": user.user_id, "filename": fname,
        "original_name": file.filename, "type": mtype, "mime": mime, "size": size,
        "width": info.get("width"), "height": info.get("height"),
        "duration": info.get("duration"), "codec": info.get("codec"),
        "bitrate": info.get("bitrate"), "fps": info.get("fps"), "audio_codec": info.get("audio_codec"),
        "thumbnail": thumb, "storage_path": storage_path, "thumb_storage_path": thumb_storage_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.media.insert_one({**doc})
    return doc


@api.get("/media")
async def list_media(user: User = Depends(get_current_user)):
    return await db.media.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/media/file/{filename}")
async def serve_media(filename: str):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    for d in (UPLOAD_DIR, THUMB_DIR, OPT_DIR):
        p = d / filename
        if p.exists() and p.is_file():
            return FileResponse(p)
    # local cache miss — restore from object storage
    record = await db.stored_files.find_one({"filename": filename, "is_deleted": False}, {"_id": 0})
    if record:
        try:
            data, content_type = await get_object(record["storage_path"])
            cache_dir = CATEGORY_DIRS.get(record.get("category"), UPLOAD_DIR)
            (cache_dir / filename).write_bytes(data)
            return FileResponse(cache_dir / filename, media_type=record.get("content_type") or content_type)
        except Exception as e:
            logger.error(f"Object storage fetch failed for {filename}: {e}")
    raise HTTPException(status_code=404, detail="File not found")


class ValidateRequest(BaseModel):
    media_id: str
    platforms: List[str]


@api.post("/media/validate")
async def validate_media(body: ValidateRequest, user: User = Depends(get_current_user)):
    media = await db.media.find_one({"media_id": body.media_id, "user_id": user.user_id}, {"_id": 0})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    results = [validate_media_for_platform(media, p) for p in body.platforms if p in PLATFORM_SPECS]
    return {"media": media, "validations": results}


# ---------- AI generation ----------
class AIRequest(BaseModel):
    topic: str
    tone: Optional[str] = "engaging"
    platforms: List[str] = []


@api.post("/ai/generate")
async def ai_generate(body: AIRequest, user: User = Depends(get_current_user)):
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(status_code=503, detail="AI generation is not configured (EMERGENT_LLM_KEY not set)")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(status_code=503, detail="AI generation is not available (emergentintegrations package not installed)")
    plat_names = ", ".join(PLATFORM_SPECS[p]["name"] for p in body.platforms if p in PLATFORM_SPECS) or "social media"
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"ai_{uuid.uuid4().hex[:8]}",
        system_message="You are a social media copywriting expert. Respond ONLY with valid JSON, no markdown fences.",
    ).with_model("openai", "gpt-5.4")
    prompt = (
        f"Write social media copy for content about: {body.topic}. Tone: {body.tone}. Target platforms: {plat_names}.\n"
        'Return JSON exactly like: {"caption": "short punchy caption under 100 chars", '
        '"description": "2-3 sentence description", "hashtags": ["tag1","tag2", ... 8-12 hashtags without # symbol]}'
    )
    result = await chat.send_message(UserMessage(text=prompt))
    text = result.strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    try:
        parsed = json.loads(text)
    except Exception:
        raise HTTPException(status_code=502, detail="AI returned invalid response, please retry")
    return {"caption": parsed.get("caption", ""), "description": parsed.get("description", ""), "hashtags": parsed.get("hashtags", [])}


# ---------- Posts ----------
class PostCreate(BaseModel):
    title: str
    caption: str = ""
    description: str = ""
    hashtags: List[str] = []
    tags: List[str] = []
    media_ids: List[str] = []
    platforms: List[str] = []
    platform_overrides: Dict[str, Any] = {}
    action: str = "draft"  # draft | schedule | publish
    scheduled_at: Optional[str] = None
    timezone: Optional[str] = "UTC"
    recurrence: str = "none"  # none | daily | weekly


def _simulate_metrics() -> dict:
    views = random.randint(800, 60000)
    return {
        "views": views,
        "likes": int(views * random.uniform(0.03, 0.12)),
        "comments": int(views * random.uniform(0.002, 0.01)),
        "shares": int(views * random.uniform(0.005, 0.03)),
    }


DELETED = "deleted"


def _post_status_from_results(results: dict) -> str:
    """Roll per-platform outcomes up into the post's overall status."""
    statuses = [r.get("status") for r in results.values()]
    if not statuses:
        return "failed"
    if all(s == "published" for s in statuses):
        return "published"
    if any(s == "published" for s in statuses):
        return "partial"
    if any(s == DELETED for s in statuses):
        return DELETED
    return "failed"


def _build_caption(post: dict) -> str:
    parts = [post.get("caption") or post.get("title") or ""]
    if post.get("description"):
        parts.append(post["description"])
    tags = post.get("hashtags") or []
    if tags:
        parts.append(" ".join(f"#{t.lstrip('#')}" for t in tags))
    return "\n\n".join(p for p in parts if p).strip()


async def _publish_to_instagram(conn: dict, post: dict, media: Optional[dict],
                                optimized_file: Optional[str], optimization: Optional[dict],
                                attempts: int) -> dict:
    """Real Instagram publish. Returns a platform_results entry."""
    fail = lambda msg: {"status": "failed", "error": msg, "attempts": attempts, "simulated": False}

    if not media:
        return fail("Instagram requires a photo or video — this post has no media")
    base = (os.environ.get("PUBLIC_BACKEND_URL") or "").rstrip("/")
    if not base:
        return fail("PUBLIC_BACKEND_URL is not set — Instagram cannot fetch the media")
    if not base.startswith("https://"):
        return fail("PUBLIC_BACKEND_URL must be an https URL for Instagram to fetch media")

    # Prefer the 9:16 transcode when we made one; Instagram fetches it by URL.
    filename = optimized_file or media["filename"]
    media_url = f"{base}/api/media/file/{filename}"
    is_video = media.get("type") == "video"

    try:
        result = await instagram.publish(
            conn["access_token"], conn["ig_user_id"], media_url,
            _build_caption(post), is_video,
        )
    except instagram.InstagramError as e:
        return fail(str(e))
    except Exception as e:
        logger.error(f"Instagram publish error for {post['post_id']}: {e}")
        return fail(f"Instagram publish failed: {e}")

    metrics = await instagram.get_insights(conn["access_token"], result["media_id"])
    return {
        "status": "published",
        "url": result.get("permalink") or f"https://www.instagram.com/p/{result['media_id']}",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "optimization": optimization,
        "optimized_file": optimized_file,
        "metrics": metrics or {"views": 0, "likes": 0, "comments": 0, "shares": 0},
        "media_id": result["media_id"],
        "simulated": False,
        "attempts": attempts,
    }


async def _publish_post(post: dict):
    """Publishing engine: real ffmpeg optimization, real Instagram delivery when
    connected, simulated delivery for the remaining platforms."""
    user_id = post["user_id"]
    await db.posts.update_one({"post_id": post["post_id"]}, {"$set": {"status": "publishing"}})
    conn_docs = await db.connections.find({"user_id": user_id, "status": "connected"}, {"_id": 0}).to_list(50)
    conn_map = {c["platform"]: c for c in conn_docs}
    conns = set(conn_map)
    media = None
    if post.get("media_ids"):
        media = await db.media.find_one({"media_id": post["media_ids"][0]}, {"_id": 0})
    results = post.get("platform_results", {})
    transcode_cache = {}
    for platform in post.get("platforms", []):
        if platform not in PLATFORM_SPECS:
            continue
        if platform not in conns:
            results[platform] = {"status": "failed", "error": f"{PLATFORM_SPECS[platform]['name']} account not connected", "attempts": results.get(platform, {}).get("attempts", 0) + 1}
            continue
        optimization = None
        optimized_file = None
        if media:
            optimization = build_optimization_plan(media, platform)
            validation = validate_media_for_platform(media, platform)
            if validation["status"] == "error":
                results[platform] = {"status": "failed", "error": "; ".join(c["message"] for c in validation["checks"] if c["level"] == "error"), "attempts": results.get(platform, {}).get("attempts", 0) + 1}
                continue
            if media["type"] == "video" and optimization["transform"] != "passthrough":
                spec = PLATFORM_SPECS[platform]
                key = (spec["width"], spec["height"], spec["video_bitrate_k"])
                if key not in transcode_cache:
                    out_name = f"{post['post_id']}_{spec['width']}x{spec['height']}.mp4"
                    transcode_cache[key] = await transcode_video(str(UPLOAD_DIR / media["filename"]), out_name, spec["width"], spec["height"], spec["video_bitrate_k"])
                    if transcode_cache[key]:
                        await persist_file(OPT_DIR / transcode_cache[key], "optimized", transcode_cache[key], "video/mp4")
                optimized_file = transcode_cache[key]
                if not optimized_file:
                    optimization["transform"] = "passthrough_fallback"
        attempts = results.get(platform, {}).get("attempts", 0) + 1
        conn = conn_map.get(platform, {})
        if platform == INSTAGRAM and not conn.get("simulated", True):
            results[platform] = await _publish_to_instagram(
                conn, post, media, optimized_file, optimization, attempts,
            )
            continue
        results[platform] = {
            "status": "published",
            "url": f"https://{platform.replace('_', '.')}/p/{uuid.uuid4().hex[:10]}",
            "published_at": datetime.now(timezone.utc).isoformat(),
            "optimization": optimization,
            "optimized_file": optimized_file,
            "metrics": _simulate_metrics(),
            "simulated": True,
            "attempts": results.get(platform, {}).get("attempts", 0) + 1,
        }
    final = _post_status_from_results(results)
    await db.posts.update_one({"post_id": post["post_id"]}, {"$set": {
        "status": final, "platform_results": results,
        "published_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }})
    # recurring: clone into next occurrence
    if post.get("recurrence") in ("daily", "weekly") and post.get("scheduled_at"):
        delta = timedelta(days=1 if post["recurrence"] == "daily" else 7)
        next_at = datetime.fromisoformat(post["scheduled_at"].replace("Z", "+00:00")) + delta
        clone = {k: v for k, v in post.items() if k not in ("_id",)}
        clone.update({
            "post_id": f"post_{uuid.uuid4().hex[:12]}", "status": "scheduled",
            "scheduled_at": next_at.isoformat(), "platform_results": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        clone.pop("published_at", None)
        await db.posts.insert_one(clone)
    return final


@api.post("/posts")
async def create_post(body: PostCreate, user: User = Depends(get_current_user)):
    if body.action in ("schedule",) and not body.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at required for scheduling")
    if body.action in ("publish", "schedule") and not body.platforms:
        raise HTTPException(status_code=400, detail="Select at least one platform")
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    status = {"draft": "draft", "schedule": "scheduled", "publish": "publishing"}.get(body.action, "draft")
    doc = {
        "post_id": post_id, "user_id": user.user_id, "title": body.title,
        "caption": body.caption, "description": body.description,
        "hashtags": body.hashtags, "tags": body.tags, "media_ids": body.media_ids,
        "platforms": body.platforms, "platform_overrides": body.platform_overrides,
        "status": status, "scheduled_at": body.scheduled_at, "timezone": body.timezone,
        "recurrence": body.recurrence, "platform_results": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.insert_one({**doc})
    if body.action == "publish":
        final = await _publish_post(doc)
        doc["status"] = final
        doc["platform_results"] = (await db.posts.find_one({"post_id": post_id}, {"_id": 0}))["platform_results"]
    return doc


@api.get("/posts")
async def list_posts(status: Optional[str] = None, user: User = Depends(get_current_user)):
    q = {"user_id": user.user_id}
    if status:
        q["status"] = {"$in": status.split(",")}
    return await db.posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/posts/{post_id}")
async def get_post(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id, "user_id": user.user_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


class PostUpdate(BaseModel):
    title: Optional[str] = None
    caption: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    platforms: Optional[List[str]] = None
    platform_overrides: Optional[Dict[str, Any]] = None
    scheduled_at: Optional[str] = None
    timezone: Optional[str] = None
    recurrence: Optional[str] = None
    status: Optional[str] = None


@api.put("/posts/{post_id}")
async def update_post(post_id: str, body: PostUpdate, user: User = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.posts.update_one({"post_id": post_id, "user_id": user.user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return await db.posts.find_one({"post_id": post_id}, {"_id": 0})


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: User = Depends(get_current_user)):
    res = await db.posts.delete_one({"post_id": post_id, "user_id": user.user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True}


class BulkItem(BaseModel):
    title: str
    caption: str = ""
    description: str = ""
    hashtags: List[str] = []
    tags: List[str] = []
    media_ids: List[str] = []
    platforms: List[str] = []
    platform_overrides: Dict[str, Any] = {}
    scheduled_at: str
    timezone: Optional[str] = "UTC"
    recurrence: str = "none"


class BulkCreateRequest(BaseModel):
    items: List[BulkItem]


@api.post("/posts/bulk")
async def bulk_create_posts(body: BulkCreateRequest, user: User = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="No items provided")
    if len(body.items) > 200:
        raise HTTPException(status_code=400, detail="Bulk limit is 200 posts per request")
    created = []
    errors = []
    for idx, item in enumerate(body.items):
        try:
            if not item.title.strip():
                raise ValueError("Title required")
            if not item.platforms:
                raise ValueError("At least one platform required")
            if not item.scheduled_at:
                raise ValueError("scheduled_at required")
            # validate iso datetime
            datetime.fromisoformat(item.scheduled_at.replace("Z", "+00:00"))
            post_id = f"post_{uuid.uuid4().hex[:12]}"
            doc = {
                "post_id": post_id, "user_id": user.user_id, "title": item.title,
                "caption": item.caption, "description": item.description,
                "hashtags": item.hashtags, "tags": item.tags, "media_ids": item.media_ids,
                "platforms": item.platforms, "platform_overrides": item.platform_overrides,
                "status": "scheduled", "scheduled_at": item.scheduled_at,
                "timezone": item.timezone, "recurrence": item.recurrence,
                "platform_results": {}, "bulk_batch": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.posts.insert_one({**doc})
            created.append({"post_id": post_id, "scheduled_at": item.scheduled_at, "title": item.title})
        except Exception as e:
            errors.append({"index": idx, "error": str(e)})
    return {"created_count": len(created), "created": created, "errors": errors}


@api.post("/posts/sync")
async def sync_posts(user: User = Depends(get_current_user)):
    """Check Instagram for posts the user deleted there, and refresh metrics."""
    return await sync_instagram_posts(user.user_id)


@api.post("/posts/{post_id}/publish")
async def publish_now(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id, "user_id": user.user_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.get("platforms"):
        raise HTTPException(status_code=400, detail="No platforms selected")
    final = await _publish_post(post)
    return await db.posts.find_one({"post_id": post_id}, {"_id": 0})


@api.post("/posts/{post_id}/retry")
async def retry_post(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id, "user_id": user.user_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    failed = [p for p, r in post.get("platform_results", {}).items() if r.get("status") == "failed"]
    if not failed:
        raise HTTPException(status_code=400, detail="No failed platforms to retry")
    retry_post_doc = {**post, "platforms": failed}
    await _publish_post(retry_post_doc)
    return await db.posts.find_one({"post_id": post_id}, {"_id": 0})


# ---------- Dashboard & Analytics ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: User = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)
    conns = await db.connections.find({"user_id": user.user_id}, {"_id": 0}).to_list(50)
    total_views = sum(r.get("metrics", {}).get("views", 0) for p in posts for r in p.get("platform_results", {}).values() if r.get("status") == "published")
    return {
        "total_posts": len(posts),
        "published": sum(1 for p in posts if p["status"] in ("published", "partial")),
        "scheduled": sum(1 for p in posts if p["status"] == "scheduled"),
        "drafts": sum(1 for p in posts if p["status"] == "draft"),
        "failed": sum(1 for p in posts if p["status"] == "failed"),
        "deleted": sum(1 for p in posts if p["status"] == DELETED),
        "connected_platforms": len(conns),
        "total_views": total_views,
    }


@api.get("/analytics/overview")
async def analytics_overview(user: User = Depends(get_current_user)):
    posts = await db.posts.find(
        {"user_id": user.user_id, "status": {"$in": ["published", "partial", DELETED]}}, {"_id": 0}
    ).to_list(1000)
    per_platform = {}
    timeline = {}
    totals = {"views": 0, "likes": 0, "comments": 0, "shares": 0}
    removed = []
    for p in posts:
        day = (p.get("published_at") or p["created_at"])[:10]
        for plat, r in p.get("platform_results", {}).items():
            if r.get("status") == DELETED:
                # Keep it visible in analytics, but out of the live totals.
                removed.append({
                    "post_id": p["post_id"], "title": p.get("title", ""),
                    "platform": plat, "name": PLATFORM_SPECS.get(plat, {}).get("name", plat),
                    "published_at": r.get("published_at"), "deleted_at": r.get("deleted_at"),
                    "note": r.get("deleted_note") or "Deleted by user",
                    "last_metrics": r.get("metrics") or {},
                })
                continue
            if r.get("status") != "published":
                continue
            m = r.get("metrics", {})
            pp = per_platform.setdefault(plat, {"platform": plat, "name": PLATFORM_SPECS.get(plat, {}).get("name", plat), "posts": 0, "views": 0, "likes": 0, "shares": 0, "comments": 0})
            pp["posts"] += 1
            for k in ("views", "likes", "shares", "comments"):
                pp[k] += m.get(k, 0)
                totals[k] += m.get(k, 0)
            t = timeline.setdefault(day, {"date": day, "views": 0, "likes": 0})
            t["views"] += m.get("views", 0)
            t["likes"] += m.get("likes", 0)
    removed.sort(key=lambda x: x.get("deleted_at") or "", reverse=True)
    return {
        "totals": totals,
        "per_platform": sorted(per_platform.values(), key=lambda x: -x["views"]),
        "timeline": sorted(timeline.values(), key=lambda x: x["date"]),
        "published_posts": len(posts) - len(removed),
        "deleted": removed,
        "deleted_count": len(removed),
    }


# ---------- Scheduler ----------
scheduler = AsyncIOScheduler()


def _parse_dt(value: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def check_due_posts():
    # scheduled_at is stored as an ISO string whose format varies (Z vs +00:00 suffix),
    # so compare parsed datetimes instead of raw strings
    now = datetime.now(timezone.utc)
    scheduled = await db.posts.find({"status": "scheduled"}, {"_id": 0}).to_list(500)
    due = [p for p in scheduled if (dt := _parse_dt(p.get("scheduled_at") or "")) and dt <= now][:50]
    for post in due:
        logger.info(f"Auto-publishing scheduled post {post['post_id']}")
        try:
            await _publish_post(post)
        except Exception as e:
            logger.error(f"Scheduled publish failed for {post['post_id']}: {e}")
            await db.posts.update_one({"post_id": post["post_id"]}, {"$set": {"status": "failed", "error": str(e)}})


async def sync_instagram_posts(user_id: Optional[str] = None) -> dict:
    """Reconcile our records with Instagram: flag posts the user deleted there,
    and refresh live metrics for the ones still up."""
    if not instagram.is_configured():
        return {"checked": 0, "deleted": 0, "refreshed": 0}
    q = {f"platform_results.{INSTAGRAM}.status": "published"}
    if user_id:
        q["user_id"] = user_id
    posts = await db.posts.find(q, {"_id": 0}).to_list(500)

    conn_cache: Dict[str, Any] = {}
    checked = deleted = refreshed = 0
    for post in posts:
        result = (post.get("platform_results") or {}).get(INSTAGRAM) or {}
        media_id = result.get("media_id")
        if not media_id or result.get("simulated", True):
            continue
        uid = post["user_id"]
        if uid not in conn_cache:
            conn_cache[uid] = await db.connections.find_one(
                {"user_id": uid, "platform": INSTAGRAM, "simulated": False}, {"_id": 0}
            )
        conn = conn_cache[uid]
        if not conn:
            continue

        checked += 1
        exists = await instagram.media_exists(conn["access_token"], media_id)
        if exists is None:
            continue  # inconclusive — leave the record alone
        if exists is False:
            result["status"] = DELETED
            result["deleted_at"] = datetime.now(timezone.utc).isoformat()
            result["deleted_note"] = "Deleted by user on Instagram"
            deleted += 1
        else:
            metrics = await instagram.get_insights(conn["access_token"], media_id)
            if not metrics:
                continue
            result["metrics"] = {**(result.get("metrics") or {}), **metrics}
            refreshed += 1

        all_results = {**(post.get("platform_results") or {}), INSTAGRAM: result}
        await db.posts.update_one({"post_id": post["post_id"]}, {"$set": {
            f"platform_results.{INSTAGRAM}": result,
            "status": _post_status_from_results(all_results),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }})
    if deleted or refreshed:
        logger.info(f"Instagram sync: checked={checked} deleted={deleted} refreshed={refreshed}")
    return {"checked": checked, "deleted": deleted, "refreshed": refreshed}


async def refresh_instagram_tokens():
    """Long-lived IG tokens last 60 days; refresh any expiring within 10."""
    if not instagram.is_configured():
        return
    soon = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    conns = await db.connections.find(
        {"platform": INSTAGRAM, "simulated": False, "token_expires_at": {"$lte": soon}}, {"_id": 0}
    ).to_list(50)
    for conn in conns:
        try:
            new = await instagram.refresh_long_lived_token(conn["access_token"])
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(new["expires_in"]))
            await db.connections.update_one(
                {"user_id": conn["user_id"], "platform": INSTAGRAM},
                {"$set": {"access_token": new["access_token"], "token_expires_at": expires_at.isoformat()}},
            )
            logger.info(f"Refreshed Instagram token for {conn['user_id']}")
        except Exception as e:
            logger.error(f"Instagram token refresh failed for {conn['user_id']}: {e}")


@app.on_event("startup")
async def startup():
    try:
        await init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
    scheduler.add_job(check_due_posts, "interval", seconds=30, id="publish_due")
    scheduler.add_job(refresh_instagram_tokens, "interval", hours=12, id="refresh_ig_tokens")
    scheduler.add_job(sync_instagram_posts, "interval", hours=6, id="sync_ig_posts")
    scheduler.start()
    if instagram.is_configured():
        logger.info("Instagram publishing: ENABLED (real)")
    else:
        logger.info("Instagram publishing: simulated (IG_APP_ID/IG_APP_SECRET not set)")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
