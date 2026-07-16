FROM python:3.11-slim

# ffmpeg/ffprobe are required for media probing, thumbnails and transcoding
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Optional Emergent integration (AI copy generation). Best-effort: if the
# private index is unreachable the build still succeeds and the app runs
# with the /api/ai/generate endpoint returning 503.
RUN pip install --no-cache-dir emergentintegrations \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    || echo "emergentintegrations not installed — AI generation disabled"

COPY . .

# Render injects PORT; default to 8000 for local runs
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
