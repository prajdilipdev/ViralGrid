import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { PLATFORM_META, STATUS_COLORS } from "../lib/platforms";
import SyncButton from "../components/SyncButton";
import { fmtLocal } from "../lib/dates";
import { statValue, exactValue } from "../lib/format";
import { StatsSkeleton, ListSkeleton } from "../components/Skeletons";
import { PenSquare, ArrowUpRight, Clock, FileText, CheckCircle2, Eye, XCircle } from "lucide-react";

const StatCard = ({ label, value, exact, icon: Icon, testid }) => (
  <div data-testid={testid} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 truncate">{label}</p>
      <Icon size={15} className="text-white/30 shrink-0" />
    </div>
    {/* truncate: a long figure has no break point and would otherwise widen the grid */}
    <p className="mt-3 text-3xl font-light tracking-tight truncate" title={exact || undefined}>{value}</p>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [conns, setConns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await Promise.all([
      api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {}),
      api.get("/posts").then((r) => setPosts(r.data.slice(0, 6))).catch(() => {}),
      api.get("/connections").then((r) => setConns(r.data)).catch(() => {}),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const connected = new Set(conns.map((c) => c.platform));
  const upcoming = posts.filter((p) => p.status === "scheduled");

  return (
    <div data-testid="dashboard-page" className="p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Command Center</p>
          <h1 className="text-3xl sm:text-4xl tracking-tighter font-light" style={{ fontFamily: "Manrope" }}>Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton onDone={load} />
          <Link to="/composer" data-testid="dashboard-new-post-button" className="bg-white text-black px-5 h-11 rounded-md flex items-center gap-2 text-sm font-medium transition-transform duration-200 hover:-translate-y-0.5">
            <PenSquare size={15} /> New Post
          </Link>
        </div>
      </div>

      {loading ? <StatsSkeleton /> : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-l border-white/5">
        <StatCard label="Total Posts" value={stats?.total_posts ?? "—"} icon={FileText} testid="stat-total-posts" />
        <StatCard label="Published" value={stats?.published ?? "—"} icon={CheckCircle2} testid="stat-published" />
        <StatCard label="Scheduled" value={stats?.scheduled ?? "—"} icon={Clock} testid="stat-scheduled" />
        <StatCard label="Drafts" value={stats?.drafts ?? "—"} icon={PenSquare} testid="stat-drafts" />
        <StatCard label="Failed" value={stats?.failed ?? "—"} icon={XCircle} testid="stat-failed" />
        <StatCard label="Total Views" value={statValue(stats?.total_views)} exact={exactValue(stats?.total_views)} icon={Eye} testid="stat-views" />
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 border border-white/10 bg-[#0A0A0B]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-medium tracking-tight">Recent Posts</h3>
            <Link to="/history" data-testid="dashboard-view-history-link" className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors duration-200">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          {loading ? (
            <ListSkeleton rows={4} testid="skeleton-recent-posts" />
          ) : posts.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-2xl font-light text-white/30 tracking-tight" style={{ fontFamily: "Manrope" }}>Nothing published yet.</p>
              <p className="text-sm text-white/40 mt-2">Create your first post to see it here.</p>
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.post_id} data-testid={`recent-post-${p.post_id}`} className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-white/40 truncate">{p.caption}</p>
                </div>
                <div className="flex gap-1.5">
                  {p.platforms.slice(0, 4).map((pl) => {
                    const M = PLATFORM_META[pl];
                    return M ? <M.Icon key={pl} size={14} style={{ color: M.color }} /> : null;
                  })}
                </div>
                <span className={`text-[10px] uppercase tracking-widest border px-2 py-1 rounded-sm ${STATUS_COLORS[p.status] || ""}`}>{p.status}</span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-6">
          <div className="border border-white/10 bg-[#0A0A0B]">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-medium tracking-tight">Platform Status</h3>
              <Link to="/connections" data-testid="dashboard-manage-connections-link" className="text-xs text-white/50 hover:text-white transition-colors duration-200">Manage</Link>
            </div>
            <div className="p-4 grid grid-cols-1 gap-1">
              {Object.entries(PLATFORM_META).map(([id, { name, Icon, color }]) => (
                <div key={id} className="flex items-center gap-3 px-2 py-2">
                  <Icon size={15} style={{ color }} />
                  <span className="text-xs flex-1 text-white/70">{name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected.has(id) ? "bg-emerald-400" : "bg-white/20"}`} />
                  <span className="text-[10px] text-white/40 w-20 text-right">{connected.has(id) ? "Connected" : "Offline"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-[#0A0A0B]">
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="text-sm font-medium tracking-tight">Up Next</h3>
            </div>
            <div className="p-4">
              {upcoming.length === 0 ? (
                <p className="text-xs text-white/40 px-2 py-3">No scheduled posts in queue.</p>
              ) : (
                upcoming.map((p) => (
                  <div key={p.post_id} className="px-2 py-2.5 flex items-center gap-3">
                    <Clock size={13} className="text-amber-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{p.title}</p>
                      <p className="text-[10px] text-white/40">{p.scheduled_at ? fmtLocal(p.scheduled_at, "") : ""}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
