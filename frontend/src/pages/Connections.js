import { useEffect, useState } from "react";
import api from "../lib/api";
import { PLATFORM_META } from "../lib/platforms";
import { toast } from "sonner";
import { Plug, Unplug } from "lucide-react";

export default function Connections() {
  const [conns, setConns] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = () => api.get("/connections").then((r) => setConns(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const connMap = Object.fromEntries(conns.map((c) => [c.platform, c]));

  const connect = async (platform) => {
    setBusy(platform);
    try {
      await api.post("/connections", { platform });
      toast.success(`${PLATFORM_META[platform].name} connected`);
      load();
    } catch { toast.error("Connection failed"); }
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
      <p className="text-xs tracking-[0.2em] uppercase font-semibold text-white/50 mb-2">Integrations</p>
      <h1 className="text-3xl sm:text-4xl tracking-tighter font-light mb-3" style={{ fontFamily: "Outfit" }}>Account Connections</h1>
      <p className="text-sm text-white/50 mb-8 max-w-2xl">
        Simulated connections for now — swap in real OAuth credentials per platform when your developer apps are approved.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/5">
        {Object.entries(PLATFORM_META).map(([id, { name, Icon, color }]) => {
          const conn = connMap[id];
          return (
            <div key={id} data-testid={`connection-card-${id}`} className="border-r border-b border-white/5 bg-[#0A0A0B] p-6 flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md border border-white/10 bg-white/5 flex items-center justify-center">
                  <Icon size={22} style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{name}</p>
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
                  className="h-10 bg-white text-black rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <Plug size={13} /> Connect Account
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
