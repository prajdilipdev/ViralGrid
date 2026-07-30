import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Shown when a request fails, in place of the empty state.
 *
 * Every page used to swallow fetch errors, so a failed request rendered
 * "No posts here" — visually identical to genuinely having none. On a flaky
 * connection that reads as data loss. This says what happened and offers a
 * retry instead.
 */
export default function ErrorState({ what = "this", onRetry, error, compact = false }) {
  const status = error?.response?.status;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  const message = offline
    ? "You appear to be offline."
    : status >= 500
      ? "The server had a problem."
      : status === 401
        ? "Your session has expired."
        : "Could not reach the server.";

  const hint = offline
    ? "Check your connection and try again."
    : status === 401
      ? "Sign in again to continue."
      : "The free server may still be waking up — this often works on a second try.";

  return (
    <div
      data-testid="error-state"
      role="alert"
      className={`text-center ${compact ? "p-8" : "p-12"}`}
    >
      <AlertTriangle size={compact ? 18 : 22} className="text-amber-400 mx-auto mb-3" />
      <p className="text-sm font-medium text-white/80">
        {message} Couldn't load {what}.
      </p>
      <p className="text-xs text-white/40 mt-1.5 max-w-sm mx-auto leading-relaxed">{hint}</p>
      {onRetry && (
        <button
          data-testid="error-retry"
          onClick={onRetry}
          className="mt-4 h-9 px-4 border border-white/15 rounded-md text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200 inline-flex items-center gap-2"
        >
          <RotateCw size={12} /> Try again
        </button>
      )}
    </div>
  );
}
