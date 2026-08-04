"""Real YouTube Shorts publishing via the YouTube Data API v3.

Uses Google OAuth 2.0 (authorization code + refresh token) and the resumable
upload endpoint. Docs:
  https://developers.google.com/youtube/v3/guides/uploading_a_video
  https://developers.google.com/youtube/v3/docs/videos/insert

Unlike Instagram, which downloads the file from us by URL, YouTube requires us
to push the bytes. The upload is therefore streamed from disk in chunks so a
300MB video never sits in memory in full.

If YT_CLIENT_ID / YT_CLIENT_SECRET are not configured the module reports itself
as unconfigured and the caller falls back to simulated publishing.

NOTE ON PRIVACY: videos uploaded through an API project Google has not audited
are force-locked to private by YouTube, whatever privacyStatus we request, and
that cannot be appealed. We still ask for the real status so that the day the
audit passes, uploads start going out correctly with no code change.
"""
import os
import json
import time
import logging
from pathlib import Path
from typing import Optional

import aiofiles
import httpx

logger = logging.getLogger("youtube")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"

# Only the upload scope. Reading the channel name would need youtube.readonly
# on top, and every extra scope is more surface for the compliance audit to
# object to — not worth it for a cosmetic label.
SCOPES = "https://www.googleapis.com/auth/youtube.upload"

# YouTube's own limits on the metadata fields.
TITLE_LIMIT = 100
DESCRIPTION_LIMIT = 5000

# Shorts are picked up automatically from a vertical video of this length or
# less; nothing needs to be flagged in the API for it.
SHORTS_MAX_SECONDS = 180

UPLOAD_CHUNK = 1024 * 1024


class YouTubeError(Exception):
    """Raised with a human-readable message suitable for surfacing in the UI."""


def _env(name: str) -> str:
    """Read a credential, trimming surrounding whitespace.

    Pasting into a hosting dashboard very easily carries a trailing newline or
    space along with it, and Google then rejects the request as invalid_client
    with no hint that the value merely has an invisible character on the end.
    """
    return (os.environ.get(name) or "").strip()


def client_id() -> str:
    return _env("YT_CLIENT_ID")


def client_secret() -> str:
    return _env("YT_CLIENT_SECRET")


def is_configured() -> bool:
    return bool(client_id() and client_secret())


def credentials_report() -> dict:
    """Shape-only description of the configured credentials, for diagnosing a
    failed connection without ever exposing the secret itself.

    Reports whether each value looks like what Google issues and whether it
    arrived with stray whitespace — the two things that actually go wrong —
    but never any of the characters.
    """
    raw_id = os.environ.get("YT_CLIENT_ID") or ""
    raw_secret = os.environ.get("YT_CLIENT_SECRET") or ""
    cid, secret = raw_id.strip(), raw_secret.strip()
    return {
        "client_id_present": bool(cid),
        "client_id_looks_right": cid.endswith(".apps.googleusercontent.com"),
        "client_id_length": len(cid),
        "client_id_had_whitespace": raw_id != cid,
        "client_secret_present": bool(secret),
        "client_secret_looks_right": secret.startswith("GOCSPX-"),
        "client_secret_length": len(secret),
        "client_secret_had_whitespace": raw_secret != secret,
        # The classic mix-up: the two values pasted into each other's box.
        "values_look_swapped": (
            cid.startswith("GOCSPX-") or secret.endswith(".apps.googleusercontent.com")
        ),
        "redirect_uri": (os.environ.get("PUBLIC_BACKEND_URL") or "").rstrip("/") + "/api/youtube/callback",
    }


def redirect_uri() -> str:
    base = (os.environ.get("PUBLIC_BACKEND_URL") or "").rstrip("/")
    if not base:
        raise YouTubeError("PUBLIC_BACKEND_URL is not set")
    return f"{base}/api/youtube/callback"


def authorize_url(state: str) -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": client_id(),
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        # offline + consent is what actually yields a refresh token. Without
        # prompt=consent Google omits it on every authorisation after the
        # first, and the connection then dies an hour later with no way back.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def _explain(resp: httpx.Response) -> str:
    """Turn a Google API error into something readable and diagnosable."""
    try:
        body = resp.json()
    except Exception:
        logger.error(f"YouTube API {resp.status_code}, non-JSON body: {resp.text[:500]}")
        return f"HTTP {resp.status_code}: {resp.text[:200]}"

    logger.error(f"YouTube API {resp.status_code} error: {body}")
    err = body.get("error", {}) or {}

    # Two shapes exist: the OAuth endpoints return {"error", "error_description"}
    # as plain strings, the Data API returns {"error": {"message", "errors"}}.
    if isinstance(err, str):
        desc = body.get("error_description") or err
        return f"{desc} [{err}]"

    reason = ""
    details = err.get("errors") or []
    if details and isinstance(details, list):
        reason = details[0].get("reason", "") or ""
    msg = err.get("message") or str(body)[:200]

    parts = [msg]
    if reason:
        parts.append(f"[{reason}]")
    hint = _HINTS.get(reason)
    if hint:
        parts.append(f"— {hint}")
    return " ".join(parts)


