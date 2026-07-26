import { useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META, STATUS_COLORS } from "../lib/platforms";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CalendarSkeleton } from "../components/Skeletons";

export default function CalendarPage() {
  const [month, setMonth] = useState(dayjs());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api.get("/posts").then((r) => setPosts(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const dated = posts.filter((p) => p.scheduled_at || p.published_at);
  const byDay = {};
  dated.forEach((p) => {
    const d = dayjs(p.scheduled_at || p.published_at).format("YYYY-MM-DD");
    (byDay[d] = byDay[d] || []).push(p);
  });

  const start = month.startOf("month");
  const firstCell = start.subtract(start.day(), "day");
  const cells = Array.from({ length: 42 }, (_, i) => firstCell.add(i, "day"));
  const queue = posts.filter((p) => p.status === "scheduled").sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""));

  const removeFromQueue = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      toast.success("Removed from queue");
      load();
    } catch { toast.error("Failed to remove"); }
  };

  return (
    <div data-testid="calendar-page" className="p-6 sm:p-8">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Planning</p>
      <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-8" style={{ fontFamily: "Outfit" }}>Content Calendar</h1>

      {loading ? <CalendarSkeleton /> : (
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 border border-white/10 bg-[#0A0A0B]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-medium">{month.format("MMMM YYYY")}</h3>
            <div className="flex gap-2">
              <button data-testid="calendar-prev-month" onClick={() => setMonth(month.subtract(1, "month"))} className="w-8 h-8 border border-white/10 rounded-md flex items-center justify-center hover:bg-white/5 transition-colors duration-200"><ChevronLeft size={14} /></button>
              <button data-testid="calendar-next-month" onClick={() => setMonth(month.add(1, "month"))} className="w-8 h-8 border border-white/10 rounded-md flex items-center justify-center hover:bg-white/5 transition-colors duration-200"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-white/5">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div key={d} className="px-2 py-2 text-[10px] tracking-[0.15em] text-white/40 font-semibold text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const key = day.format("YYYY-MM-DD");
              const dayPosts = byDay[key] || [];
              const inMonth = day.month() === month.month();
              const isToday = day.isSame(dayjs(), "day");
              return (
                <div key={key} data-testid={`calendar-day-${key}`} className={`min-h-[92px] border-r border-b border-white/5 p-1.5 ${inMonth ? "" : "opacity-30"}`}>
                  <span className={`text-[11px] inline-flex w-5 h-5 items-center justify-center rounded-full ${isToday ? "bg-white text-black font-semibold" : "text-white/50"}`}>{day.date()}</span>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div key={p.post_id} className={`text-[9px] px-1.5 py-1 rounded-sm border truncate ${STATUS_COLORS[p.status] || "border-white/10"} bg-white/[0.03]`} title={p.title}>
                        {p.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 && <p className="text-[9px] text-white/40 px-1">+{dayPosts.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-white/10 bg-[#0A0A0B] h-fit">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-medium">Publish Queue</h3>
            <p className="text-[11px] text-white/40 mt-0.5">Auto-publishes at scheduled time</p>
          </div>
          <div data-testid="publish-queue" className="p-4">
            {queue.length === 0 ? (
              <p className="text-xs text-white/40 py-4 px-2">Queue is empty. Schedule posts from the Composer.</p>
            ) : (
              queue.map((p) => (
                <div key={p.post_id} data-testid={`queue-item-${p.post_id}`} className="flex items-start gap-3 px-2 py-3 border-b border-white/5 last:border-b-0">
                  <Clock size={13} className="text-amber-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{p.title}</p>
                    <p className="text-[10px] text-white/40">{dayjs(p.scheduled_at).format("MMM D, HH:mm")} {p.timezone ? `· ${p.timezone}` : ""}</p>
                    <div className="flex gap-1.5 mt-1">
                      {p.platforms.map((pl) => {
                        const M = PLATFORM_META[pl];
                        return M ? <M.Icon key={pl} size={11} style={{ color: M.color }} /> : null;
                      })}
                      {p.recurrence !== "none" && <span className="text-[9px] text-white/40 uppercase">{p.recurrence}</span>}
                    </div>
                  </div>
                  <button data-testid={`queue-remove-${p.post_id}`} onClick={() => removeFromQueue(p.post_id)} className="text-white/30 hover:text-red-400 transition-colors duration-200"><Trash2 size={13} /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
