import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { mediaUrl } from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import { toast } from "sonner";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import {
  UploadCloud, CalendarClock, Send, Loader2, Trash2, Plus, FileText,
  Layers, Wand2, Copy, CheckCircle2,
} from "lucide-react";

dayjs.extend(utc);
dayjs.extend(tz);

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
const WEEK = [
  { i: 0, label: "SUN" }, { i: 1, label: "MON" }, { i: 2, label: "TUE" },
  { i: 3, label: "WED" }, { i: 4, label: "THU" }, { i: 5, label: "FRI" }, { i: 6, label: "SAT" },
];

const TABS = [
  { id: "multi", label: "Multi-media", Icon: Layers },
  { id: "template", label: "Slot Template", Icon: Wand2 },
  { id: "csv", label: "CSV Import", Icon: FileText },
];

// ---------- helpers ----------
const generatePatternSlots = ({ startDate, endDate, days, times }) => {
  if (!startDate || !endDate || !days.length || !times.length) return [];
  const out = [];
  let cur = dayjs(startDate).startOf("day");
  const end = dayjs(endDate).endOf("day");
  while (cur.isBefore(end) || cur.isSame(end, "day")) {
    if (days.includes(cur.day())) {
      times.forEach((t) => {
        const [h, m] = t.split(":").map(Number);
        out.push(cur.hour(h).minute(m).second(0).format("YYYY-MM-DDTHH:mm"));
      });
    }
    cur = cur.add(1, "day");
  }
  return out;
};

const generateIntervalSlots = ({ startDatetime, intervalValue, intervalUnit, count }) => {
  if (!startDatetime || !intervalValue || !count) return [];
  const out = [];
  let cur = dayjs(startDatetime);
  for (let i = 0; i < count; i++) {
    out.push(cur.format("YYYY-MM-DDTHH:mm"));
    cur = cur.add(intervalValue, intervalUnit);
  }
  return out;
};

const parseCsv = (text) => {
  // simple CSV parser (no quoted commas support; sufficient for internal use)
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const rows = lines.slice(1).map((ln) => {
    const cells = ln.split(",").map((s) => s.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cells[i] || ""));
    return obj;
  });
  return { headers, rows };
};

