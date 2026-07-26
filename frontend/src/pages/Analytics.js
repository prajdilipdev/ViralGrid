import { useCallback, useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import SyncButton from "../components/SyncButton";
import { AnalyticsSkeleton } from "../components/Skeletons";
import dayjs from "dayjs";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Eye, Heart, MessageCircle, Share2, Trash2 } from "lucide-react";

const KPI = ({ label, value, icon: Icon, testid }) => (
  <div data-testid={testid} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6">
    <div className="flex items-center justify-between">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50">{label}</p>
      <Icon size={15} className="text-white/30" />
    </div>
    <p className="mt-3 text-3xl font-light tracking-tight" style={{ fontFamily: "Manrope" }}>{value.toLocaleString()}</p>
  </div>
);

const tooltipStyle = { backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12 };

export default function Analytics() {
  const [data, setData] = useState(null);

  const load = useCallback(
    () => api.get("/analytics/overview").then((r) => setData(r.data)).catch(() => {}),
    [],
  );
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <div data-testid="analytics-page" className="p-6 sm:p-8">
        <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Performance</p>
        <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-8" style={{ fontFamily: "Manrope" }}>Analytics</h1>
        <AnalyticsSkeleton />
      </div>
    );
  }

  const { totals, per_platform, timeline, deleted = [] } = data;

  return (
    <div data-testid="analytics-page" className="p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Performance</p>
          <h1 className="text-3xl sm:text-4xl tracking-tighter font-light" style={{ fontFamily: "Manrope" }}>Analytics</h1>
        </div>
        <SyncButton onDone={load} />
      </div>
      <p className="text-[11px] text-white/40 mb-6 uppercase tracking-widest">Instagram metrics are live · other platforms simulated</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-white/5">
        <KPI label="Views" value={totals.views} icon={Eye} testid="kpi-views" />
        <KPI label="Likes" value={totals.likes} icon={Heart} testid="kpi-likes" />
        <KPI label="Comments" value={totals.comments} icon={MessageCircle} testid="kpi-comments" />
        <KPI label="Shares" value={totals.shares} icon={Share2} testid="kpi-shares" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="border border-white/10 bg-[#0A0A0B] p-6">
          <h3 className="text-sm font-medium mb-6">Views Over Time</h3>
          {timeline.length === 0 ? (
            <p className="text-xs text-white/40 py-16 text-center">Publish content to see trends.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="views" stroke="#ffffff" strokeWidth={1.5} fill="url(#vGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-white/10 bg-[#0A0A0B] p-6">
          <h3 className="text-sm font-medium mb-6">Views by Platform</h3>
          {per_platform.length === 0 ? (
            <p className="text-xs text-white/40 py-16 text-center">No platform data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={per_platform}>
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="views" radius={[3, 3, 0, 0]}>
                  {per_platform.map((p, i) => (
                    <Cell key={i} fill={PLATFORM_META[p.platform]?.color || "#ffffff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {per_platform.length > 0 && (
        <div className="border border-white/10 bg-[#0A0A0B] mt-6">
          <div className="px-6 py-4 border-b border-white/10"><h3 className="text-sm font-medium">Platform Breakdown</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/40 uppercase tracking-widest text-[10px]">
                  <th className="text-left px-6 py-3 font-semibold">Platform</th>
                  <th className="text-right px-6 py-3 font-semibold">Posts</th>
                  <th className="text-right px-6 py-3 font-semibold">Views</th>
                  <th className="text-right px-6 py-3 font-semibold">Likes</th>
                  <th className="text-right px-6 py-3 font-semibold">Comments</th>
                  <th className="text-right px-6 py-3 font-semibold">Shares</th>
                </tr>
              </thead>
              <tbody>
                {per_platform.map((p) => {
                  const M = PLATFORM_META[p.platform];
                  return (
                    <tr key={p.platform} data-testid={`analytics-row-${p.platform}`} className="border-t border-white/5">
                      <td className="px-6 py-3 flex items-center gap-2">{M && <M.Icon size={14} style={{ color: M.color }} />} {p.name}</td>
                      <td className="text-right px-6 py-3 text-white/70">{p.posts}</td>
                      <td className="text-right px-6 py-3 text-white/70">{p.views.toLocaleString()}</td>
                      <td className="text-right px-6 py-3 text-white/70">{p.likes.toLocaleString()}</td>
                      <td className="text-right px-6 py-3 text-white/70">{p.comments.toLocaleString()}</td>
                      <td className="text-right px-6 py-3 text-white/70">{p.shares.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleted.length > 0 && (
        <div data-testid="analytics-deleted-section" className="border border-white/10 bg-[#0A0A0B] mt-6">
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
            <Trash2 size={14} className="text-white/40" />
            <h3 className="text-sm font-medium">Removed from platform</h3>
            <span className="text-[10px] uppercase tracking-widest text-white/35 border border-white/15 rounded-sm px-2 py-0.5">
              {deleted.length}
            </span>
          </div>
          <p className="px-6 pt-4 text-[11px] text-white/40">
            These posts were published by ViralGrid but no longer exist on the platform. Their numbers are excluded
            from the totals above; the figures below are the last values recorded before removal.
          </p>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {deleted.map((d, i) => {
              const M = PLATFORM_META[d.platform];
              const m = d.last_metrics || {};
              return (
                <div key={`${d.post_id}-${d.platform}-${i}`} data-testid={`deleted-post-${d.post_id}`}
                  className="border border-white/10 rounded-md p-3 flex items-start gap-3 bg-white/[0.02]">
                  {M && <M.Icon size={15} style={{ color: M.color }} className="mt-0.5 opacity-50" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium text-white/70 truncate">{d.title || "Untitled"}</p>
                      <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/45 border border-white/10 shrink-0">
                        Deleted by user
                      </span>
                    </div>
                    <p className="text-[11px] text-white/35 mt-1">
                      {d.name}
                      {d.deleted_at && ` · noticed ${dayjs(d.deleted_at).format("MMM D, HH:mm")}`}
                    </p>
                    {(m.views || m.likes) && (
                      <p className="text-[11px] text-white/40 mt-1">
                        last seen: {(m.views || 0).toLocaleString()} views · {(m.likes || 0).toLocaleString()} likes
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
