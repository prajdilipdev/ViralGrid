PLATFORM_SPECS = {
    "youtube_shorts": {
        "name": "YouTube Shorts", "aspect": "9:16", "width": 1080, "height": 1920,
        # 180s, not 60: YouTube raised the Shorts ceiling to three minutes in
        # October 2024, and any vertical video at or under it is treated as a
        # Short automatically. The old 60 was rejecting videos YouTube accepts.
        "max_duration": 180,
        # YouTube's real per-file limit is measured in gigabytes, so 256MB was
        # never its rule. It also collided with the new duration: 180s at
        # 12000k is ~270MB, which would have tripped the "can't be compressed
        # under the cap" error on a file YouTube would have taken happily.
        "max_size_mb": 1024,
        "caption_limit": 100, "hashtag_limit": 15,
        "video_bitrate_k": 12000, "codec": "h264", "color": "#FF0000",
    },
    "instagram_reels": {
        "name": "Instagram Reels", "aspect": "9:16", "width": 1080, "height": 1920,
        # 300MB, not the 1GB this used to claim. Meta's Reel specs state
        # "File size: 300MB maximum" with no exemption for the hosted-URL
        # method we use, so 1000 meant a large video passed validation here and
        # was then rejected by Instagram — a worse failure, and further from the
        # upload. Re-encoding a >300MB video isn't the wasted work the old
        # comment assumed; it's the only way it publishes at all.
        # 900s is the API's actual ceiling (Meta documents Reels as 3s-15min).
        # The old 90s figure wasn't the API limit though — it's the window in
        # which a 9:16 video is eligible for the Reels *tab*. Past it the post
        # still publishes, just as a regular video rather than a Reel. That's a
        # trade worth making knowingly, so it's a warning below, not a block.
        "max_duration": 900, "reels_tab_max_duration": 90,
        # Meta's spec: "3 seconds minimum", and "Maximum columns (horizontal
        # pixels): 1920". A source wider than that is rejected on their side
        # however well-formed it otherwise is, so it has to be caught here.
        "min_duration": 3, "max_width": 1920,
        "max_size_mb": 300, "caption_limit": 2200, "hashtag_limit": 30,
        # 12000 rather than 8000: measured SSIM 0.9988 vs 0.9969 against the
        # source, for no extra encode time. Instagram re-compresses anyway, so
        # the aim is to hand it the cleanest input we can.
        "video_bitrate_k": 12000, "codec": "h264", "color": "#DD2A7B",
    },
    "facebook_reels": {
        "name": "Facebook Reels", "aspect": "9:16", "width": 1080, "height": 1920,
        "max_duration": 90, "max_size_mb": 250, "caption_limit": 2200, "hashtag_limit": 30,
        "video_bitrate_k": 8000, "codec": "h264", "color": "#1877F2",
    },
    "tiktok": {
        "name": "TikTok", "aspect": "9:16", "width": 1080, "height": 1920,
        "max_duration": 600, "max_size_mb": 287, "caption_limit": 2200, "hashtag_limit": 30,
        "video_bitrate_k": 10000, "codec": "h264", "color": "#00F2FE",
    },
    "twitter": {
        "name": "X (Twitter)", "aspect": "16:9", "width": 1280, "height": 720,
        "max_duration": 140, "max_size_mb": 512, "caption_limit": 280, "hashtag_limit": 10,
        "video_bitrate_k": 6000, "codec": "h264", "color": "#1DA1F2",
    },
    "pinterest": {
        "name": "Pinterest", "aspect": "2:3", "width": 1000, "height": 1500,
        "max_duration": 300, "max_size_mb": 200, "caption_limit": 500, "hashtag_limit": 20,
        "video_bitrate_k": 6000, "codec": "h264", "color": "#E60023",
    },
    "linkedin": {
        "name": "LinkedIn", "aspect": "16:9", "width": 1920, "height": 1080,
        "max_duration": 600, "max_size_mb": 500, "caption_limit": 3000, "hashtag_limit": 15,
        "video_bitrate_k": 10000, "codec": "h264", "color": "#0A66C2",
    },
}


# Instagram (and the other platforms here) accept H.264 or HEVC video with AAC
# audio. Anything else — VP9, AV1, MPEG-4 ASP, Opus, MP3, AC3 — either fails
# on their end or gets processed unpredictably, so it must be converted rather
# than sent through untouched. ffprobe reports HEVC as "hevc".
ACCEPTED_VIDEO_CODECS = {"h264", "hevc"}
ACCEPTED_AUDIO_CODECS = {"aac"}

# Must match the `-b:a 256k` transcode_video actually encodes at, or the
# projection below under-counts. Used only to predict an output size — it must
# not become a lever that scales the video bitrate down again.
AUDIO_BITRATE_K = 256


def _secs(value: float) -> str:
    """Format a duration for a message without lying about it.

    int() truncates, so a 60.4s video against a 60s cap read as
    "Duration 60s exceeds 60s limit" — self-contradictory, and it looks like a
    bug in the check rather than a genuinely over-length video. Keep one
    decimal whenever the value isn't whole.
    """
    if value is None:
        return "0"
    return f"{value:.1f}".rstrip("0").rstrip(".") if value % 1 else str(int(value))


