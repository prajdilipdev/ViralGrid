import { Loader2, ServerCrash, RotateCw } from "lucide-react";
import { useBackendStatus, ESTIMATED_WAKE_SECONDS } from "../context/BackendStatus";

/**
 * Small bottom-left bar that appears only while the backend is cold-starting
 * (or unreachable). Stays out of the way once the server is warm.
 */
export default function ServerStatusBar() {
  const { status, elapsed, retry } = useBackendStatus();
  if (status !== "waking" && status !== "error") return null;

  const remaining = Math.max(0, ESTIMATED_WAKE_SECONDS - elapsed);
  const pct = Math.min(96, (elapsed / ESTIMATED_WAKE_SECONDS) * 100);

  return (
    <div
      data-testid="server-status-bar"
      className="fixed bottom-4 left-4 z-50 w-[290px] border border-white/10 bg-[#0A0A0B]/95 backdrop-blur rounded-md shadow-2xl overflow-hidden"
      role="status"
      aria-live="polite"
    >
      {status === "waking" ? (
        <>
          <div className="p-3.5 flex items-start gap-3">
            <Loader2 size={15} className="text-white/70 animate-spin shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white">Waking up the server…</p>
              <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                The free server sleeps when idle. {remaining > 0 ? `About ${remaining}s left.` : "Almost there…"}
              </p>
            </div>
            <span className="ml-auto text-[10px] tabular-nums text-white/35 shrink-0">{elapsed}s</span>
          </div>
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-white/50 transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <div className="p-3.5 flex items-start gap-3">
          <ServerCrash size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white">Can't reach the server</p>
            <p className="text-[11px] text-white/45 mt-1">It may still be starting up.</p>
          </div>
          <button
            onClick={retry}
            data-testid="server-retry-button"
            className="text-[11px] text-white/70 hover:text-white flex items-center gap-1 shrink-0 transition-colors duration-200"
          >
            <RotateCw size={11} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}