export default function BulkScheduler() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const csvRef = useRef(null);

  const [tab, setTab] = useState("multi");
  const [conns, setConns] = useState([]);
  const [libMedia, setLibMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState([]); // { key, title, caption, hashtags, platforms, media_id, scheduled_at (local ISO), _preview }
  const [submitting, setSubmitting] = useState(false);

  // shared defaults
  const [shared, setShared] = useState({
    caption: "",
    description: "",
    hashtags: "",
    tags: "",
    platforms: [],
    timezone: dayjs.tz.guess() || "UTC",
    recurrence: "none",
    titlePrefix: "",
  });

  // multi-media tab
  const [selectedMedia, setSelectedMedia] = useState([]); // media_ids
  // template tab
  const [mode, setMode] = useState("pattern"); // pattern | interval
  const [pattern, setPattern] = useState({
    startDate: dayjs().format("YYYY-MM-DD"),
    endDate: dayjs().add(4, "week").format("YYYY-MM-DD"),
    days: [1, 3, 5],
    times: ["10:00", "18:00"],
  });
  const [interval, setInterval] = useState({
    startDatetime: dayjs().add(1, "day").format("YYYY-MM-DDTHH:mm"),
    intervalValue: 6,
    intervalUnit: "hour",
    count: 8,
  });
  const [templateMediaId, setTemplateMediaId] = useState("");

  useEffect(() => {
    api.get("/connections").then((r) => setConns(r.data)).catch(() => {});
    api.get("/media").then((r) => setLibMedia(r.data)).catch(() => {});
  }, []);
  const connected = new Set(conns.map((c) => c.platform));

  const togglePlatform = (id) => {
    if (!connected.has(id)) return toast.error(`Connect ${PLATFORM_META[id].name} first`);
    setShared((s) => ({ ...s, platforms: s.platforms.includes(id) ? s.platforms.filter((x) => x !== id) : [...s.platforms, id] }));
  };

  const uploadMulti = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded = [];
    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const r = await api.post("/media/upload", fd);
        uploaded.push(r.data);
      } catch { toast.error(`Upload failed for ${f.name}`); }
    }
    setLibMedia((prev) => [...uploaded, ...prev]);
    setSelectedMedia((prev) => [...prev, ...uploaded.map((m) => m.media_id)]);
    setUploading(false);
    if (uploaded.length) toast.success(`Uploaded ${uploaded.length} file(s)`);
  };

  // ---------- preview generators ----------
  const buildFromMulti = () => {
    if (selectedMedia.length === 0) return toast.error("Select media first");
    if (shared.platforms.length === 0) return toast.error("Pick platforms in shared defaults");
    // reuse the same slot generators — user must have set slots in template tab too, OR fallback:
    const slots = mode === "pattern" ? generatePatternSlots(pattern) : generateIntervalSlots(interval);
    if (slots.length === 0) return toast.error("Set slot pattern (uses Slot Template settings)");
    // pair media → slots (cycle media if fewer than slots)
    const newRows = slots.map((s, i) => {
      const mid = selectedMedia[i % selectedMedia.length];
      const m = libMedia.find((x) => x.media_id === mid);
      return {
        key: `mm_${i}_${Math.random().toString(36).slice(2, 7)}`,
        title: `${shared.titlePrefix || "Post"} #${i + 1}`,
        caption: shared.caption,
        hashtags: shared.hashtags,
        platforms: [...shared.platforms],
        media_id: mid,
        media_name: m?.original_name || mid,
        media_thumb: m?.type === "video" ? m?.thumbnail : m?.filename,
        scheduled_at: s,
      };
    });
    setRows(newRows);
    toast.success(`Generated ${newRows.length} slots`);
  };

  const buildFromTemplate = () => {
    if (shared.platforms.length === 0) return toast.error("Pick platforms in shared defaults");
    const slots = mode === "pattern" ? generatePatternSlots(pattern) : generateIntervalSlots(interval);
    if (slots.length === 0) return toast.error("No slots generated — check the pattern");
    const m = libMedia.find((x) => x.media_id === templateMediaId);
    const newRows = slots.map((s, i) => ({
      key: `t_${i}_${Math.random().toString(36).slice(2, 7)}`,
      title: `${shared.titlePrefix || "Post"} #${i + 1}`,
      caption: shared.caption,
      hashtags: shared.hashtags,
      platforms: [...shared.platforms],
      media_id: templateMediaId || "",
      media_name: m?.original_name || (templateMediaId ? templateMediaId : ""),
      media_thumb: m?.type === "video" ? m?.thumbnail : m?.filename,
      scheduled_at: s,
    }));
    setRows(newRows);
    toast.success(`Generated ${newRows.length} slots`);
  };

  const buildFromCsv = async (file) => {
    if (!file) return;
    const text = await file.text();
    const { headers, rows: parsed } = parseCsv(text);
    if (!parsed.length) return toast.error("CSV appears empty");
    const required = ["title", "scheduled_at"];
    const missing = required.filter((r) => !headers.includes(r));
    if (missing.length) return toast.error(`Missing columns: ${missing.join(", ")}`);
    const newRows = parsed.map((r, i) => {
      const platforms = (r.platforms || shared.platforms.join("|"))
        .split("|").map((x) => x.trim()).filter(Boolean);
      const m = libMedia.find((x) => x.media_id === r.media_id);
      return {
        key: `csv_${i}_${Math.random().toString(36).slice(2, 7)}`,
        title: r.title || `Post #${i + 1}`,
        caption: r.caption || shared.caption,
        hashtags: r.hashtags || shared.hashtags,
        platforms: platforms.length ? platforms : [...shared.platforms],
        media_id: r.media_id || "",
        media_name: m?.original_name || r.media_id || "",
        media_thumb: m?.type === "video" ? m?.thumbnail : m?.filename,
        scheduled_at: dayjs(r.scheduled_at).format("YYYY-MM-DDTHH:mm"),
      };
    });
    setRows(newRows);
    toast.success(`Parsed ${newRows.length} rows`);
  };

  const updateRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const deleteRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const duplicateRow = (key) => setRows((rs) => {
    const i = rs.findIndex((r) => r.key === key);
    if (i < 0) return rs;
    const src = rs[i];
    return [...rs.slice(0, i + 1), { ...src, key: `${src.key}_dup_${Date.now()}` }, ...rs.slice(i + 1)];
  });
  const addBlankRow = () => setRows((rs) => [...rs, {
    key: `new_${Date.now()}`,
    title: `${shared.titlePrefix || "Post"} #${rs.length + 1}`,
    caption: shared.caption, hashtags: shared.hashtags,
    platforms: [...shared.platforms], media_id: "", media_name: "",
    scheduled_at: dayjs().add(1, "hour").format("YYYY-MM-DDTHH:mm"),
  }]);

  const submitBulk = async () => {
    if (rows.length === 0) return toast.error("No rows to schedule");
    const bad = rows.find((r) => !r.title.trim() || !r.platforms.length || !r.scheduled_at);
    if (bad) return toast.error("Every row needs a title, platform, and time");
    setSubmitting(true);
    try {
      const items = rows.map((r) => ({
        title: r.title,
        caption: r.caption,
        description: shared.description,
        hashtags: (r.hashtags || "").split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
        tags: shared.tags.split(",").map((s) => s.trim()).filter(Boolean),
        media_ids: r.media_id ? [r.media_id] : [],
        platforms: r.platforms,
        scheduled_at: dayjs.tz(r.scheduled_at, shared.timezone).utc().toISOString(),
        timezone: shared.timezone,
        recurrence: shared.recurrence,
      }));
      const r = await api.post("/posts/bulk", { items });
      toast.success(`Scheduled ${r.data.created_count} posts${r.data.errors?.length ? ` · ${r.data.errors.length} failed` : ""}`);
      if (r.data.errors?.length) console.warn("Bulk errors:", r.data.errors);
      navigate("/calendar");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Bulk schedule failed");
    }
    setSubmitting(false);
  };

  const previewSlots = useMemo(
    () => (mode === "pattern" ? generatePatternSlots(pattern) : generateIntervalSlots(interval)),
    [mode, pattern, interval],
  );

  return (
    <div data-testid="bulk-scheduler-page" className="p-6 sm:p-8 max-w-7xl">
      <p className="vg-label text-[10px] font-semibold text-white/50 mb-2">Batch</p>
      <h1 className="vg-tick text-3xl sm:text-4xl tracking-tighter font-light mb-8">Bulk Scheduler</h1>

      {/* Shared defaults */}
      <div className="vg-panel bg-ink-900 p-6 mb-6">
        <p className="vg-label text-[10px] font-semibold text-white/50 mb-4">Shared Defaults</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <input data-testid="shared-title-prefix" value={shared.titlePrefix} onChange={(e) => setShared({ ...shared, titlePrefix: e.target.value })} placeholder="Title prefix (e.g. Morning Reel)"
            className="h-11 bg-ink-800 border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40" />
          <select data-testid="shared-timezone" value={shared.timezone} onChange={(e) => setShared({ ...shared, timezone: e.target.value })}
            className="h-11 bg-ink-800 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40">
            {[...new Set([shared.timezone, ...TIMEZONES])].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select data-testid="shared-recurrence" value={shared.recurrence} onChange={(e) => setShared({ ...shared, recurrence: e.target.value })}
            className="h-11 bg-ink-800 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40">
            <option value="none">One-time</option>
            <option value="daily">Recurring · Daily</option>
            <option value="weekly">Recurring · Weekly</option>
          </select>
        </div>
        <textarea data-testid="shared-caption" value={shared.caption} onChange={(e) => setShared({ ...shared, caption: e.target.value })} placeholder="Default caption"
          rows={2} className="w-full bg-ink-800 border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-white/40 mb-3" />
        <input data-testid="shared-hashtags" value={shared.hashtags} onChange={(e) => setShared({ ...shared, hashtags: e.target.value })} placeholder="Default hashtags (comma separated)"
          className="w-full h-11 bg-ink-800 border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40 mb-4" />
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-white/40 mb-2">Default Platforms</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLATFORM_META).map(([id, { name, Icon, color }]) => {
              const isSel = shared.platforms.includes(id);
              const isConn = connected.has(id);
              return (
                <button key={id} data-testid={`shared-platform-${id}`} onClick={() => togglePlatform(id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-colors duration-200 ${
                    isSel ? "border-white vg-btn vg-btn-primary" : "border-white/20 text-white/70 hover:bg-white/5"
                  } ${!isConn ? "opacity-40" : ""}`}>
                  <Icon size={12} style={{ color: isSel ? color : color }} />
                  {name}
                  {isSel && <CheckCircle2 size={12} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {/* Three tabs do not fit a phone width — let the row scroll rather than
          widening the page. */}
      <div className="flex gap-1 border-b border-white/10 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} data-testid={`bulk-tab-${id}`} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-[0.15em] whitespace-nowrap shrink-0 transition-colors duration-200 border-b-2 -mb-px ${
              tab === id ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"
            }`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Tab bodies */}
      {tab === "multi" && (
        <div className="vg-panel bg-ink-900 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="vg-label text-[10px] font-semibold text-white/50">Pick or Upload Media</p>
            <button data-testid="multi-upload-button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="h-9 px-4 vg-btn vg-btn-primary rounded-md text-xs font-medium flex items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200 disabled:opacity-50">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Upload files
            </button>
            <input ref={fileRef} type="file" multiple accept="video/*,image/*" className="hidden"
              data-testid="multi-file-input" onChange={(e) => uploadMulti(Array.from(e.target.files || []))} />
          </div>

          {libMedia.length === 0 ? (
            <p className="text-xs text-white/40 py-8 text-center">No media yet. Upload a few files to start.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {libMedia.map((m) => {
                const sel = selectedMedia.includes(m.media_id);
                return (
                  <button key={m.media_id} data-testid={`multi-media-${m.media_id}`}
                    onClick={() => setSelectedMedia((s) => (sel ? s.filter((x) => x !== m.media_id) : [...s, m.media_id]))}
                    className={`relative aspect-square rounded-md overflow-hidden border transition-colors duration-200 ${sel ? "border-white ring-2 ring-white/40" : "border-white/10 hover:border-white/30"}`}>
                    <img src={mediaUrl(m.type === "video" ? m.thumbnail : m.filename)} alt="" className="w-full h-full object-cover" />
                    {sel && <div className="absolute top-1 right-1 vg-btn vg-btn-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">{selectedMedia.indexOf(m.media_id) + 1}</div>}
                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] px-1.5 py-0.5 truncate text-white/80">{m.original_name}</div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-[11px] text-white/40 mt-4">Selected media will be paired with slots defined in <b>Slot Template</b> below. If media count &lt; slots, we&apos;ll cycle through them.</p>

          <SlotTemplateBlock mode={mode} setMode={setMode} pattern={pattern} setPattern={setPattern} interval={interval} setInterval={setInterval} previewSlots={previewSlots} />

          <div className="mt-6">
            <button data-testid="build-multi-button" onClick={buildFromMulti}
              className="h-11 px-6 vg-btn vg-btn-primary rounded-md text-sm font-medium flex items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200">
              <Wand2 size={14} /> Generate Preview ({selectedMedia.length ? `${selectedMedia.length} media × ${previewSlots.length} slots` : "select media"})
            </button>
          </div>
        </div>
      )}

      {tab === "template" && (
        <div className="vg-panel bg-ink-900 p-6 mb-6">
          <p className="vg-label text-[10px] font-semibold text-white/50 mb-4">Single Media (optional)</p>
          <select data-testid="template-media-select" value={templateMediaId} onChange={(e) => setTemplateMediaId(e.target.value)}
            className="w-full max-w-md h-11 bg-ink-800 border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40 mb-4">
            <option value="">— No media (text-only posts) —</option>
            {libMedia.map((m) => <option key={m.media_id} value={m.media_id}>{m.original_name} · {m.type}</option>)}
          </select>

          <SlotTemplateBlock mode={mode} setMode={setMode} pattern={pattern} setPattern={setPattern} interval={interval} setInterval={setInterval} previewSlots={previewSlots} />

          <div className="mt-6">
            <button data-testid="build-template-button" onClick={buildFromTemplate}
              className="h-11 px-6 vg-btn vg-btn-primary rounded-md text-sm font-medium flex items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200">
              <Wand2 size={14} /> Generate {previewSlots.length} slot preview
            </button>
          </div>
        </div>
      )}

      {tab === "csv" && (
        <div className="vg-panel bg-ink-900 p-6 mb-6">
          <p className="vg-label text-[10px] font-semibold text-white/50 mb-4">Upload CSV</p>
          <p className="text-xs text-white/50 mb-3">Required columns: <b>title, scheduled_at</b>. Optional: <code>caption, hashtags, media_id, platforms</code> (platforms pipe-separated, e.g. <code>youtube_shorts|tiktok</code>). Times are interpreted in your chosen timezone.</p>
          <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden"
            data-testid="csv-file-input" onChange={(e) => buildFromCsv(e.target.files?.[0])} />
          <button data-testid="csv-upload-button" onClick={() => csvRef.current?.click()}
            className="h-11 px-5 vg-btn vg-btn-primary rounded-md text-sm font-medium flex items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200">
            <UploadCloud size={14} /> Choose CSV file
          </button>
          <pre className="mt-4 text-[11px] text-white/40 bg-ink-800 border border-white/5 rounded-md p-3 overflow-auto">{`title,caption,hashtags,media_id,platforms,scheduled_at
Morning motivation,"Rise & grind","monday,motivation",media_abc123,youtube_shorts|tiktok,2026-02-20T09:00
Product launch,"Available now","launch,new",media_def456,instagram_reels,2026-02-20T18:00`}</pre>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="vg-panel bg-ink-900">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <p className="vg-label text-[10px] font-semibold text-white/50">Preview</p>
              <p className="text-sm mt-0.5">{rows.length} post{rows.length === 1 ? "" : "s"} to be scheduled</p>
            </div>
            <div className="flex gap-2">
              <button data-testid="add-blank-row" onClick={addBlankRow}
                className="h-9 px-4 border border-white/20 text-white/80 rounded-md text-xs flex items-center gap-2 hover:bg-white/5 transition-colors duration-200">
                <Plus size={12} /> Add row
              </button>
              <button data-testid="clear-rows" onClick={() => setRows([])}
                className="h-9 px-4 border border-white/20 text-white/60 rounded-md text-xs flex items-center gap-2 hover:bg-white/5 transition-colors duration-200">
                <Trash2 size={12} /> Clear all
              </button>
              <button data-testid="bulk-schedule-submit" onClick={submitBulk} disabled={submitting}
                className="h-9 px-5 bg-amber-400 text-black rounded-md text-xs font-medium flex items-center gap-2 hover:-translate-y-0.5 transition-transform duration-200 disabled:opacity-50">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />} Schedule all ({rows.length})
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.02] text-[10px] tracking-[0.15em] uppercase text-white/40">
                <tr>
                  <th className="text-left px-4 py-3 w-8">#</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3">Scheduled at</th>
                  <th className="text-left px-4 py-3">Media</th>
                  <th className="text-left px-4 py-3">Platforms</th>
                  <th className="text-left px-4 py-3">Caption</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key} data-testid={`bulk-row-${i}`} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white/40">{i + 1}</td>
                    <td className="px-4 py-3">
                      <input data-testid={`row-title-${i}`} value={r.title} onChange={(e) => updateRow(r.key, { title: e.target.value })}
                        className="w-40 h-8 bg-ink-800 border border-white/10 rounded px-2 text-xs focus:outline-none focus:border-white/40" />
                    </td>
                    <td className="px-4 py-3">
                      <input data-testid={`row-datetime-${i}`} type="datetime-local" value={r.scheduled_at}
                        onChange={(e) => updateRow(r.key, { scheduled_at: e.target.value })}
                        className="h-8 bg-ink-800 border border-white/10 rounded px-2 text-xs focus:outline-none focus:border-white/40" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.media_thumb && <img src={mediaUrl(r.media_thumb)} alt="" className="w-8 h-8 rounded object-cover border border-white/10" />}
                        <select data-testid={`row-media-${i}`} value={r.media_id} onChange={(e) => {
                          const m = libMedia.find((x) => x.media_id === e.target.value);
                          updateRow(r.key, { media_id: e.target.value, media_name: m?.original_name || "", media_thumb: m?.type === "video" ? m?.thumbnail : m?.filename });
                        }}
                          className="max-w-[140px] h-8 bg-ink-800 border border-white/10 rounded px-2 text-xs focus:outline-none focus:border-white/40">
                          <option value="">—</option>
                          {libMedia.map((m) => <option key={m.media_id} value={m.media_id}>{m.original_name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {Object.keys(PLATFORM_META).map((id) => {
                          const active = r.platforms.includes(id);
                          const M = PLATFORM_META[id];
                          return (
                            <button key={id} data-testid={`row-platform-${i}-${id}`}
                              onClick={() => updateRow(r.key, { platforms: active ? r.platforms.filter((x) => x !== id) : [...r.platforms, id] })}
                              className={`p-1.5 rounded border transition-colors duration-200 ${active ? "border-white bg-white/10" : "border-white/10 hover:border-white/30"}`}
                              title={M.name}>
                              <M.Icon size={11} style={{ color: M.color }} />
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input data-testid={`row-caption-${i}`} value={r.caption} onChange={(e) => updateRow(r.key, { caption: e.target.value })}
                        className="w-56 h-8 bg-ink-800 border border-white/10 rounded px-2 text-xs focus:outline-none focus:border-white/40" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button data-testid={`row-duplicate-${i}`} onClick={() => duplicateRow(r.key)} className="text-white/40 hover:text-white p-1 transition-colors duration-200"><Copy size={13} /></button>
                      <button data-testid={`row-delete-${i}`} onClick={() => deleteRow(r.key)} className="text-white/40 hover:text-red-400 p-1 transition-colors duration-200"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Slot template block (used inside multi + template tabs) ----------
function SlotTemplateBlock({ mode, setMode, pattern, setPattern, interval, setInterval, previewSlots }) {
  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <p className="vg-label text-[10px] font-semibold text-white/50 mr-2">Slot Pattern</p>
        <button data-testid="mode-pattern" onClick={() => setMode("pattern")}
          className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors duration-200 ${mode === "pattern" ? "vg-btn vg-btn-primary border-white" : "border-white/20 text-white/60 hover:text-white"}`}>
          Days × Times
        </button>
        <button data-testid="mode-interval" onClick={() => setMode("interval")}
          className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors duration-200 ${mode === "interval" ? "vg-btn vg-btn-primary border-white" : "border-white/20 text-white/60 hover:text-white"}`}>
          Interval + Count
        </button>
      </div>

      {mode === "pattern" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-white/40 block mb-1">Start date</label>
              <input data-testid="pattern-start-date" type="date" value={pattern.startDate} onChange={(e) => setPattern({ ...pattern, startDate: e.target.value })}
                className="w-full h-10 bg-ink-800 border border-white/10 rounded-md px-3 text-xs focus:outline-none focus:border-white/40" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-white/40 block mb-1">End date</label>
              <input data-testid="pattern-end-date" type="date" value={pattern.endDate} onChange={(e) => setPattern({ ...pattern, endDate: e.target.value })}
                className="w-full h-10 bg-ink-800 border border-white/10 rounded-md px-3 text-xs focus:outline-none focus:border-white/40" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-white/40 block mb-1">Days of week</label>
            <div className="flex flex-wrap gap-1">
              {WEEK.map(({ i, label }) => {
                const on = pattern.days.includes(i);
                return (
                  <button key={i} data-testid={`pattern-day-${label}`}
                    onClick={() => setPattern({ ...pattern, days: on ? pattern.days.filter((d) => d !== i) : [...pattern.days, i] })}
                    className={`w-11 h-9 text-[10px] rounded-md border transition-colors duration-200 ${on ? "vg-btn vg-btn-primary border-white" : "border-white/15 text-white/60 hover:bg-white/5"}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="text-[10px] uppercase text-white/40 block mb-1">Times of day (HH:mm)</label>
            <div className="flex flex-wrap gap-2">
              {pattern.times.map((t, i) => (
                <div key={i} className="flex items-center gap-1 bg-ink-800 border border-white/10 rounded-md px-2 h-9">
                  <input data-testid={`pattern-time-${i}`} type="time" value={t}
                    onChange={(e) => setPattern({ ...pattern, times: pattern.times.map((x, j) => (j === i ? e.target.value : x)) })}
                    className="bg-transparent text-xs w-24 focus:outline-none" />
                  <button onClick={() => setPattern({ ...pattern, times: pattern.times.filter((_, j) => j !== i) })}
                    className="text-white/40 hover:text-red-400 transition-colors duration-200"><Trash2 size={12} /></button>
                </div>
              ))}
              <button data-testid="pattern-add-time" onClick={() => setPattern({ ...pattern, times: [...pattern.times, "12:00"] })}
                className="h-9 px-3 border border-dashed border-white/20 rounded-md text-[11px] text-white/60 hover:text-white hover:border-white/40 transition-colors duration-200 flex items-center gap-1">
                <Plus size={11} /> Add time
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="text-[10px] uppercase text-white/40 block mb-1">Start date & time</label>
            <input data-testid="interval-start" type="datetime-local" value={interval.startDatetime} onChange={(e) => setInterval({ ...interval, startDatetime: e.target.value })}
              className="w-full h-10 bg-ink-800 border border-white/10 rounded-md px-3 text-xs focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-white/40 block mb-1">Every</label>
            <div className="flex gap-1">
              <input data-testid="interval-value" type="number" min="1" value={interval.intervalValue} onChange={(e) => setInterval({ ...interval, intervalValue: Number(e.target.value) || 1 })}
                className="w-16 h-10 bg-ink-800 border border-white/10 rounded-md px-2 text-xs focus:outline-none focus:border-white/40" />
              <select data-testid="interval-unit" value={interval.intervalUnit} onChange={(e) => setInterval({ ...interval, intervalUnit: e.target.value })}
                className="flex-1 h-10 bg-ink-800 border border-white/10 rounded-md px-2 text-xs focus:outline-none focus:border-white/40">
                <option value="hour">hours</option>
                <option value="day">days</option>
                <option value="week">weeks</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-white/40 block mb-1">Total posts</label>
            <input data-testid="interval-count" type="number" min="1" max="200" value={interval.count} onChange={(e) => setInterval({ ...interval, count: Number(e.target.value) || 1 })}
              className="w-full h-10 bg-ink-800 border border-white/10 rounded-md px-3 text-xs focus:outline-none focus:border-white/40" />
          </div>
        </div>
      )}

      <p data-testid="slot-preview-count" className="text-[11px] text-white/50 mt-3">
        {previewSlots.length > 0
          ? <>Will generate <b className="text-white">{previewSlots.length}</b> slots · first: {previewSlots[0]} · last: {previewSlots[previewSlots.length - 1]}</>
          : <>No slots yet — configure the pattern above.</>}
      </p>
    </div>
  );
}