def validate_media_for_platform(media: dict, platform: str) -> dict:
    spec = PLATFORM_SPECS[platform]
    checks = []
    needs_transform = False
    if media.get("type") == "video":
        dur = media.get("duration") or 0
        reels_tab_max = spec.get("reels_tab_max_duration")
        if dur > spec["max_duration"]:
            checks.append({"level": "error", "message": f"Duration {_secs(dur)}s exceeds {spec['max_duration']}s limit"})
        elif reels_tab_max and dur > reels_tab_max:
            # Publishes fine, but lands as a video post instead of in the Reels tab.
            checks.append({"level": "warn", "message": (
                f"Duration {_secs(dur)}s is over {reels_tab_max}s — this will publish "
                f"as a regular video post, not in the Reels tab"
            )})
        else:
            checks.append({"level": "ok", "message": f"Duration {_secs(dur)}s within {spec['max_duration']}s limit"})

        min_dur = spec.get("min_duration")
        if min_dur and 0 < dur < min_dur:
            checks.append({"level": "error", "message": (
                f"Duration {dur:.1f}s is under the {min_dur}s minimum"
            )})

        fps = media.get("fps")
        if fps and not (23 <= fps <= 60):
            # Informational only. Re-encoding to "fix" the frame rate would
            # resample every frame — a far bigger quality cost than the risk
            # being flagged, and the upload usually succeeds regardless.
            checks.append({"level": "warn", "message": (
                f"{fps}fps is outside Instagram's documented 23-60fps range — "
                f"uploading as-is rather than resampling frames"
            )})

        vcodec = (media.get("codec") or "").lower()
        if vcodec and vcodec not in ACCEPTED_VIDEO_CODECS:
            checks.append({"level": "warn", "message": f"Video codec '{vcodec}' isn't accepted — will be converted to H.264"})
            needs_transform = True

        acodec = (media.get("audio_codec") or "").lower()
        if acodec and acodec not in ACCEPTED_AUDIO_CODECS:
            checks.append({"level": "warn", "message": f"Audio codec '{acodec}' isn't accepted — will be converted to AAC"})
            needs_transform = True
    size_mb = round((media.get("size") or 0) / (1024 * 1024), 1)
    if size_mb > spec["max_size_mb"]:
        # Re-encoding uses a flat quality target, so past a crossover duration
        # (~201s for Reels at 12000k) it cannot bring the file under the cap —
        # the transform meant to rescue an oversized upload produces another
        # oversized file, and only after minutes of work. Say so now rather
        # than degrading the video and still being rejected by the platform.
        dur = media.get("duration") or 0
        projected_mb = (spec["video_bitrate_k"] + AUDIO_BITRATE_K) * dur / 8 / 1024
        if dur > 0 and projected_mb > spec["max_size_mb"]:
            checks.append({"level": "error", "message": (
                f"{size_mb}MB at {_secs(dur)}s can't be compressed under the "
                f"{spec['max_size_mb']}MB limit — trim the video or export it smaller"
            )})
        else:
            checks.append({"level": "warn", "message": f"File {size_mb}MB exceeds {spec['max_size_mb']}MB — will be compressed"})
            needs_transform = True
    else:
        checks.append({"level": "ok", "message": f"File size {size_mb}MB OK (max {spec['max_size_mb']}MB)"})
    w, h = media.get("width") or 0, media.get("height") or 0
    if w and h:
        src_ratio = w / h
        tw, th = spec["width"], spec["height"]
        target_ratio = tw / th
        if abs(src_ratio - target_ratio) > 0.02:
            checks.append({"level": "warn", "message": f"Aspect {w}x{h} will be padded to {spec['aspect']} ({tw}x{th})"})
            needs_transform = True
        else:
            checks.append({"level": "ok", "message": f"Aspect ratio matches {spec['aspect']}"})
        if w < tw * 0.5:
            checks.append({"level": "warn", "message": f"Low resolution source — upscaling may reduce quality"})
        max_w = spec.get("max_width")
        if max_w and max(w, h) > max_w:
            # Instagram caps horizontal pixels; a 4K source exceeds it even
            # when the aspect ratio is a perfect 9:16, so scaling is the only
            # way it publishes.
            checks.append({"level": "warn", "message": (
                f"{w}x{h} exceeds the {max_w}px maximum — will be scaled down"
            )})
            needs_transform = True
    status = "error" if any(c["level"] == "error" for c in checks) else ("warn" if any(c["level"] == "warn" for c in checks) else "ok")
    return {"platform": platform, "status": status, "checks": checks, "needs_transform": needs_transform}


def build_optimization_plan(media: dict, platform: str) -> dict:
    spec = PLATFORM_SPECS[platform]
    validation = validate_media_for_platform(media, platform)
    return {
        "target_resolution": f"{spec['width']}x{spec['height']}",
        "target_aspect": spec["aspect"],
        "codec": spec["codec"],
        # Flat target bitrate, no size-budget scaling. Uploads are expected to
        # stay under max_size_mb on their own, so quality is never traded away
        # to force a long video under the cap — an oversized source still gets
        # flagged by the size check above and re-encoded at full quality.
        "bitrate_kbps": spec["video_bitrate_k"],
        "transform": "pad_and_scale" if validation["needs_transform"] else "passthrough",
        "quality_preserved": not validation["needs_transform"],
    }
