import { useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";

const KPI = ({ label, value, icon: Icon, testid }) => (
  <div data-testid={testid} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6">
    <div className="flex items-center justify-between">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50">{label}</p>
      <Icon size={15} className="text-white/30" />
    </div>
    <p className="mt-3 text-3xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>{value.toLocaleString()}</p>
  </div>
);

const tooltipStyle = { backgroundColor: "#111113", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12 };

export default function Analytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/analytics/overview").then((r) => setData(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="p-8 text-white/40 text-sm">Loading analytics…</div>;

  const { totals, per_platform, timeline } = data;

  return (
    <div data-testid="analytics-page" className="p-6 sm:p-8">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Performance</p>
      <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-8" style={{ fontFamily: "Outfit" }}>Analytics</h1>
      <p className="text-[11px] text-white/40 mb-6 uppercase tracking-widest">Simulated metrics — real platform data connects when API credentials are added</p>

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
    </div>
  );
}
