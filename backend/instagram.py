"""Real Instagram publishing via the Instagram API with Instagram Login.

Uses the Business Login flow (no Facebook Page required) and the Content
Publishing API. Docs:
  https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
  https://developers.facebook.com/docs/instagram-platform/content-publishing/

If IG_APP_ID / IG_APP_SECRET are not configured the module reports itself as
unconfigured and the caller falls back to simulated publishing.
"""
import os
import time
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

# Container processing. A fixed 5s interval measured better than an adaptive
# one (average extra wait 2.05s vs 2.60s), and Meta's guidance is to poll far
# less often than this, so there is nothing to gain by checking harder — the
# wait is Instagram's own transcoding, not our polling.
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
    """Turn a Meta error response into something readable *and* diagnosable.

    Meta's human-facing text is often vague ("API access blocked"), so keep the
    numeric code/subcode too — that is what actually identifies the problem —
    and log the raw body for anything the message doesn't cover.
    """
    try:
        body = resp.json()
    except Exception:
        logger.error(f"Instagram API {resp.status_code}, non-JSON body: {resp.text[:500]}")
        return f"HTTP {resp.status_code}: {resp.text[:200]}"

    err = body.get("error", {}) or {}
    logger.error(f"Instagram API {resp.status_code} error: {body}")

    msg = err.get("error_user_msg") or err.get("message") or str(body)[:200]
    title = err.get("error_user_title")
    code, subcode = err.get("code"), err.get("error_subcode")

    parts = [f"{title}: {msg}" if title and title not in str(msg) else str(msg)]
    ident = ", ".join(
        f"{k} {v}" for k, v in (("code", code), ("subcode", subcode)) if v is not None
    )
    if ident:
        parts.append(f"[{ident}]")
    hint = _HINTS.get(code) or _HINTS.get(subcode)
    if hint:
        parts.append(f"— {hint}")
    return " ".join(parts)


# Plain-English guidance for the codes that actually come up when publishing.
_HINTS = {
    190: "the Instagram access token is invalid or expired — reconnect Instagram",
    200: "the app lacks permission to publish — check the Instagram Tester role and scopes",
    10: "permission not granted for this action — the account may need to re-authorise",
    4: "Instagram rate limit reached — wait and retry",
    32: "Instagram rate limit reached — wait and retry",
    9007: "publishing limit reached (100 posts per 24h)",
    2207052: "Instagram could not download the video from the media URL",
    2207003: "Instagram could not fetch the media file",
    2207020: "the media URL was unreachable or timed out",
    2207026: "unsupported video format — must be MP4/MOV, H.264 + AAC",
}


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
    started = time.monotonic()
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

        t_container = time.monotonic() - started
        logger.info(f"IG container {container_id} created in {t_container:.1f}s")

        # Images are usually ready immediately; videos need transcoding on
        # Instagram's side, which is where most of the wait actually happens.
        waited = 0.0
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
        logger.info(f"IG finished processing after {waited:.1f}s of waiting")

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

    total = time.monotonic() - started
    logger.info(
        f"IG publish complete in {total:.1f}s total "
        f"(container {t_container:.1f}s, processing {waited:.1f}s) media_id={media_id}"
    )
    return {"media_id": media_id, "permalink": permalink, "took_seconds": round(total, 1)}


async def media_exists(token: str, media_id: str) -> Optional[bool]:
    """Is this published media still live on Instagram?

    True  = still there
    False = deleted by the user on Instagram
    None  = couldn't tell (expired token, rate limit, network) — callers must
            NOT treat this as a deletion.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{GRAPH}/{API_VERSION}/{media_id}", params={
                "fields": "id", "access_token": token,
            })
    except Exception as e:
        logger.warning(f"media_exists network error for {media_id}: {e}")
        return None

    if r.status_code == 200:
        return True
    try:
        err = r.json().get("error", {})
    except Exception:
        return None
    code, subcode = err.get("code"), err.get("error_subcode")
    # 100/33 and 803 mean the object is gone (or never existed).
    if code in (100, 803) or subcode == 33:
        return False
    # 190 = bad/expired token, 4/17/32 = rate limits — inconclusive.
    logger.warning(f"media_exists inconclusive for {media_id}: {err}")
    return None


def _metric_value(item: dict) -> int:
    """Pull the number out of an insights item, whichever shape it arrives in."""
    if isinstance(item.get("value"), (int, float)):
        return int(item["value"])
    values = item.get("values")
    if isinstance(values, list) and values and isinstance(values[0], dict):
        v = values[0].get("value")
        if isinstance(v, (int, float)):
            return int(v)
    # total_value is used by some metrics
    tv = item.get("total_value")
    if isinstance(tv, dict) and isinstance(tv.get("value"), (int, float)):
        return int(tv["value"])
    return 0


async def get_insights(token: str, media_id: str) -> dict:
    """Real metrics for a published post.

    Instagram reports a metric either as {"value": N} directly on the item or as
    {"values": [{"value": N}]}, depending on the metric and API version. Reading
    only one shape silently produces zeros even though the call succeeded, so
    both are handled here.

    Falls back to the media object's own like/comment counts when the insights
    edge is unavailable — insights are restricted for some accounts and for
    media with very few viewers, and those counts always work.
    """
    out: dict = {}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{GRAPH}/{API_VERSION}/{media_id}/insights", params={
                "metric": "views,likes,comments,shares", "access_token": token,
            })
            if r.status_code == 200:
                data = r.json().get("data", [])
                for item in data:
                    name = item.get("name")
                    if name:
                        out[name] = _metric_value(item)
                if not out:
                    logger.warning(f"Insights returned no usable metrics for {media_id}: {r.text[:300]}")
            else:
                # Don't fail silently — this is why zeros showed up unexplained.
                logger.warning(f"Insights unavailable for {media_id}: {_explain(r)}")

            # Like/comment counts live on the media object and are always readable.
            r2 = await c.get(f"{GRAPH}/{API_VERSION}/{media_id}", params={
                "fields": "like_count,comments_count", "access_token": token,
            })
            if r2.status_code == 200:
                m = r2.json()
                if m.get("like_count") is not None:
                    out.setdefault("likes", m["like_count"])
                    out["likes"] = max(out.get("likes", 0), m["like_count"])
                if m.get("comments_count") is not None:
                    out["comments"] = max(out.get("comments", 0), m["comments_count"])
    except Exception as e:
        logger.warning(f"Insights fetch failed for {media_id}: {e}")

    if out:
        logger.info(f"IG metrics for {media_id}: {out}")
    return out
