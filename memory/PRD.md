# PRD — CROSSPOST: Private Social Media Publishing Platform

## Original Problem Statement
Build a private full-stack social media publishing platform for personal use. Upload videos/images/reels/shorts/posts, enter captions/descriptions/hashtags/tags/thumbnails/platform metadata once, publish to selected platforms with one click (YouTube Shorts, Instagram Reels, Facebook Reels, X, Pinterest, TikTok, LinkedIn). Include auth, media storage, drafts, post history, analytics, error handling, retries, platform customization, advanced scheduling (one-time, recurring, bulk, timezone, calendar, queue, auto-publish), intelligent FFmpeg media optimization engine with quality validation, and a modern unified dashboard.

## User Choices
- Publishing engine: SIMULATED (mock platform connections; real API keys can be added later)
- Auth: Emergent-managed Google social login
- Media processing: REAL FFmpeg (ffprobe analysis, thumbnails, per-platform transcode)
- AI captions/hashtags: Emergent LLM key (gpt-5.4)
- Scheduling: APScheduler background auto-publish (30s tick)

## Architecture
- FastAPI backend (`/app/backend/server.py`) + MongoDB (motor) + APScheduler
- `platforms.py`: platform specs (aspect/resolution/duration/size/caption limits) + validation + optimization plans
- `media_utils.py`: ffprobe/ffmpeg wrappers (probe, thumbnail, transcode with pad/scale)
- React frontend (CRA + Tailwind + shadcn + recharts + dayjs), dark "Swiss Brutalist / Cyber Noir" theme per /app/design_guidelines.json
- Media stored on disk at /app/backend/uploads (thumbs/, optimized/)

## Collections
users, user_sessions, connections, media, posts

## Implemented (June 2026 — MVP)
- Google OAuth (Emergent), session cookies, protected routes
- Simulated platform connections (7 platforms)
- Media upload with real ffprobe analysis + thumbnail generation
- Per-platform quality validation panel (aspect, duration, size checks)
- Publishing engine: real FFmpeg transcode (pad/scale to platform specs, dedupe cache), mock delivery with simulated metrics, per-platform results, attempts counter
- Drafts, publish-now, one-time + recurring (daily/weekly) scheduling with timezone support
- Background scheduler auto-publishes due posts every 30s; recurrence clones next occurrence
- Retry failed platforms; partial/failed status handling
- AI copywriter (caption/description/hashtags) via gpt-5.4
- Pages: Dashboard (stats/platform status/queue), Composer, Calendar + queue, History (filters, expand, retry, delete), Analytics (KPIs, charts, per-platform table), Connections, Login
- Tested: 19/19 backend tests, all frontend flows (iteration_1)

## Implemented (Feb 2026 — Bulk Scheduling)
- `POST /api/posts/bulk` — creates up to 200 scheduled posts in one call, per-item validation with error report
- New `/bulk` page (nav sidebar "Bulk") with unified UI:
  - Shared Defaults (title prefix, timezone, recurrence, caption, hashtags, default platforms)
  - Three modes: Multi-media (pick many + cycle across slots), Slot Template (single media across slots), CSV Import
  - Slot pattern picker: "Days × Times" (date range × day-of-week × times-of-day) OR "Interval + Count" (start + every N units × count)
  - Inline-editable preview table (title, datetime, media, per-row platform chips, caption) with duplicate/delete/add-row
  - Scheduled bulk posts flow into existing calendar queue + APScheduler auto-publish
- Tested: 7/7 new backend bulk tests + prior 19 backend + all frontend flows green (iteration_2)

## Backlog
- P0: none remaining for MVP
- P1: Real platform OAuth integrations (when user obtains developer credentials); custom thumbnail upload/selection per post
- P2: Media library reuse in composer; edit scheduled/draft posts in composer; brand kit (watermark/intro); download optimized platform versions; email notifications on publish failures
- Bulk enhancements (nice-to-have): CSV quoted-comma support, ownership validation for media_ids, warn if item platforms not connected before scheduling

## Next Tasks
1. Await user feedback on Bulk Scheduling
2. P1 items above
