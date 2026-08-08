import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

/**
 * Reconciles our records with Instagram: flags posts deleted there and pulls
 * fresh metrics. `onDone` is called after a successful sync so the page can
 * reload whatever it is showing.
 */
export default function SyncButton({ onDone, label = "Sync metrics", className = "" }) {
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const { deleted, refreshed, checked } = (await api.post("/posts/sync")).data;
      if (deleted) toast.success(`${deleted} post${deleted > 1 ? "s" : ""} marked as deleted on Instagram`);
      else if (refreshed) toast.success(`Refreshed metrics for ${refreshed} post${refreshed > 1 ? "s" : ""}`);
      else toast.success(checked ? "Everything is up to date" : "No live Instagram posts to check");
      await onDone?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Sync failed");
    }
    setSyncing(false);
  };

  return (
    <button
      data-testid="sync-instagram-button"
      onClick={sync}
      disabled={syncing}
      title="Check Instagram for deleted posts and refresh metrics"
      className={`h-11 px-4 border border-white/15 rounded-md text-xs font-medium flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-200 disabled:opacity-50 ${className}`}
    >
      <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
      {syncing ? "Syncing…" : label}
    </button>
  );
}
