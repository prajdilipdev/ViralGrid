import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Stops one bad value from blanking the whole app.
 *
 * React unmounts the entire tree when a render throws, so a single missing
 * field — a metric Instagram did not return, say — took the page to a white
 * screen with no explanation. This catches that and shows something useful
 * instead.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep it in the console so the real cause is still findable.
    console.error("Render error caught by boundary:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div data-testid="error-boundary" className="min-h-screen bg-ink-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full vg-panel bg-ink-900 rounded-md p-6">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            <h1 className="text-lg font-semibold tracking-tight">Something broke on this screen</h1>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            The rest of the app is fine — this page hit an error while drawing. Your posts and
            connections are unaffected.
          </p>
          <p className="text-[11px] text-white/40 mt-3 font-mono break-words">
            {String(this.state.error?.message || this.state.error).slice(0, 200)}
          </p>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => this.setState({ error: null })}
              className="flex-1 h-10 vg-btn vg-btn-primary rounded-md text-xs font-medium flex items-center justify-center gap-2"
            >
              <RotateCw size={13} /> Try again
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 h-10 border border-white/15 text-white/70 rounded-md text-xs font-medium hover:text-white"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
