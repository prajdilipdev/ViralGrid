"""Real Instagram publishing via the Instagram API with Instagram Login.

Uses the Business Login flow (no Facebook Page required) and the Content
Publishing API. Docs:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
  https://developers.facebook.com/docs/instagram-platform/content-publishing/

If IG_APP_ID / IG_APP_SECRET are not configured the module reports itself as
unconfigured and the caller falls back to simulated publishing.
"""
import os
import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger("instagram")

GRAPH = "https://graph.instagram.com"
API_VERSION = "v25.0"
AUTH_URL = "https://www.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"

SCOPES = "instagram_business_basic,instagram_business_content_publish"

# Container processing: poll once every few seconds, give up well before the
# HTTP request would time out. Most short reels finish in 10-60s.
POLL_INTERVAL_S = 5
POLL_TIMEOUT_S = 150


class InstagramError(Exception):
    """Raised with a human-readable message suitable for surfacing in the UI."""


def is_configured() -> bool:
    return bool(os.environ.get("IG_APP_ID") and os.environ.get("IG_APP_SECRET"))


def redirect_uri() -> str:
    base = (os.environ.get("PUBLIC_BACKEND_URL") or "").rstrip("/")
    if not base:
        raise InstagramError("PUBLIC_BACKEND_URL is not set")
    return f"{base}/api/instagram/callback"


def authorize_url(state: str) -> str:
    from urllib.parse import urlencode

    params = {
        "client_id": os.environ["IG_APP_ID"],
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def _explain(resp: httpx.Response) -> str:
    """Turn a Meta error response into something readable."""
    try:
        err = resp.json().get("error", {})
        msg = err.get("error_user_msg") or err.get("message") or resp.text
        return str(msg)
    except Exception:
        return resp.text[:300]


# ---------- OAuth ----------
async def exchange_code(code: str) -> dict:
    """Authorization code -> long-lived (60 day) access token."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(TOKEN_URL, data={
            "client_id": os.environ["IG_APP_ID"],
            "client_secret": os.environ["IG_APP_SECRET"],
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri(),
            "code": code,
        })
        if r.status_code != 200:
            raise InstagramError(f"Token exchange failed: {_explain(r)}")
        short = r.json()

        r = await c.get(f"{GRAPH}/access_token", params={
            "grant_type": "ig_exchange_token",
            "client_secret": os.environ["IG_APP_SECRET"],
            "access_token": short["access_token"],
        })
        if r.status_code != 200:
            raise InstagramError(f"Long-lived token exchange failed: {_explain(r)}")
        long_lived = r.json()

    return {
        "access_token": long_lived["access_token"],
        "expires_in": long_lived.get("expires_in", 60 * 24 * 3600),
        "user_id": str(short.get("user_id", "")),
    }


async def refresh_long_lived_token(token: str) -> dict:
    """Refresh a long-lived token (must be >24h old and unexpired)."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{GRAPH}/refresh_access_token", params={
            "grant_type": "ig_refresh_token",
            "access_token": token,
        })
        if r.status_code != 200:
            raise InstagramError(f"Token refresh failed: {_explain(r)}")
        data = r.json()
    return {"access_token": data["access_token"], "expires_in": data.get("expires_in", 60 * 24 * 3600)}


async def get_profile(token: str) -> dict:
    """Fetch the connected professional account's id and username."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{GRAPH}/{API_VERSION}/me", params={
            "fields": "user_id,username,account_type",
            "access_token": token,
        })
        if r.status_code != 200:
            raise InstagramError(f"Could not read Instagram profile: {_explain(r)}")
        data = r.json()
    return {
        # `user_id` is the IG professional account id used for publishing;
        # older responses only carry `id`.
        "ig_user_id": str(data.get("user_id") or data.get("id") or ""),
        "username": data.get("username", ""),
        "account_type": data.get("account_type"),
    }


# ---------- Publishing ----------
async def publish(token: str, ig_user_id: str, media_url: str, caption: str, is_video: bool) -> dict:
    """Create a media container, wait for processing, then publish it.

    Returns {"media_id", "permalink"}. Raises InstagramError with a readable
    message on any failure.
    """
    async with httpx.AsyncClient(timeout=120) as c:
        payload = {"caption": caption[:2200], "access_token": token}
        if is_video:
            payload["media_type"] = "REELS"
            payload["video_url"] = media_url
        else:
            payload["image_url"] = media_url

        r = await c.post(f"{GRAPH}/{API_VERSION}/{ig_user_id}/media", data=payload)
        if r.status_code != 200:
            raise InstagramError(f"Container creation failed: {_explain(r)}")
        container_id = r.json()["id"]

        # Images are usually ready immediately; videos need transcoding.
        waited = 0
        while waited < POLL_TIMEOUT_S:
            r = await c.get(f"{GRAPH}/{API_VERSION}/{container_id}", params={
                "fields": "status_code,status", "access_token": token,
            })
            if r.status_code != 200:
                raise InstagramError(f"Status check failed: {_explain(r)}")
            status = r.json().get("status_code")
            if status == "FINISHED":
                break
            if status in ("ERROR", "EXPIRED"):
                detail = r.json().get("status") or status
                raise InstagramError(f"Instagram rejected the media: {detail}")
            await asyncio.sleep(POLL_INTERVAL_S)
            waited += POLL_INTERVAL_S
        else:
            raise InstagramError(
                f"Instagram was still processing after {POLL_TIMEOUT_S}s — "
                "try again, or use a shorter/smaller video"
            )

        r = await c.post(f"{GRAPH}/{API_VERSION}/{ig_user_id}/media_publish", data={
            "creation_id": container_id, "access_token": token,
        })
        if r.status_code != 200:
            raise InstagramError(f"Publish failed: {_explain(r)}")
        media_id = r.json()["id"]

        permalink = None
        try:
            r = await c.get(f"{GRAPH}/{API_VERSION}/{media_id}", params={
                "fields": "permalink", "access_token": token,
            })
            if r.status_code == 200:
                permalink = r.json().get("permalink")
        except Exception:
            pass

    return {"media_id": media_id, "permalink": permalink}


async def get_insights(token: str, media_id: str) -> dict:
    """Best-effort real metrics for a published post."""
    metrics = "views,likes,comments,shares"
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{GRAPH}/{API_VERSION}/{media_id}/insights", params={
                "metric": metrics, "access_token": token,
            })
            if r.status_code != 200:
                return {}
            out = {}
            for item in r.json().get("data", []):
                values = item.get("values") or [{}]
                out[item["name"]] = values[0].get("value", 0)
            return out
    except Exception as e:
        logger.warning(f"Insights fetch failed for {media_id}: {e}")
        return {}
