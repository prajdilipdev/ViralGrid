import { useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META, STATUS_COLORS } from "../lib/platforms";
import dayjs from "dayjs";
import { toast } from "sonner";
import { RotateCcw, Trash2, Send, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

const FILTERS = ["all", "published", "scheduled", "draft", "failed", "partial", "deleted"];

export default function HistoryPage() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/posts").then((r) => setPosts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  const retry = async (id) => {
    setBusy(id);
    try {
      await api.post(`/posts/${id}/retry`);
      toast.success("Retry complete");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Retry failed"); }
    setBusy(null);
  };

  const publishDraft = async (id) => {
    setBusy(id);
    try {
      await api.post(`/posts/${id}/publish`);
      toast.success("Published");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Publish failed"); }
    setBusy(null);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/posts/${id}`);
      toast.success("Post deleted");
      load();
    } catch { toast.error("Delete failed"); }
  };

  return (
    <div data-testid="history-page" className="p-6 sm:p-8">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Archive</p>
      <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-8" style={{ fontFamily: "Outfit" }}>Post History</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} data-testid={`history-filter-${f}`} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs border transition-colors duration-200 ${filter === f ? "bg-white text-black border-white font-medium" : "border-white/15 text-white/60 hover:text-white"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="border border-white/10 bg-[#0A0A0B]">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-2xl font-light text-white/30 tracking-tight" style={{ fontFamily: "Outfit" }}>No posts here.</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.post_id} data-testid={`history-post-${p.post_id}`} className="border-b border-white/5 last:border-b-0">
              <div className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-white/40">
                    {dayjs(p.created_at).format("MMM D, YYYY HH:mm")}
                    {p.status === "scheduled" && p.scheduled_at && ` · fires ${dayjs(p.scheduled_at).format("MMM D, HH:mm")}`}
                  </p>
                </div>
                <div className="hidden sm:flex gap-1.5">
                  {p.platforms.map((pl) => {
                    const M = PLATFORM_META[pl];
                    return M ? <M.Icon key={pl} size={14} style={{ color: M.color }} /> : null;
                  })}
                </div>
                <span className={`text-[10px] uppercase tracking-widest border px-2 py-1 rounded-sm ${STATUS_COLORS[p.status] || ""}`}>{p.status}</span>
                <div className="flex gap-1.5">
                  {(p.status === "failed" || p.status === "partial") && (
                    <button data-testid={`retry-post-${p.post_id}`} onClick={() => retry(p.post_id)} disabled={busy === p.post_id} title="Retry failed platforms"
                      className="w-8 h-8 border border-white/15 rounded-md flex items-center justify-center hover:bg-white/5 transition-colors duration-200"><RotateCcw size={13} /></button>
                  )}
                  {p.status === "draft" && p.platforms.length > 0 && (
                    <button data-testid={`publish-draft-${p.post_id}`} onClick={() => publishDraft(p.post_id)} disabled={busy === p.post_id} title="Publish now"
                      className="w-8 h-8 bg-white text-black rounded-md flex items-center justify-center transition-transform duration-200 hover:-translate-y-0.5"><Send size={13} /></button>
                  )}
                  <button data-testid={`expand-post-${p.post_id}`} onClick={() => setExpanded(expanded === p.post_id ? null : p.post_id)}
                    className="w-8 h-8 border border-white/15 rounded-md flex items-center justify-center hover:bg-white/5 transition-colors duration-200">
                    {expanded === p.post_id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <button data-testid={`delete-post-${p.post_id}`} onClick={() => remove(p.post_id)}
                    className="w-8 h-8 border border-white/15 rounded-md flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-white/5 transition-colors duration-200"><Trash2 size={13} /></button>
                </div>
              </div>
              {expanded === p.post_id && (
                <div className="px-6 pb-5 pt-1 bg-white/[0.02]">
                  {p.caption && <p className="text-xs text-white/60 mb-3">{p.caption}</p>}
                  {p.hashtags?.length > 0 && (
                    <p className="text-xs text-white/40 mb-4">{p.hashtags.map((h) => `#${h}`).join(" ")}</p>
                  )}
                  {Object.keys(p.platform_results || {}).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(p.platform_results).map(([plat, r]) => {
                        const M = PLATFORM_META[plat];
                        return (
                          <div key={plat} className="border border-white/10 rounded-md p-3 flex items-start gap-3">
                            {M && <M.Icon size={15} style={{ color: M.color }} className="mt-0.5" />}
                            <div className="flex-1 min-w-0 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs">{M?.name || plat}</span>
                                <span className={
                                  r.status === "published" ? "text-emerald-400"
                                    : r.status === "deleted" ? "text-white/40"
                                    : "text-red-400"
                                }>
                                  {r.status === "deleted" ? "deleted by user" : r.status}
                                </span>
                                {r.url && r.status !== "deleted" && <a href={r.url} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white"><ExternalLink size={11} /></a>}
                              </div>
                              {r.status === "deleted" && (
                                <p className="text-white/35 mt-1">
                                  Removed from {M?.name || plat}
                                  {r.deleted_at && ` · noticed ${dayjs(r.deleted_at).format("MMM D, HH:mm")}`}
                                </p>
                              )}
                              {r.error && <p className="text-red-400/80 mt-1">{r.error}</p>}
                              {r.optimization && (
                                <p className="text-white/40 mt-1">
                                  {r.optimization.transform === "passthrough" ? "Original quality preserved" : `Optimized → ${r.optimization.target_resolution} @ ${r.optimization.bitrate_kbps}kbps`}
                                </p>
                              )}
                              {r.metrics && (
                                <p className="text-white/50 mt-1">{r.metrics.views.toLocaleString()} views · {r.metrics.likes.toLocaleString()} likes · {r.metrics.shares.toLocaleString()} shares</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-white/40">Not published yet.</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
