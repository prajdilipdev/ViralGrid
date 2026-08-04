import { useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import { toast } from "sonner";
import { Plug, Unplug, AlertTriangle } from "lucide-react";
import { ConnectionsSkeleton } from "../components/Skeletons";
import ErrorState from "../components/ErrorState";

const INSTAGRAM = "instagram_reels";
const YOUTUBE = "youtube_shorts";

// Platforms that have a real OAuth flow behind them. Everything else is still
// simulated, so its Connect button just records a local connection.
const LIVE_PLATFORMS = {
  [INSTAGRAM]: { statusPath: "/instagram/status", authorizePath: "/instagram/authorize", param: "ig" },
  [YOUTUBE]: { statusPath: "/youtube/status", authorizePath: "/youtube/authorize", param: "yt" },
};

export default function Connections() {
  const [conns, setConns] = useState([]);
  const [busy, setBusy] = useState(null);
  // Which real integrations the server actually has credentials for.
  const [live, setLive] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    return api
      .get("/connections")
      .then((r) => setConns(r.data))
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    Object.entries(LIVE_PLATFORMS).forEach(([id, cfg]) => {
      api
        .get(cfg.statusPath)
        .then((r) => setLive((prev) => ({ ...prev, [id]: r.data.configured })))
        .catch(() => {});
    });
    // Surface the result of whichever OAuth redirect we just came back from.
    const params = new URLSearchParams(window.location.search);
    let hit = null;
    Object.entries(LIVE_PLATFORMS).forEach(([id, cfg]) => {
      const outcome = params.get(cfg.param);
      if (!outcome) return;
      hit = cfg.param;
      const name = PLATFORM_META[id]?.name || id;
      // Name the account we landed on. For YouTube this is the difference
      // between the channel you meant and another one on the same Google
      // account, which is otherwise invisible until videos appear on it.
      const who = params.get("msg");
      if (outcome === "connected") toast.success(who ? `${name} connected — ${who}` : `${name} connected`);
      else if (outcome === "error") toast.error(params.get("msg") || `${name} connection failed`);
    });
    if (hit) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const connMap = Object.fromEntries(conns.map((c) => [c.platform, c]));
  const liveNames = Object.keys(LIVE_PLATFORMS)
    .filter((id) => live[id])
    .map((id) => PLATFORM_META[id]?.name || id);

  const connect = async (platform) => {
    setBusy(platform);
    try {
      const cfg = LIVE_PLATFORMS[platform];
      if (cfg && live[platform]) {
        const r = await api.get(cfg.authorizePath);
        window.location.href = r.data.url; // hand off to the platform's OAuth
        return;
      }
      await api.post("/connections", { platform });
      toast.success(`${PLATFORM_META[platform].name} connected`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Connection failed"); }
    setBusy(null);
  };

  const disconnect = async (platform) => {
    setBusy(platform);
    try {
      await api.delete(`/connections/${platform}`);
      toast.success(`${PLATFORM_META[platform].name} disconnected`);
      load();
    } catch { toast.error("Failed to disconnect"); }
    setBusy(null);
  };

  return (
    <div data-testid="connections-page" className="p-6 sm:p-8">
      <p className="vg-label text-[10px] font-semibold text-white/50 mb-2">Integrations</p>
      <h1 className="vg-tick text-3xl sm:text-4xl tracking-tighter font-light mb-3">Account Connections</h1>
      <p className="text-sm text-white/50 mb-8 max-w-2xl">
        {liveNames.length > 0
          ? `${liveNames.join(" and ")} publish${liveNames.length === 1 ? "es" : ""} for real. The remaining platforms are simulated until their developer apps are set up.`
          : "All connections are simulated. Configure platform credentials on the server to publish for real."}
      </p>
      {live[YOUTUBE] && (
        <div className="vg-panel bg-ink-900 p-4 mb-8 max-w-2xl flex items-start gap-3">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            YouTube locks videos uploaded through an un-audited API project to{" "}
            <span className="text-white">Private</span>, and it can't be appealed. Shorts will
            upload fine, but you'll need to make each one public in YouTube Studio until Google
            approves the API audit for this project.
          </p>
        </div>
      )}

      {loading ? <ConnectionsSkeleton count={7} /> : error ? (
        <div className="vg-panel bg-ink-900">
          <ErrorState what="your connections" error={error} onRetry={load} />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/5">
        {Object.entries(PLATFORM_META).map(([id, { name, Icon, color }], i) => {
          const conn = connMap[id];
          return (
            <div key={id} data-testid={`connection-card-${id}`}
              className="border-r border-b border-white/5 bg-ink-900 p-6 flex flex-col gap-5 vg-fade-up"
              style={{ "--vg-stagger": `${i * 40}ms` }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md border border-white/10 bg-white/5 flex items-center justify-center">
                  <Icon size={22} style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{name}</p>
                    {live[id] ? (
                      <span className="text-[9px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300 border border-emerald-400/20">Live</span>
                    ) : (
                      <span className="text-[9px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">Simulated</span>
                    )}
                  </div>
                  <p className="text-xs text-white/40">{conn ? conn.handle : "Not connected"}</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${conn ? "bg-emerald-400" : "bg-white/20"}`} />
              </div>
              {conn ? (
                <button
                  data-testid={`disconnect-${id}-button`}
                  disabled={busy === id}
                  onClick={() => disconnect(id)}
                  className="h-10 border border-white/15 text-white/70 rounded-md text-xs font-medium flex items-center justify-center gap-2 hover:bg-white/5 hover:text-white transition-colors duration-200"
                >
                  <Unplug size={13} /> Disconnect
                </button>
              ) : (
                <button
                  data-testid={`connect-${id}-button`}
                  disabled={busy === id}
                  onClick={() => connect(id)}
                  className="h-10 vg-btn vg-btn-primary rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Plug size={13} /> Connect Account
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
