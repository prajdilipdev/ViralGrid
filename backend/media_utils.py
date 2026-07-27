import asyncio
import json
from pathlib import Path

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


async def transcode_video(src: str, out_name: str, width: int, height: int, bitrate_k: int) -> str | None:
    out_path = OPT_DIR / out_name
    if out_path.exists():
        return out_name
    vf = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
    code, _, err = await _run(
        "ffmpeg", "-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", f"{bitrate_k}k", "-maxrate", f"{bitrate_k}k", "-bufsize", f"{bitrate_k * 2}k",
        "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(out_path),
    )
    return out_name if code == 0 and out_path.exists() else None
