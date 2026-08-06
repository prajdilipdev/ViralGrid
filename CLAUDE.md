# ViralGrid — working notes

Context for anyone (human or AI) picking this project up. `README.md` covers setup and
deployment; this file records the decisions behind the code, and the traps that have
already been hit, so they aren't re-litigated or re-broken.

## What this is

A private, single-user tool for scheduling and publishing short-form video. Not a
product. Sign-in is restricted to `ALLOWED_EMAILS`; there is no registration path.

Instagram Reels and YouTube Shorts publish for real. The other five platforms are
simulated — their Connect button records a local connection and publishing fabricates a
result. That is deliberate, not unfinished.

## The one rule that governs the media pipeline

**Do not re-encode a video that the platform would have accepted as-is.** The user's
priority is that the original file reaches the platform untouched. Every check in
`platforms.py` exists to answer one question: does this genuinely need transforming?
A check that triggers unnecessarily is a bug, and several have been:

- `max(w, h)` against Instagram's pixel cap measured the *height* of portrait video.
  Meta caps *columns* — width only. Ordinary 1440x2560 footage was being re-encoded.
- The size cap was set to 1000MB citing a 1GB Instagram limit that does not exist. The
  real figure is 300MB, so oversized files passed local validation and were rejected by
  Instagram instead — further from the upload and harder to explain.
- YouTube's duration cap sat at 60s more than a year after YouTube raised Shorts to 180s.

When a limit is in question, check the platform's own spec rather than adjusting the
number until the symptom goes away. Both platforms' specs are linked from `README.md`.

`transform: "passthrough"` still runs a **lossless** faststart remux (`-c copy`) because
Meta requires the moov atom at the front. Video and audio streams are byte-identical;
only the container index moves.

## Architecture notes that are easy to get wrong

**The two platforms are opposites.** Instagram *fetches* the video from
`/api/media/file/{filename}`, so `PUBLIC_BACKEND_URL` must be public HTTPS and the file
must still exist when Instagram gets round to downloading it. YouTube is the reverse —
the bytes are pushed to it. Anything about "the upload" means different things for each.

**Uploads are streamed, and must stay that way.** `youtube.py` passes an *async*
generator to httpx; a sync one raises at runtime on an `AsyncClient`. Files are read via
`aiofiles` so a 300MB upload doesn't block the event loop.

**Local disk is ephemeral.** Render wipes it on every deploy. Files are copied into
GridFS and restored on demand, but only up to `MEDIA_DB_MAX_MB` (default 60) — above
that a file will not survive a restart. This is a live gap: the Instagram size cap is
300MB, so a 100MB reel is accepted but not durably stored. The correct fix is object
storage, not a larger GridFS ceiling (free Atlas is 512MB in total).

**`/api/health` reports the running commit** via `RENDER_GIT_COMMIT`. Use it to confirm a
backend deploy actually landed — authenticated routes answer 401 whether or not new code
is live, and a missing route falls through to an existing one instead of 404ing.

## CSS: the trap that has bitten twice

`index.css` is loaded **after** Tailwind's utilities, so at equal specificity its classes
beat utility classes. `.vg-panel` setting `position: relative` silently overrode `fixed`
and `sticky` wherever they were combined — the server status bar was laid out in page
flow instead of pinned, and the Composer's preview panel never stuck. `.vg-panel` now
sets no `position` at all (its top-light is a background gradient rather than a
positioned pseudo-element).

If a utility class appears to do nothing on an element carrying a `vg-` class, this is
why. Prefer fixing the `vg-` class over adding `!important`.

Theme colours resolve through CSS variables so both modes work from one set of
utilities — `white` and `ink-*` are remapped in `tailwind.config.js` to
`rgb(var(--vg-…))`. Hard-coding a hex undoes that for one of the two themes.

Both themes are held to WCAG AA. Light mode needs *higher* alpha than dark for the same
contrast, and the film-grain overlay sits above content and costs roughly 0.4 of a
contrast ratio — the muted text tiers are solved with that included.

## Verification expectations

This codebase has been debugged largely by measurement rather than inspection, and that
has repeatedly turned up faults that reading the code did not:

- Check computed styles in a browser, not the CSS source. Contrast bugs and the
  `position` override were both invisible in the stylesheet.
- Elements with CSS transitions report their *pre-transition* value when the page isn't
  compositing. Disable transitions before measuring, or the reading is wrong.
- The frontend bundle hash differs from a local build because Render compiles with its
  own env. Verify deploys by content, not by hash.
- CSS minification writes `:before`, not `::before`. Grepping for the authored form gives
  a false negative.

## Open items

- **Range requests** — the media endpoint ignores `Range` and returns whole files,
  because `starlette` is pinned at 0.37.2. Fixing it means a framework bump and a full
  smoke test.
- **YouTube audit** — until Google approves it, every upload is force-locked to Private
  and cannot be appealed. The app flags affected posts rather than pretending they
  published.
- **Durability gap** — see `MEDIA_DB_MAX_MB` above.

## Conventions

Commit messages carry the reasoning, not just the change — they are the project's
decision log, and `git log` is the best available history of why things are as they are.
Secrets never enter the repo; only `.env.example` files are tracked.