# Plain-English guidance for the reasons that actually come up when uploading.
_HINTS = {
    "quotaExceeded": "the daily YouTube API quota is used up — it resets at midnight Pacific",
    "uploadLimitExceeded": "this channel has hit its daily upload limit — try again tomorrow",
    "forbidden": "the account did not grant upload permission — reconnect YouTube",
    "authError": "the YouTube access token is invalid or expired — reconnect YouTube",
    "youtubeSignupRequired": "this Google account has no YouTube channel — create one first",
    "invalidVideoMetadata": "YouTube rejected the title/description — check for invalid characters",
    "invalidCategoryId": "the configured YT_CATEGORY_ID is not valid",
    "mediaBodyRequired": "the video file was empty or unreadable",
    "failedPrecondition": "the video file did not match the declared size or type",
}


# ---------- OAuth ----------
async def exchange_code(code: str) -> dict:
    """Authorization code -> access token + refresh token."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(TOKEN_URL, data={
            "client_id": client_id(),
            "client_secret": client_secret(),
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri(),
            "code": code,
        })
        if r.status_code != 200:
            raise YouTubeError(f"Token exchange failed: {_explain(r)}")
        data = r.json()

    if not data.get("refresh_token"):
        # Without this the connection silently stops working after ~1 hour.
        raise YouTubeError(
            "Google did not return a refresh token. Remove ViralGrid at "
            "myaccount.google.com/permissions and connect again."
        )
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "expires_in": int(data.get("expires_in", 3600)),
    }


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh token -> a fresh access token. Access tokens last ~1 hour, so
    this runs before essentially every upload."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(TOKEN_URL, data={
            "client_id": client_id(),
            "client_secret": client_secret(),
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        })
        if r.status_code != 200:
            raise YouTubeError(f"Could not refresh the YouTube token: {_explain(r)}")
        data = r.json()
    return {
        "access_token": data["access_token"],
        "expires_in": int(data.get("expires_in", 3600)),
    }


# ---------- Publishing ----------
def build_snippet(title: str, description: str, tags: list[str]) -> dict:
    """Metadata for the upload, trimmed to YouTube's field limits.

    A title longer than 100 characters is rejected outright rather than
    truncated by YouTube, so it is cut here where we can do it tidily.
    """
    clean_title = (title or "Untitled").strip()[:TITLE_LIMIT] or "Untitled"
    # Angle brackets are rejected by the API in both fields.
    clean_title = clean_title.replace("<", "").replace(">", "")
    clean_desc = (description or "").replace("<", "").replace(">", "")[:DESCRIPTION_LIMIT]
    return {
        "title": clean_title,
        "description": clean_desc,
        "tags": [t for t in (tags or []) if t][:50],
        "categoryId": os.environ.get("YT_CATEGORY_ID", "22"),
    }


async def upload_short(access_token: str, file_path: str, title: str,
                       description: str, tags: list[str],
                       privacy: Optional[str] = None) -> dict:
    """Upload a video via the resumable endpoint. Returns {"video_id", "url"}.

    Two steps: a session is opened with the metadata, then the bytes are sent
    to the one-off URL it returns.
    """
    path = Path(file_path)
    if not path.is_file():
        raise YouTubeError("The video file is no longer on the server — re-upload it and try again")
    size = path.stat().st_size
    if size == 0:
        raise YouTubeError("The video file is empty")

    privacy_status = privacy or os.environ.get("YT_PRIVACY_STATUS", "public")
    body = {
        "snippet": build_snippet(title, description, tags),
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        },
    }

    started = time.monotonic()
    # Generous timeout: this pushes the whole file, unlike Instagram where we
    # only hand over a URL. A 300MB upload on a small instance is slow.
    async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=30.0)) as c:
        r = await c.post(
            UPLOAD_URL,
            params={"uploadType": "resumable", "part": "snippet,status"},
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
                "X-Upload-Content-Length": str(size),
                "X-Upload-Content-Type": "video/*",
            },
            content=json.dumps(body),
        )
        if r.status_code not in (200, 201):
            raise YouTubeError(f"Could not start the YouTube upload: {_explain(r)}")

        session_url = r.headers.get("Location") or r.headers.get("location")
        if not session_url:
            raise YouTubeError("YouTube did not return an upload URL")

        # Must be an *async* generator: httpx refuses a sync iterable on an
        # AsyncClient, and aiofiles keeps the disk reads off the event loop so
        # a large upload doesn't stall everything else the server is doing.
        async def file_chunks():
            async with aiofiles.open(path, "rb") as f:
                while chunk := await f.read(UPLOAD_CHUNK):
                    yield chunk

        r2 = await c.put(
            session_url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "video/*",
                "Content-Length": str(size),
            },
            content=file_chunks(),
        )
        if r2.status_code not in (200, 201):
            raise YouTubeError(f"YouTube upload failed: {_explain(r2)}")
        result = r2.json()

    video_id = result.get("id")
    if not video_id:
        raise YouTubeError("YouTube did not return a video id")

    took = time.monotonic() - started
    actual_privacy = (result.get("status") or {}).get("privacyStatus")
    logger.info(
        f"YouTube upload complete in {took:.1f}s video_id={video_id} "
        f"requested={privacy_status} actual={actual_privacy} size={size / 1024 / 1024:.1f}MB"
    )
    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/shorts/{video_id}",
        "privacy_status": actual_privacy,
        "requested_privacy": privacy_status,
        "took_seconds": round(took, 1),
    }
