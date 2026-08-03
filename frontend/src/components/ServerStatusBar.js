import { useEffect, useRef, useState } from "react";
import { Loader2, ServerCrash, RotateCw, CheckCircle2 } from "lucide-react";
import { useBackendStatus, ESTIMATED_WAKE_SECONDS } from "../context/BackendStatus";
import { useAuth } from "../context/AuthContext";

// How long the "ready" confirmation lingers before the bar retires itself.
const READY_LINGER_MS = 1400;

const Shell = ({ children, footer }) => (
  <div
    data-testid="server-status-bar"
    className="fixed bottom-4 left-4 z-50 w-[290px] vg-panel bg-ink-900/95 backdrop-blur rounded-md shadow-2xl overflow-hidden"
    role="status"
    aria-live="polite"
  >
    <div className="p-3.5 flex items-start gap-3">{children}</div>
    {footer}
  </div>
);

/**
 * Small bottom-left bar reporting how the backend is doing.
 *
 * It shows from the moment the app loads rather than waiting for the
 * cold-start threshold, so the ping is always visible: on a warm server that
 * is a brief "contacting" then a "ready" tick, and on a cold one it becomes
 * the wake-up timer.
 *
 * It also stays up while the session check is still outstanding. /health is
 * trivial and answers immediately even when the database behind /auth/me is
 * still connecting, and that check retries with backoff — so tracking only the
 * health ping left the protected routes sitting on a bare "Loading…" with
 * nothing explaining the wait.
 */
export default function ServerStatusBar() {
  const { status, elapsed, retry } = useBackendStatus();
  // Rendered inside AuthProvider, but stay defensive: this bar must never be
  // the reason the app fails to paint.
  const authLoading = useAuth()?.loading ?? false;

  const [lingering, setLingering] = useState(false);
  const [authElapsed, setAuthElapsed] = useState(0);
  const settled = useRef(false);

  useEffect(() => {
    if (status !== "ready" || settled.current) return;
    // Only confirm once per session, so route changes don't re-flash the bar.
    settled.current = true;
    setLingering(true);
    const t = setTimeout(() => setLingering(false), READY_LINGER_MS);
    return () => clearTimeout(t);
  }, [status]);

  // Count the session check separately — the health timer has already stopped.
  useEffect(() => {
    if (!authLoading) return;
    const started = Date.now();
    const tick = setInterval(
      () => setAuthElapsed(Math.round((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(tick);
  }, [authLoading]);

  if (status === "ready" && !lingering && !authLoading) return null;

  const remaining = Math.max(0, ESTIMATED_WAKE_SECONDS - elapsed);
  const pct = Math.min(96, (elapsed / ESTIMATED_WAKE_SECONDS) * 100);

  if (status === "waking") {
    return (
      <Shell
        footer={
          <div className="h-0.5 bg-white/5">
            <div
              className="h-full bg-white/50 transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        }
      >
        <Loader2 size={15} className="text-white/70 animate-spin shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white">Waking up the server…</p>
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
            The free server sleeps when idle. {remaining > 0 ? `About ${remaining}s left.` : "Almost there…"}
          </p>
        </div>
        <span className="ml-auto text-[10px] tabular-nums text-white/35 shrink-0">{elapsed}s</span>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
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
      </Shell>
    );
  }

  if (status === "checking") {
    return (
      <Shell>
        <Loader2 size={15} className="text-white/70 animate-spin shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white">Contacting the server…</p>
          <p className="text-[11px] text-white/45 mt-1">Checking whether it's awake.</p>
        </div>
        <span className="ml-auto text-[10px] tabular-nums text-white/35 shrink-0">{elapsed}s</span>
      </Shell>
    );
  }

  // Backend is up. Either the session check is still running, or it just
  // finished and we're showing the confirmation on the way out.
  if (authLoading) {
    return (
      <Shell>
        <Loader2 size={15} className="text-white/70 animate-spin shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white">Signing you in…</p>
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
            Server's up. Restoring your session
            {authElapsed >= 5 ? " — the database may still be waking." : "."}
          </p>
        </div>
        <span className="ml-auto text-[10px] tabular-nums text-white/35 shrink-0">{authElapsed}s</span>
      </Shell>
    );
  }

  return (
    <Shell>
      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-white">Server ready</p>
        <p className="text-[11px] text-white/45 mt-1">Connected in {elapsed}s.</p>
      </div>
    </Shell>
  );
}
