import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { mediaUrl } from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import { useBackendStatus } from "../context/BackendStatus";
import { toast } from "sonner";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import { UploadCloud, Sparkles, Send, Save, CalendarClock, CheckCircle2, AlertTriangle, XCircle, Loader2, X } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(tz);

const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

const CheckIcon = ({ level }) =>
  level === "ok" ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> :
  level === "warn" ? <AlertTriangle size={12} className="text-amber-400 shrink-0" /> :
  <XCircle size={12} className="text-red-400 shrink-0" />;

export default function Composer() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [conns, setConns] = useState([]);
  const [media, setMedia] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ title: "", caption: "", description: "", hashtags: "", tags: "" });
  const [overrides, setOverrides] = useState({});
  const [validations, setValidations] = useState([]);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [schedule, setSchedule] = useState({ enabled: false, datetime: "", timezone: dayjs.tz.guess() || "UTC", recurrence: "none" });
  const [submitting, setSubmitting] = useState(null);
  const { ensureAwake } = useBackendStatus();

  useEffect(() => { api.get("/connections").then((r) => setConns(r.data)).catch(() => {}); }, []);
  const connected = new Set(conns.map((c) => c.platform));

  useEffect(() => {
    if (media && selected.length) {
      api.post("/media/validate", { media_id: media.media_id, platforms: selected })
        .then((r) => setValidations(r.data.validations)).catch(() => {});
    } else setValidations([]);
  }, [media, selected]);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    // Make sure the server is awake before sending a large file, otherwise the
    // upload sits there while the instance cold-starts.
    const awake = await ensureAwake();
    if (!awake) {
      toast.error("Server isn't responding yet — please try again in a moment");
      setUploading(false);
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/media/upload", fd, {
        timeout: 0, // large videos can take a while
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setMedia(r.data);
      toast.success("Media uploaded & analyzed");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Upload failed");
    }
    setUploading(false);
    setProgress(0);
  };

  const togglePlatform = (id) => {
    if (!connected.has(id)) { toast.error(`Connect ${PLATFORM_META[id].name} first (Connections page)`); return; }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const generateAI = async () => {
    if (!aiTopic.trim()) { toast.error("Describe your content topic first"); return; }
    setAiBusy(true);
    try {
      const r = await api.post("/ai/generate", { topic: aiTopic, platforms: selected });
      setForm((f) => ({ ...f, caption: r.data.caption, description: r.data.description, hashtags: r.data.hashtags.join(", ") }));
      toast.success("AI copy generated");
    } catch { toast.error("AI generation failed, try again"); }
    setAiBusy(false);
  };

  const submit = async (action) => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (action !== "draft" && selected.length === 0) { toast.error("Select at least one platform"); return; }
    let scheduledAt = null;
    if (action === "schedule") {
      if (!schedule.datetime) { toast.error("Pick a date & time"); return; }
      scheduledAt = dayjs.tz(schedule.datetime, schedule.timezone).utc().toISOString();
    }
    setSubmitting(action);
    try {
      const payload = {
        title: form.title, caption: form.caption, description: form.description,
        hashtags: form.hashtags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        media_ids: media ? [media.media_id] : [],
        platforms: selected, platform_overrides: overrides,
        action, scheduled_at: scheduledAt, timezone: schedule.timezone, recurrence: schedule.recurrence,
      };
      const r = await api.post("/posts", payload);
      if (action === "publish") {
        const rs = r.data.platform_results || {};
        const ok = Object.values(rs).filter((x) => x.status === "published").length;
        toast.success(`Published to ${ok}/${Object.keys(rs).length} platforms`);
        navigate("/history");
      } else if (action === "schedule") {
        toast.success("Post scheduled");
        navigate("/calendar");
      } else {
        toast.success("Draft saved");
        navigate("/history");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Something went wrong");
    }
    setSubmitting(null);
  };

  return (
    <div data-testid="composer-page" className="p-6 sm:p-8 max-w-6xl">
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Create</p>
      <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-8" style={{ fontFamily: "Manrope" }}>Content Composer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Media upload */}
          <div className="border border-white/10 bg-[#0A0A0B] p-6">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-4">Media</p>
            {!media ? (
              <button
                data-testid="media-upload-dropzone"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border border-dashed border-white/20 rounded-md py-12 flex flex-col items-center gap-3 hover:border-white/40 transition-colors duration-200"
              >
                {uploading ? <Loader2 size={24} className="animate-spin text-white/60" /> : <UploadCloud size={24} className="text-white/60" />}
                <span className="text-sm text-white/60">
                  {uploading
                    ? progress > 0 && progress < 100
                      ? `Uploading… ${progress}%`
                      : progress >= 100
                        ? "Processing on server…"
                        : "Preparing upload…"
                    : "Upload video or image"}
                </span>
                {uploading && progress > 0 ? (
                  <div className="w-2/3 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-white/60 transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                ) : (
                  <span className="text-xs text-white/30">MP4, MOV, WEBM, JPG, PNG</span>
                )}
              </button>
            ) : (
              <div className="flex items-start gap-4">
                {media.type === "video" && media.thumbnail ? (
                  <img src={mediaUrl(media.thumbnail)} alt="thumb" className="w-32 rounded-md border border-white/10" />
                ) : media.type === "image" ? (
                  <img src={mediaUrl(media.filename)} alt="media" className="w-32 rounded-md border border-white/10" />
                ) : null}
                <div className="flex-1 text-xs text-white/60 space-y-1">
                  <p className="text-sm text-white font-medium">{media.original_name}</p>
                  <p>{media.type.toUpperCase()} · {(media.size / 1024 / 1024).toFixed(1)} MB {media.width ? `· ${media.width}x${media.height}` : ""}</p>
                  {media.duration && <p>{Math.round(media.duration)}s · {media.codec} {media.fps ? `· ${media.fps}fps` : ""}</p>}
                </div>
                <button data-testid="remove-media-button" onClick={() => setMedia(null)} className="text-white/40 hover:text-white transition-colors duration-200"><X size={16} /></button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="video/*,image/*" className="hidden" data-testid="media-file-input" onChange={(e) => upload(e.target.files?.[0])} />
          </div>

          {/* Details */}
          <div className="border border-white/10 bg-[#0A0A0B] p-6 space-y-4">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50">Details</p>
            <input data-testid="post-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Post title *"
              className="w-full h-11 bg-[#111113] border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
            <textarea data-testid="post-caption-input" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Caption" rows={2}
              className="w-full bg-[#111113] border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
            <textarea data-testid="post-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3}
              className="w-full bg-[#111113] border border-white/10 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input data-testid="post-hashtags-input" value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="Hashtags (comma separated)"
                className="h-11 bg-[#111113] border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
              <input data-testid="post-tags-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma separated)"
                className="h-11 bg-[#111113] border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
            </div>
          </div>

          {/* AI assist */}
          <div className="border border-white/10 bg-[#0A0A0B] p-6">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-4">AI Copywriter</p>
            <div className="flex gap-3">
              {/* min-w-0: an input keeps a default intrinsic width and will not
                  shrink inside a flex row without it. */}
              <input data-testid="ai-topic-input" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="What is this content about? e.g. '5 morning habits for productivity'"
                className="flex-1 min-w-0 h-11 bg-[#111113] border border-white/10 rounded-md px-4 text-sm focus:outline-none focus:border-white/40 transition-colors duration-200" />
              <button data-testid="ai-generate-button" onClick={generateAI} disabled={aiBusy}
                className="h-11 px-5 shrink-0 bg-white text-black rounded-md text-sm font-medium flex items-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50">
                {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate
              </button>
            </div>
          </div>

          {/* Schedule */}
          <div className="border border-white/10 bg-[#0A0A0B] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50">Scheduling</p>
              <button data-testid="schedule-toggle" onClick={() => setSchedule((s) => ({ ...s, enabled: !s.enabled }))}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 ${schedule.enabled ? "bg-white text-black border-white" : "border-white/20 text-white/60 hover:text-white"}`}>
                {schedule.enabled ? "Scheduled mode" : "Publish immediately"}
              </button>
            </div>
            {schedule.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input data-testid="schedule-datetime-input" type="datetime-local" value={schedule.datetime} onChange={(e) => setSchedule({ ...schedule, datetime: e.target.value })}
                  className="h-11 bg-[#111113] border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40 [color-scheme:dark]" />
                <select data-testid="schedule-timezone-select" value={schedule.timezone} onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                  className="h-11 bg-[#111113] border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40">
                  {[...new Set([schedule.timezone, ...TIMEZONES])].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select data-testid="schedule-recurrence-select" value={schedule.recurrence} onChange={(e) => setSchedule({ ...schedule, recurrence: e.target.value })}
                  className="h-11 bg-[#111113] border border-white/10 rounded-md px-3 text-sm focus:outline-none focus:border-white/40">
                  <option value="none">One-time</option>
                  <option value="daily">Recurring · Daily</option>
                  <option value="weekly">Recurring · Weekly</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button data-testid="save-draft-button" onClick={() => submit("draft")} disabled={!!submitting}
              className="h-12 px-6 border border-white/20 text-white/80 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-white/5 transition-colors duration-200 disabled:opacity-50">
              {submitting === "draft" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Draft
            </button>
            {schedule.enabled ? (
              <button data-testid="schedule-post-button" onClick={() => submit("schedule")} disabled={!!submitting}
                className="h-12 px-6 bg-amber-400 text-black rounded-md text-sm font-medium flex items-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-50">
                {submitting === "schedule" ? <Loader2 size={15} className="animate-spin" /> : <CalendarClock size={15} />} Schedule Post
              </button>
            ) : (
              <button data-testid="publish-now-button" onClick={() => submit("publish")} disabled={!!submitting}
                className="h-12 px-6 bg-white text-black rounded-md text-sm font-medium flex items-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50">
                {submitting === "publish" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish Now
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-white/10 bg-[#0A0A0B] p-6">
            <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-4">Platforms</p>
            <div className="space-y-1">
              {Object.entries(PLATFORM_META).map(([id, { name, Icon, color }]) => {
                const isConn = connected.has(id);
                const isSel = selected.includes(id);
                return (
                  <button key={id} data-testid={`platform-toggle-${id}`} onClick={() => togglePlatform(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors duration-200 ${
                      isSel ? "border-white/40 bg-white/10" : "border-transparent hover:bg-white/5"
                    } ${!isConn ? "opacity-40" : ""}`}>
                    <Icon size={16} style={{ color }} />
                    <span className="text-sm flex-1 text-left">{name}</span>
                    {!isConn && <span className="text-[10px] text-white/40 uppercase tracking-wider">Not connected</span>}
                    {isSel && <CheckCircle2 size={14} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/10 space-y-3">
                <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-white/40">Per-platform caption override</p>
                {selected.map((id) => (
                  <div key={id}>
                    <label className="text-[11px] text-white/50 flex items-center gap-1.5 mb-1">
                      {PLATFORM_META[id].name}
                    </label>
                    <input data-testid={`override-caption-${id}`} value={overrides[id]?.caption || ""} placeholder="Uses main caption if empty"
                      onChange={(e) => setOverrides({ ...overrides, [id]: { caption: e.target.value } })}
                      className="w-full h-9 bg-[#111113] border border-white/10 rounded-md px-3 text-xs focus:outline-none focus:border-white/40" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {validations.length > 0 && (
            <div data-testid="quality-validation-panel" className="border border-white/10 bg-[#0A0A0B] p-6">
              <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-4">Quality Validation</p>
              <div className="space-y-4">
                {validations.map((v) => {
                  const M = PLATFORM_META[v.platform];
                  return (
                    <div key={v.platform}>
                      <div className="flex items-center gap-2 mb-1.5">
                        {M && <M.Icon size={13} style={{ color: M.color }} />}
                        <span className="text-xs font-medium">{M?.name}</span>
                        <span className={`text-[9px] uppercase tracking-widest ml-auto ${v.status === "ok" ? "text-emerald-400" : v.status === "warn" ? "text-amber-400" : "text-red-400"}`}>
                          {v.status === "ok" ? "Ready" : v.status === "warn" ? "Will optimize" : "Blocked"}
                        </span>
                      </div>
                      {v.checks.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 pl-5 py-0.5">
                          <CheckIcon level={c.level} />
                          <span className="text-[11px] text-white/50">{c.message}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
