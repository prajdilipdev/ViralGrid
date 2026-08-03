import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { ExternalLink, Copy, Check, RotateCcw, Sparkles, TrendingDown } from "lucide-react";
import { ListSkeleton } from "../components/Skeletons";
import ErrorState from "../components/ErrorState";
import { count } from "../lib/format";
import { fmt } from "../lib/dates";

const AGE_CHOICES = [3, 7, 14, 30];
const THRESHOLD_CHOICES = [25, 50, 75];

/** Caption + hashtags as one block, ready to paste into Instagram. */
const composed = (caption, tags) => {
  const line = tags.map((t) => `#${t}`).join(" ");
  return [caption?.trim(), line].filter(Boolean).join("\n\n");
};

function PostCard({ item, index }) {
  // Start from the tags the post already has, so the edit is additive rather
  // than a rewrite the user has to reconstruct.
  const [tags, setTags] = useState(() => item.hashtags);
  const [caption, setCaption] = useState(item.caption || "");
  const [copied, setCopied] = useState(false);
  const [thinking, setThinking] = useState(false);

  const toggle = (tag) =>
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  const copy = async () => {
    const text = composed(caption, tags);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API needs a secure context and can be blocked outright.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        toast.error("Couldn't copy — select the caption and copy manually");
        document.body.removeChild(ta);
        return;
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Caption copied — paste it into Instagram");
    setTimeout(() => setCopied(false), 2000);
  };

  const suggestWithAI = async () => {
    setThinking(true);
    try {
      const r = await api.post("/ai/generate", {
        topic: item.title || caption || "short-form video",
        tone: "engaging",
        platforms: [item.platform],
      });
      if (r.data.caption) setCaption(r.data.caption);
      const fresh = (r.data.hashtags || []).map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean);
      if (fresh.length) setTags((cur) => Array.from(new Set([...cur, ...fresh])));
      toast.success("Rewritten — review before pasting");
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI rewrite failed");
    }
    setThinking(false);
  };

  return (
    <div
      data-testid={`refresh-card-${item.post_id}`}
      className="vg-panel bg-ink-900 p-5 vg-fade-up"
      style={{ "--vg-stagger": `${index * 40}ms` }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
          <p className="text-xs text-white/40 mt-1">
            {item.platform_name} · {fmt(item.published_at, "MMM D, YYYY")} · {item.age_days}d old
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="vg-label text-[10px] font-semibold px-2 py-1 rounded-sm border border-amber-400/40 text-amber-400">
            {item.vs_median_pct}% of median
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              data-testid={`refresh-open-${item.post_id}`}
              title="Open on Instagram to edit the caption"
              className="h-8 px-3 border border-white/15 rounded-md text-xs flex items-center gap-1.5 text-white/70 hover:text-white transition-colors duration-200"
            >
              Open <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <p className="text-xs text-white/50 mt-3">
        {count(item.views)} views · {count(item.likes)} likes
      </p>

      <label className="vg-label text-[10px] font-semibold text-white/50 mt-5 block">Caption</label>
      <textarea
        data-testid={`refresh-caption-${item.post_id}`}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
        className="w-full mt-2 bg-ink-800 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />

      {item.suggested_hashtags.length > 0 && (
        <>
          <p className="vg-label text-[10px] font-semibold text-white/50 mt-4">
            Tags from your stronger posts
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {item.suggested_hashtags.map((t) => (
              <button
                key={t}
                onClick={() => toggle(t)}
                data-testid={`refresh-tag-${item.post_id}-${t}`}
                aria-pressed={tags.includes(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors duration-200 ${
                  tags.includes(t)
                    ? "vg-btn vg-btn-primary border-transparent"
                    : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="vg-label text-[10px] font-semibold text-white/50 mt-4">
        New caption ({tags.length} tags)
      </p>
      <pre
        data-testid={`refresh-preview-${item.post_id}`}
        className="mt-2 text-[11px] text-white/60 bg-ink-800 border border-white/5 rounded-md p-3 whitespace-pre-wrap break-words font-mono max-h-40 overflow-auto"
      >
        {composed(caption, tags) || "—"}
      </pre>

      <div className="flex gap-2 mt-4 flex-wrap">
        <button
          onClick={copy}
          data-testid={`refresh-copy-${item.post_id}`}
          className="h-10 px-4 vg-btn vg-btn-primary rounded-md text-xs flex items-center gap-2"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy caption"}
        </button>
        <button
          onClick={suggestWithAI}
          disabled={thinking}
          data-testid={`refresh-ai-${item.post_id}`}
          className="h-10 px-4 border border-white/15 rounded-md text-xs flex items-center gap-2 text-white/70 hover:text-white disabled:opacity-50 transition-colors duration-200"
        >
          <Sparkles size={13} /> {thinking ? "Rewriting…" : "Rewrite with AI"}
        </button>
      </div>
    </div>
  );
}

export default function Refresh() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return api
      .get(`/posts/underperforming?days=${days}&threshold=${threshold}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, [days, threshold]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div data-testid="refresh-page" className="p-6 sm:p-8">
      <p className="vg-label text-[10px] font-semibold text-white/50 mb-2">Maintenance</p>
      <h1 className="vg-tick text-3xl sm:text-4xl tracking-tighter font-light mb-3">Refresh Old Posts</h1>
      <p className="text-sm text-white/50 mb-2 max-w-2xl">
        Posts that have gone quiet compared to your own median. Instagram's API can't edit a
        caption once it's published, so this prepares the new one and hands you a link — the
        paste itself has to happen in the app.
      </p>
      <p className="text-xs text-white/35 mb-8 max-w-2xl">
        Worth knowing: Instagram has said hashtags don't meaningfully drive reach, so treat this
        as tidying rather than a fix for a dead post.
      </p>

      <div className="flex gap-6 mb-6 flex-wrap">
        <div>
          <p className="vg-label text-[10px] font-semibold text-white/50 mb-2">Older than</p>
          <div className="flex gap-2">
            {AGE_CHOICES.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                data-testid={`refresh-days-${d}`}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors duration-200 ${
                  days === d ? "vg-btn vg-btn-primary border-transparent" : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="vg-label text-[10px] font-semibold text-white/50 mb-2">Below</p>
          <div className="flex gap-2">
            {THRESHOLD_CHOICES.map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                data-testid={`refresh-threshold-${t}`}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors duration-200 ${
                  threshold === t ? "vg-btn vg-btn-primary border-transparent" : "border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {t}% of median
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="vg-panel bg-ink-900">
          <ListSkeleton rows={3} testid="skeleton-refresh" />
        </div>
      ) : error ? (
        <div className="vg-panel bg-ink-900">
          <ErrorState what="your posts" error={error} onRetry={load} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-5 flex-wrap">
            <p className="text-xs text-white/50">
              Median {count(data.median_views)} views across {count(data.considered)} settled posts
            </p>
            <button
              onClick={load}
              data-testid="refresh-reload"
              className="text-xs text-white/50 hover:text-white flex items-center gap-1.5 transition-colors duration-200"
            >
              <RotateCcw size={12} /> Recheck
            </button>
          </div>

          {data.items.length === 0 ? (
            <div className="vg-panel bg-ink-900 p-16 text-center">
              <TrendingDown size={22} className="text-white/30 mx-auto mb-3" />
              <p className="text-2xl font-light text-white/30 tracking-tight">
                {data.considered === 0 ? "Nothing settled yet." : "Nothing underperforming."}
              </p>
              <p className="text-sm text-white/40 mt-2">
                {data.considered === 0
                  ? `No published posts older than ${days} days to measure.`
                  : `No post is below ${threshold}% of your median.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {data.items.map((item, i) => (
                <PostCard key={`${item.post_id}-${item.platform}`} item={item} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
