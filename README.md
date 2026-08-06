# ViralGrid — Social Media Cross-Posting Suite

Upload once, optimize automatically (ffmpeg), and publish to YouTube Shorts, Instagram Reels, TikTok, X, Facebook Reels, Pinterest and LinkedIn — with scheduling, bulk scheduling (CSV / slot templates), analytics and AI copy generation.

> **Note:** **Instagram publishes for real** when configured (see below). The other six platforms are **simulated** — no real API calls. Media optimization via ffmpeg is real throughout.

## Stack

- **Backend** — FastAPI + MongoDB (Motor), APScheduler for scheduled publishing, ffmpeg for probing/thumbnails/transcoding. Lives in [`backend/`](backend).
- **Frontend** — React 19 (CRA + craco), Tailwind, shadcn/ui, react-router 7. Lives in [`frontend/`](frontend).
- **Auth** — Google sign-in brokered by Emergent's hosted auth service (`auth.emergentagent.com`). No Google OAuth credentials of your own are needed.
- **AI copy generation (optional)** — requires an Emergent LLM key and the private `emergentintegrations` package. Without them, the app runs fine and the AI endpoint returns 503.

## Run locally

Prerequisites: Python 3.11+, Node 20+, yarn, ffmpeg on PATH, and a MongoDB instance (local or [Atlas](https://www.mongodb.com/atlas)).

```bash
# Backend
cd backend
cp .env.example .env          # then edit MONGO_URL etc.
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (new terminal)
cd frontend
cp .env.example .env          # REACT_APP_BACKEND_URL=http://localhost:8000
yarn install
yarn start                    # opens http://localhost:3000
```

## Deploy to Render

The repo contains a [`render.yaml`](render.yaml) blueprint that creates two services:

| Service | Type | Notes |
|---|---|---|
| `viralgrid-backend` | Web service (Docker) | Python 3.11 + ffmpeg, runs uvicorn |
| `viralgrid-frontend` | Static site | CRA production build with SPA rewrite |

### 1. Create a MongoDB Atlas database (free)

1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a database user, and under **Network Access** allow `0.0.0.0/0` (Render's outbound IPs vary).
3. Copy the connection string: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`

### 2. Deploy the blueprint

1. Push this repo to GitHub.
2. In the [Render dashboard](https://dashboard.render.com): **New → Blueprint**, pick the repo. Render reads `render.yaml` and creates both services.
3. When prompted for environment variables:
   - **viralgrid-backend**
     - `MONGO_URL` — the Atlas connection string
     - `CORS_ORIGINS` — leave blank for now (set in step 3)
     - `EMERGENT_LLM_KEY` — optional (AI copy generation + Emergent object storage); leave blank to disable
   - **viralgrid-frontend**
     - `REACT_APP_BACKEND_URL` — leave blank for now (set in step 3)

### 3. Wire the two services together

After the first deploy you'll know both URLs (e.g. `https://viralgrid-backend.onrender.com` and `https://viralgrid-frontend.onrender.com`).

1. On **viralgrid-frontend** set `REACT_APP_BACKEND_URL` to the backend URL (no trailing slash) and redeploy — CRA bakes it in at build time.
2. On **viralgrid-backend** set `CORS_ORIGINS` to the frontend URL and redeploy.
3. Open the frontend URL and sign in with Google.

### Render caveats

- **Free-tier sleep** — free web services spin down after ~15 min idle. The in-process scheduler that auto-publishes due posts only runs while the backend is awake; overdue posts publish on the next wake-up. Use a paid instance (or an external uptime ping) if exact-time publishing matters.
- **Ephemeral disk** — uploaded media is stored on the service's local disk, which is wiped on every deploy/restart. Options: attach a Render persistent disk (paid; uncomment the `disk:` block in `render.yaml`), or set `EMERGENT_LLM_KEY` so files are backed up to Emergent object storage and restored on demand.
- **Cross-site cookies** — the session cookie is `SameSite=None; Secure`, which works on Render since both services are HTTPS. It will *not* work over plain HTTP.

## Enabling real Instagram publishing

Uses the [Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/) — **no Facebook Page required**.

### 1. Instagram account
Convert your account to **Business** or **Creator** (Instagram app → Settings → Account type). Personal accounts cannot publish via API.

### 2. Meta app
1. At [developers.facebook.com/apps](https://developers.facebook.com/apps) create an app → use case **"Other"** → type **Business**.
2. Add the **Instagram** product → **API setup with Instagram login**.
3. Under *Business login settings*, set the **OAuth redirect URI** to exactly:
   `https://<your-backend>.onrender.com/api/instagram/callback`
4. Add your Instagram account as an app user (Roles → Instagram Testers, then accept the invite in Instagram → Settings → Website permissions). While the app is in Development mode this lets you publish to your **own** account without Meta App Review.
5. Copy the **Instagram App ID** and **Instagram App Secret**.

### 3. Render env vars (backend)
| Variable | Value |
|---|---|
| `IG_APP_ID` | Instagram App ID |
| `IG_APP_SECRET` | Instagram App Secret |
| `PUBLIC_BACKEND_URL` | `https://<your-backend>.onrender.com` |

Redeploy, then open **Connections** — Instagram shows a **Live** badge. Click *Connect Account*, approve on Instagram, and you're linked. Publishing to Instagram now creates real posts.

### How it works / limits
- Publishing is the standard 3-step flow: create media container → poll until Instagram finishes processing → publish. Instagram **fetches your video from a public URL**, so `PUBLIC_BACKEND_URL` must be reachable and HTTPS.
- **Storage:** the uploads directory is ephemeral (wiped on every restart/redeploy), so each file is also copied into MongoDB and restored on demand — this is what keeps Instagram's fetch working after a redeploy. Files above `MEDIA_DB_MAX_MB` (default 60) are *not* copied and will be lost on restart; for those, use a persistent disk.
- Reels: 9:16, 5–90s. The app auto-transcodes to 1080x1920 before publishing.
- Access tokens last 60 days and are auto-refreshed every 12 hours by a background job.
- Instagram allows **100 API posts per 24 hours**.
- Leaving `IG_APP_ID`/`IG_APP_SECRET` unset keeps Instagram simulated like the rest.

## Enabling real YouTube Shorts publishing

Uses the [YouTube Data API v3](https://developers.google.com/youtube/v3/guides/uploading_a_video) with Google OAuth.

### 1. Google Cloud project
1. At [console.cloud.google.com](https://console.cloud.google.com) create a project.
2. Enable **YouTube Data API v3**.
3. **Google Auth Platform → Data Access** → add both scopes:
   - `https://www.googleapis.com/auth/youtube.upload` — performs the upload
   - `https://www.googleapis.com/auth/youtube.readonly` — reads back the connected channel's name only
4. **Audience** → add yourself as a test user, then **Publish app**. Left in *Testing*, Google expires the refresh token after 7 days and the connection has to be remade weekly.
5. **Clients** → create an **OAuth client ID** of type *Web application*, with the redirect URI exactly:
   `https://<your-backend>.onrender.com/api/youtube/callback`

### 2. Render env vars (backend)
| Variable | Value |
|---|---|
| `YT_CLIENT_ID` | OAuth client ID (ends `.apps.googleusercontent.com`) |
| `YT_CLIENT_SECRET` | OAuth client secret (starts `GOCSPX-`) |
| `PUBLIC_BACKEND_URL` | `https://<your-backend>.onrender.com` |

Then open **Connections** → *Connect Account* on YouTube Shorts. Google shows an
"unverified app" warning (expected for a private app — *Advanced → Go to …*), then an
account chooser.

### How it works / limits
- **Opposite of Instagram:** YouTube does not fetch from a URL, so the file is pushed to
  it — streamed from disk in 1MB chunks. Large uploads are correspondingly slower.
- **Pick the right channel.** A Google account can own a personal channel *and* Brand
  Accounts, and the token binds to whichever is chosen at consent. The Brand Account's
  name in the chooser may differ from the channel's current name. The app reads the
  channel back after connecting and shows it, so a wrong choice is visible immediately —
  `prompt=select_account` forces the chooser each time so it can be corrected.
- **Uploads are locked to Private** until the project passes Google's
  [API compliance audit](https://support.google.com/youtube/contact/yt_api_form), and this
  cannot be appealed. The app requests the real privacy status anyway, so uploads start
  going out correctly the day an audit passes; meanwhile it flags each affected post.
- Shorts are any vertical video ≤ **180s** (raised from 60s by YouTube in Oct 2024).
- Quota: `videos.insert` cost dropped in Dec 2025, so the default 10,000 units/day is
  roughly **100 uploads/day** rather than 6.
- Access tokens last ~1 hour and are refreshed on demand from the stored refresh token.
- Leaving `YT_CLIENT_ID`/`YT_CLIENT_SECRET` unset keeps YouTube simulated like the rest.

## Environment variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `MONGO_URL` | backend | yes | MongoDB connection string |
| `DB_NAME` | backend | no | Database name (default `viralgrid`) |
| `CORS_ORIGINS` | backend | production | Comma-separated allowed origins (defaults to `*`) |
| `ALLOWED_EMAILS` | backend | recommended | Comma-separated Google emails allowed to sign in (unset = anyone) |
| `IG_APP_ID` / `IG_APP_SECRET` | backend | no | Meta app credentials — enables real Instagram publishing |
| `YT_CLIENT_ID` / `YT_CLIENT_SECRET` | backend | no | Google OAuth client — enables real YouTube Shorts publishing |
| `YT_PRIVACY_STATUS` | backend | no | Privacy requested for uploads: `public` (default), `unlisted`, `private` |
| `YT_CATEGORY_ID` | backend | no | YouTube category id (default `22` People & Blogs; `20` is Gaming) |
| `PUBLIC_BACKEND_URL` | backend | with Instagram/YouTube | This backend's own https URL (OAuth redirects + Instagram media fetch) |
| `MEDIA_DB_MAX_MB` | backend | no | Max size kept as a durable MongoDB copy (default 60) |
| `EMERGENT_LLM_KEY` | backend | no | Enables AI copy generation + Emergent object storage |
| `REACT_APP_BACKEND_URL` | frontend (build time) | yes | Backend base URL; falls back to same-origin |

## Tests

```bash
cd backend
# E2E tests hit a running deployment:
REACT_APP_BACKEND_URL=http://localhost:8000 pytest tests/
```
