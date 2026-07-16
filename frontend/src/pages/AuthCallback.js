import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/login"); return; }
    (async () => {
      try {
        const res = await api.post("/auth/session", { session_id: match[1] });
        setUser(res.data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/", { state: { user: res.data }, replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-white/60 text-sm tracking-[0.2em] uppercase animate-pulse">Authenticating…</div>
    </div>
  );
}
