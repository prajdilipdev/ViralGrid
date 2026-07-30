import asyncio
import json
import logging
from pathlib import Path

logger = logging.getLogger("media_utils")

UPLOAD_DIR = Path(__file__).parent / "uploads"
THUMB_DIR = UPLOAD_DIR / "thumbs"
OPT_DIR = UPLOAD_DIR / "optimized"
for d in (UPLOAD_DIR, THUMB_DIR, OPT_DIR):
    d.mkdir(parents=True, exist_ok=True)


async def _run(*args):
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    out, err = await proc.communicate()
    return proc.returncode, out.decode(errors="ignore"), err.decode(errors="ignore")


async def probe_media(path: str) -> dict:
    code, out, _ = await _run("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path)
    if code != 0:
        return {}
    data = json.loads(out or "{}")
    info = {"duration": None, "width": None, "height": None, "codec": None, "bitrate": None, "fps": None, "audio_codec": None}
    fmt = data.get("format", {})
    if fmt.get("duration"):
        info["duration"] = float(fmt["duration"])
    if fmt.get("bit_rate"):
        info["bitrate"] = int(fmt["bit_rate"])
    for s in data.get("streams", []):
        if s.get("codec_type") == "video" and not info["width"]:
            info["width"] = s.get("width")
            info["height"] = s.get("height")
            info["codec"] = s.get("codec_name")
            fr = s.get("r_frame_rate", "0/1")
            try:
                num, den = fr.split("/")
                info["fps"] = round(int(num) / int(den), 2) if int(den) else None
            except Exception:
                pass
        elif s.get("codec_type") == "audio":
            info["audio_codec"] = s.get("codec_name")
    return info


async def generate_thumbnail(video_path: str, out_name: str) -> str | None:
    out_path = THUMB_DIR / out_name
    code, _, _ = await _run("ffmpeg", "-y", "-ss", "1", "-i", video_path, "-vframes", "1", "-vf", "scale=640:-2", str(out_path))
    if code != 0:
        code, _, _ = await _run("ffmpeg", "-y", "-i", video_path, "-vframes", "1", "-vf", "scale=640:-2", str(out_path))
    return out_name if code == 0 and out_path.exists() else None


async def is_hdr(path: str) -> bool:
    """Is this HDR / >8-bit? Those need tone mapping, not a bare bit-depth cut."""
    code, out, _ = await _run(
        "ffprobe", "-v", "quiet", "-select_streams", "v:0", "-print_format", "json",
        "-show_entries", "stream=pix_fmt,color_transfer,color_primaries", path,
    )
    if code != 0:
        return False
    try:
        s = (json.loads(out or "{}").get("streams") or [{}])[0]
    except Exception:
        return False
    deep = "10le" in (s.get("pix_fmt") or "") or "12le" in (s.get("pix_fmt") or "")
    hdr_trc = (s.get("color_transfer") or "") in ("smpte2084", "arib-std-b67")
    wide = (s.get("color_primaries") or "") == "bt2020"
    return deep or hdr_trc or wide


async def remux_faststart(src: str, out_name: str) -> str | None:
    """Move the moov atom to the front of the file without touching a single
    video or audio sample — a container-level repack, not a re-encode.

    Meta's own spec requires the moov atom at the front ("no edit lists and
    moov atom at the front of the file"). A phone or editing tool that writes
    it at the end still produces a file that plays fine locally, but a
    passthrough upload sent it to Instagram exactly as recorded — silently out
    of spec. -c copy guarantees the video/audio streams are copied bit-for-bit;
    only the container's index is rewritten.
    """
    out_path = OPT_DIR / out_name
    if out_path.exists():
        return out_name
    code, _, err = await _run(
        "ffmpeg", "-y", "-i", src,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c", "copy", "-movflags", "+faststart", str(out_path),
    )
    if code != 0 or not out_path.exists():
        logger.warning(f"Faststart remux failed, will send the original file as-is: {err.strip()[-200:]}")
        return None
    return out_name


async def transcode_video(src: str, out_name: str, width: int, height: int, bitrate_k: int) -> str | None:
    out_path = OPT_DIR / out_name
    if out_path.exists():
        return out_name

    fit = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"

    # Instagram requires 8-bit 4:2:0, and x264 would otherwise keep the source's
    # format. Phones record HDR 10-bit by default, and simply truncating that to
    # 8 bits looks washed out — so tone map when the source is HDR. zscale is not
    # present in every ffmpeg build, hence the plain fallback below.
    chains = [fit]
    if await is_hdr(src):
        tonemapped = (
            f"{fit},zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0,"
            "zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p"
        )
        chains.insert(0, tonemapped)

    for attempt, vf in enumerate(chains):
        code, _, err = await _run(
            "ffmpeg", "-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
            "-b:v", f"{bitrate_k}k", "-maxrate", f"{bitrate_k}k", "-bufsize", f"{bitrate_k * 2}k",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
            "-movflags", "+faststart", str(out_path),
        )
        if code == 0 and out_path.exists():
            return out_name
        if attempt < len(chains) - 1:
            logger.warning(f"Tone-mapped encode unavailable, retrying without it: {err.strip()[-200:]}")
            out_path.unlink(missing_ok=True)
    return None
