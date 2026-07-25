import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api from "../lib/api";

/**
 * Free-tier hosts spin the backend down after ~15 min idle; the next request
 * then takes ~50s while it boots. We ping /health as soon as the app loads so
 * the wake-up happens while the user is still looking around, and expose the
 * state so slow actions (uploads) can wait for it instead of appearing to hang.
 */
const BackendStatusContext = createContext(null);

// If /health hasn't answered within this, we're almost certainly cold-starting.
const COLD_START_AFTER_MS = 1800;
// Render documents ~50s; we show this as the estimate.
export const ESTIMATED_WAKE_SECONDS = 55;

export const BackendStatusProvider = ({ children }) => {
  const [status, setStatus] = useState("checking"); // checking | waking | ready | error
  const [elapsed, setElapsed] = useState(0);
  const pendingPing = useRef(null);

  const ping = useCallback(() => {
    // Collapse concurrent callers onto a single in-flight request.
    if (pendingPing.current) return pendingPing.current;

    setStatus((s) => (s === "ready" ? s : "checking"));
    setElapsed(0);

    const slowTimer = setTimeout(() => setStatus((s) => (s === "ready" ? s : "waking")), COLD_START_AFTER_MS);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);

    const req = api
      .get("/health", { timeout: 120000 })
      .then(() => { setStatus("ready"); return true; })
      .catch(() => { setStatus("error"); return false; })
      .finally(() => {
        clearTimeout(slowTimer);
        clearInterval(tick);
        pendingPing.current = null;
      });

    pendingPing.current = req;
    return req;
  }, []);

  // Wake the backend the moment the app loads.
  useEffect(() => { ping(); }, [ping]);

  /** Await a responsive backend before starting a long request. */
  const ensureAwake = useCallback(async () => {
    if (status === "ready") return true;
    return ping();
  }, [status, ping]);

  return (
    <BackendStatusContext.Provider value={{ status, elapsed, ensureAwake, retry: ping }}>
      {children}
    </BackendStatusContext.Provider>
  );
};

export const useBackendStatus = () => useContext(BackendStatusContext);
