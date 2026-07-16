"""
E2E backend tests for the private social media publishing platform.

Covers: auth, connections, media upload/validate, AI generation,
publishing (success/failed/retry), drafts, scheduling+recurring,
dashboard stats, analytics.
"""
import os
import time
import subprocess
import tempfile
from pathlib import Path

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "https://media-dispatch-4.preview.emergentagent.com"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"
TOKEN = "test_session_e2e_token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

PLATFORMS_ALL = ["youtube_shorts", "instagram_reels", "facebook_reels", "tiktok", "twitter", "pinterest", "linkedin"]


@pytest.fixture(scope="session")
def sample_video():
    """Generate a small test video via ffmpeg."""
    path = Path(tempfile.gettempdir()) / "test_video_e2e.mp4"
    if not path.exists():
        subprocess.run(
            ["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=640x480:rate=24",
             "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path)],
            check=True, capture_output=True,
        )
    return path


# ---------- Auth ----------
class TestAuth:
    def test_me_with_token(self):
        r = requests.get(f"{API}/auth/me", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == "test-user-e2e"
        assert d["email"] == "test.user.e2e@example.com"

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_protected_endpoint_401(self):
        r = requests.get(f"{API}/connections", timeout=15)
        assert r.status_code == 401


# ---------- Platforms & Connections ----------
class TestConnections:
    def test_list_platforms(self):
        r = requests.get(f"{API}/platforms", timeout=15)
        assert r.status_code == 200
        data = r.json()
        ids = {p["id"] for p in data}
        assert set(PLATFORMS_ALL).issubset(ids), f"Missing: {set(PLATFORMS_ALL)-ids}"

    def test_connect_and_disconnect(self):
        # Connect linkedin
        r = requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "linkedin"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["platform"] == "linkedin"
        assert r.json()["status"] == "connected"

        # Verify list
        r = requests.get(f"{API}/connections", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        assert any(c["platform"] == "linkedin" for c in r.json())

        # Disconnect
        r = requests.delete(f"{API}/connections/linkedin", headers=HEADERS, timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{API}/connections", headers=HEADERS, timeout=15)
        assert not any(c["platform"] == "linkedin" for c in r.json())

    def test_connect_invalid_platform(self):
        r = requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "myspace"}, timeout=15)
        assert r.status_code == 400

    def test_ensure_youtube_tiktok_connected(self):
        # Idempotent - ensure baseline
        for p in ("youtube_shorts", "tiktok"):
            r = requests.post(f"{API}/connections", headers=HEADERS, json={"platform": p}, timeout=15)
            assert r.status_code == 200


# ---------- Media ----------
class TestMedia:
    def test_upload_video_ffprobe_thumbnail(self, sample_video):
        with open(sample_video, "rb") as f:
            r = requests.post(f"{API}/media/upload", headers=HEADERS,
                              files={"file": ("test.mp4", f, "video/mp4")}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "video"
        assert d["width"] == 640 and d["height"] == 480
        assert d["duration"] and d["duration"] > 1
        assert d["codec"]
        assert d["thumbnail"], "Thumbnail should be generated"
        pytest.media_id = d["media_id"]
        pytest.thumbnail = d["thumbnail"]

    def test_serve_thumbnail(self):
        assert getattr(pytest, "thumbnail", None)
        r = requests.get(f"{API}/media/file/{pytest.thumbnail}", timeout=15)
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_media_validate(self):
        assert getattr(pytest, "media_id", None)
        r = requests.post(f"{API}/media/validate", headers=HEADERS,
                          json={"media_id": pytest.media_id, "platforms": ["youtube_shorts", "twitter"]}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["validations"]) == 2
        for v in d["validations"]:
            assert "checks" in v
            assert "status" in v
            # Should contain aspect-ratio related check for youtube_shorts (portrait expected)
            levels = {c["level"] for c in v["checks"]}
            assert levels & {"ok", "warn", "error"}


# ---------- Publish ----------
class TestPublish:
    def test_publish_now_text_success(self):
        # Ensure youtube_shorts connected
        requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "youtube_shorts"}, timeout=15)
        r = requests.post(f"{API}/posts", headers=HEADERS, json={
            "title": "TEST_e2e text post",
            "caption": "hello world",
            "platforms": ["youtube_shorts"],
            "action": "publish",
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "published"
        assert d["platform_results"]["youtube_shorts"]["status"] == "published"
        assert d["platform_results"]["youtube_shorts"]["url"].startswith("https://")
        assert "metrics" in d["platform_results"]["youtube_shorts"]
        pytest.text_post_id = d["post_id"]

    def test_publish_with_video_transcode(self, sample_video):
        # Upload video (self-contained; do not depend on other tests)
        with open(sample_video, "rb") as f:
            ur = requests.post(f"{API}/media/upload", headers=HEADERS,
                               files={"file": ("test.mp4", f, "video/mp4")}, timeout=60)
        assert ur.status_code == 200
        media_id = ur.json()["media_id"]
        # 640x480 -> youtube_shorts is 1080x1920, expect transcode + optimized_file
        r = requests.post(f"{API}/posts", headers=HEADERS, json={
            "title": "TEST_e2e video post",
            "caption": "video test",
            "media_ids": [media_id],
            "platforms": ["youtube_shorts"],
            "action": "publish",
        }, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        pr = d["platform_results"]["youtube_shorts"]
        assert pr["status"] == "published"
        assert pr.get("optimization")
        assert pr.get("optimized_file"), f"Expected optimized_file, got {pr}"
        # verify file is served
        rf = requests.get(f"{API}/media/file/{pr['optimized_file']}", timeout=15)
        assert rf.status_code == 200

    def test_publish_to_disconnected_platform_fails(self):
        # Disconnect pinterest first (idempotent)
        requests.delete(f"{API}/connections/pinterest", headers=HEADERS, timeout=15)
        r = requests.post(f"{API}/posts", headers=HEADERS, json={
            "title": "TEST_e2e disconnected",
            "caption": "should fail",
            "platforms": ["pinterest"],
            "action": "publish",
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "failed"
        assert d["platform_results"]["pinterest"]["status"] == "failed"
        assert "not connected" in d["platform_results"]["pinterest"]["error"].lower()
        pytest.failed_post_id = d["post_id"]

    def test_retry_after_connecting(self):
        assert getattr(pytest, "failed_post_id", None)
        # Now connect pinterest
        requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "pinterest"}, timeout=15)
        r = requests.post(f"{API}/posts/{pytest.failed_post_id}/retry", headers=HEADERS, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["platform_results"]["pinterest"]["status"] == "published"
        assert d["status"] in ("published", "partial")

    def test_draft_then_publish(self):
        r = requests.post(f"{API}/posts", headers=HEADERS, json={
            "title": "TEST_e2e draft",
            "caption": "draft caption",
            "platforms": ["youtube_shorts"],
            "action": "draft",
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "draft"
        pid = d["post_id"]

        r = requests.post(f"{API}/posts/{pid}/publish", headers=HEADERS, timeout=60)
        assert r.status_code == 200
        assert r.json()["status"] == "published"


# ---------- Scheduling & Recurring ----------
class TestScheduling:
    def test_schedule_past_gets_autopublished(self):
        from datetime import datetime, timezone, timedelta
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        r = requests.post(f"{API}/posts", headers=HEADERS, json={
            "title": "TEST_e2e scheduled",
            "caption": "scheduled post",
            "platforms": ["youtube_shorts"],
            "action": "schedule",
            "scheduled_at": past,
            "recurrence": "daily",
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "scheduled"
        pid = d["post_id"]

        # Poll up to ~65s
        published = False
        for _ in range(14):
            time.sleep(5)
            rr = requests.get(f"{API}/posts/{pid}", headers=HEADERS, timeout=15)
            if rr.status_code == 200 and rr.json()["status"] in ("published", "partial"):
                published = True
                break
        assert published, "Scheduler did not publish within 70s"

        # Recurring clone check
        rr = requests.get(f"{API}/posts", headers=HEADERS, timeout=15)
        assert rr.status_code == 200
        clones = [p for p in rr.json()
                  if p["title"] == "TEST_e2e scheduled" and p["status"] == "scheduled"]
        assert len(clones) >= 1, "Expected a new scheduled clone from daily recurrence"


# ---------- AI ----------
class TestAI:
    def test_ai_generate(self):
        r = requests.post(f"{API}/ai/generate", headers=HEADERS, json={
            "topic": "morning coffee routine",
            "platforms": ["youtube_shorts", "tiktok"],
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["caption"]
        assert d["description"]
        assert isinstance(d["hashtags"], list) and len(d["hashtags"]) >= 3


# ---------- Dashboard & Analytics ----------
class TestAnalytics:
    def test_dashboard_stats(self):
        r = requests.get(f"{API}/dashboard/stats", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_posts", "published", "scheduled", "drafts", "failed", "connected_platforms", "total_views"):
            assert k in d
        assert d["total_posts"] >= 1
        assert d["connected_platforms"] >= 1

    def test_analytics_overview(self):
        r = requests.get(f"{API}/analytics/overview", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "totals" in d and "per_platform" in d and "timeline" in d
        assert isinstance(d["per_platform"], list)
