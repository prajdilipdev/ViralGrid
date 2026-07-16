"""
Tests for the Bulk Scheduling feature: POST /api/posts/bulk.
Covers: happy path, empty items 400, 200-item limit, invalid rows partial errors,
persistence via GET /api/posts, and scheduler auto-publish for past-dated bulk items.
"""
import os
import time
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
API = f"{BASE}/api"
TOKEN = "test_session_e2e_token"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def _future_iso(mins=60):
    return (datetime.now(timezone.utc) + timedelta(minutes=mins)).isoformat()


def _past_iso(mins=1):
    return (datetime.now(timezone.utc) - timedelta(minutes=mins)).isoformat()


class TestBulkValidation:
    def test_empty_items_400(self):
        r = requests.post(f"{API}/posts/bulk", headers=HEADERS, json={"items": []}, timeout=15)
        assert r.status_code == 400
        assert "no items" in r.json().get("detail", "").lower()

    def test_over_limit_400(self):
        items = [{
            "title": f"TEST_bulk_over {i}", "platforms": ["youtube_shorts"],
            "scheduled_at": _future_iso(30 + i), "timezone": "UTC",
        } for i in range(201)]
        r = requests.post(f"{API}/posts/bulk", headers=HEADERS, json={"items": items}, timeout=30)
        assert r.status_code == 400
        assert "200" in r.json().get("detail", "")

    def test_unauth_401(self):
        r = requests.post(f"{API}/posts/bulk", json={"items": [{
            "title": "x", "platforms": ["youtube_shorts"], "scheduled_at": _future_iso()}]}, timeout=15)
        assert r.status_code == 401


class TestBulkCreate:
    def test_happy_path_creates_scheduled_posts(self):
        # ensure connection
        requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "youtube_shorts"}, timeout=15)
        items = [{
            "title": f"TEST_bulk_happy {i}", "caption": "cap", "hashtags": ["a", "b"],
            "platforms": ["youtube_shorts"], "scheduled_at": _future_iso(60 + i * 5),
            "timezone": "UTC", "recurrence": "none",
        } for i in range(3)]
        r = requests.post(f"{API}/posts/bulk", headers=HEADERS, json={"items": items}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created_count"] == 3
        assert len(d["created"]) == 3
        assert d["errors"] == []
        for c in d["created"]:
            assert c["post_id"].startswith("post_")
        pytest.bulk_ids = [c["post_id"] for c in d["created"]]

    def test_bulk_posts_appear_in_list_with_status_scheduled(self):
        assert getattr(pytest, "bulk_ids", None)
        r = requests.get(f"{API}/posts", headers=HEADERS, timeout=15)
        assert r.status_code == 200
        posts = {p["post_id"]: p for p in r.json()}
        for pid in pytest.bulk_ids:
            assert pid in posts, f"{pid} missing from /posts list"
            assert posts[pid]["status"] == "scheduled"
            assert posts[pid]["title"].startswith("TEST_bulk_happy")

    def test_partial_invalid_rows_reported(self):
        items = [
            {"title": "TEST_bulk_ok", "platforms": ["youtube_shorts"], "scheduled_at": _future_iso(120)},
            {"title": "", "platforms": ["youtube_shorts"], "scheduled_at": _future_iso(130)},  # bad title
            {"title": "TEST_bulk_noplatform", "platforms": [], "scheduled_at": _future_iso(140)},  # no platform
            {"title": "TEST_bulk_badtime", "platforms": ["youtube_shorts"], "scheduled_at": "not-a-date"},
        ]
        r = requests.post(f"{API}/posts/bulk", headers=HEADERS, json={"items": items}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created_count"] == 1
        assert len(d["errors"]) == 3
        idxs = {e["index"] for e in d["errors"]}
        assert idxs == {1, 2, 3}


class TestBulkScheduler:
    def test_past_scheduled_bulk_gets_autopublished(self):
        requests.post(f"{API}/connections", headers=HEADERS, json={"platform": "youtube_shorts"}, timeout=15)
        items = [{
            "title": "TEST_bulk_past", "caption": "auto",
            "platforms": ["youtube_shorts"], "scheduled_at": _past_iso(1),
            "timezone": "UTC", "recurrence": "none",
        }]
        r = requests.post(f"{API}/posts/bulk", headers=HEADERS, json={"items": items}, timeout=15)
        assert r.status_code == 200
        pid = r.json()["created"][0]["post_id"]

        published = False
        for _ in range(14):
            time.sleep(5)
            rr = requests.get(f"{API}/posts/{pid}", headers=HEADERS, timeout=15)
            if rr.status_code == 200 and rr.json()["status"] in ("published", "partial"):
                published = True
                break
        assert published, "Bulk-scheduled past post was not auto-published within 70s"
