import { useEffect, useRef, useState } from "react";
import { Loader2, ServerCrash, RotateCw, CheckCircle2 } from "lucide-react";
import { useBackendStatus, ESTIMATED_WAKE_SECONDS } from "../context/BackendStatus";

// How long the "ready" confirmation lingers before the bar retires itself.
const READY_LINGER_MS = 1400;

/**
 * Small bottom-left bar reporting how the backend is doing.
 *
 * It shows from the moment the app loads rather than waiting for the
 * cold-start threshold, so the ping is always visible: on a warm server that
 * is a brief "connecting" then a "ready" tick, and on a cold one it becomes
 * the wake-up timer. Reporting only the slow case made a warm start and a
 * broken one look identical — both showed nothing at all.
 */
export default function ServerStatusBar() {
  const { status, elapsed, retry } = useBackendStatus();
  const [lingering, setLingering] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    if (status !== "ready" || settled.current) return;
    // Only confirm once per session, so route changes don't re-flash the bar.
    settled.current = true;
    setLingering(true);
    const t = setTimeout(() => setLingering(false), READY_LINGER_MS);
    return () => clearTimeout(t);
  }, [status]);

  if (status === "ready" && !lingering) return null;

  const remaining = Math.max(0, ESTIMATED_WAKE_SECONDS - elapsed);
  const pct = Math.min(96, (elapsed / ESTIMATED_WAKE_SECONDS) * 100);

  if (status === "ready") {
    return (
      <div
        data-testid="server-status-bar"
        className="fixed bottom-4 left-4 z-50 w-[290px] vg-panel bg-ink-900/95 backdrop-blur rounded-md shadow-2xl overflow-hidden vg-fade-up"
        role="status"
        aria-live="polite"
      >
        <div className="p-3.5 flex items-start gap-3">
          <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white">Server ready</p>
            <p className="text-[11px] text-white/45 mt-1">Connected in {elapsed}s.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div
        data-testid="server-status-bar"
        className="fixed bottom-4 left-4 z-50 w-[290px] vg-panel bg-ink-900/95 backdrop-blur rounded-md shadow-2xl overflow-hidden"
        role="status"
        aria-live="polite"
      >
        <div className="p-3.5 flex items-start gap-3">
          <Loader2 size={15} className="text-white/70 animate-spin shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-white">Contacting the server…</p>
            <p className="text-[11px] text-white/45 mt-1">Checking whether it's awake.</p>
          </div>
          <span className="ml-auto text-[10px] tabular-nums text-white/35 shrink-0">{elapsed}s</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="server-status-bar"
      className="fixed bottom-4 left-4 z-50 w-[290px] vg-panel bg-ink-900/95 backdrop-blur rounded-md shadow-2xl overflow-hidden"
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
