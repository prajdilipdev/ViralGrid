import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Zap, CalendarClock, BarChart3, Layers } from "lucide-react";
import { PLATFORM_META } from "../lib/platforms";
import Logo from "../components/Logo";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/");
  }, [user, loading, navigate]);

  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row">
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-16 border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1654198340681-a2e0fc449f1b?crop=entropy&cs=srgb&fm=jpg&q=85)" }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Logo size={28} className="text-white" />
            <span className="text-xl tracking-tight font-semibold" style={{ fontFamily: "Outfit" }}>ViralGrid</span>
          </div>
          <p className="text-xs tracking-[0.3em] uppercase text-white/50 mb-6 font-semibold">Private Publishing Suite</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter font-light leading-[1.05]" style={{ fontFamily: "Outfit" }}>
            One upload.<br />
            <span className="font-semibold">Every platform.</span>
          </h1>
          <p className="mt-6 text-white/60 max-w-md text-sm sm:text-base leading-relaxed">
            Upload once, optimize automatically, and publish to YouTube Shorts, Instagram Reels, TikTok, X and more — on your schedule.
          </p>
          <div className="mt-10 flex gap-4 flex-wrap">
            {Object.entries(PLATFORM_META).map(([id, { Icon, color }]) => (
              <div key={id} className="w-11 h-11 rounded-md border border-white/10 bg-white/5 flex items-center justify-center">
                <Icon size={20} style={{ color }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-[480px] flex flex-col justify-center px-8 sm:px-14 py-16 bg-[#0A0A0B]">
        <h2 className="text-2xl sm:text-3xl tracking-tight font-medium mb-2" style={{ fontFamily: "Outfit" }}>Sign in</h2>
        <p className="text-white/50 text-sm mb-10">Private workspace — Google account required.</p>
        <button
          data-testid="google-login-button"
          onClick={handleLogin}
          className="w-full h-12 bg-white text-black font-medium rounded-md flex items-center justify-center gap-3 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 34.9 44 30 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>
          Continue with Google
        </button>
        <div className="mt-12 grid grid-cols-2 gap-px bg-white/10 border border-white/10">
          {[
            { Icon: Zap, label: "1-click publish" },
            { Icon: CalendarClock, label: "Smart scheduling" },
            { Icon: Layers, label: "FFmpeg optimization" },
            { Icon: BarChart3, label: "Unified analytics" },
          ].map(({ Icon, label }) => (
            <div key={label} className="bg-[#0A0A0B] p-4 flex items-center gap-3">
              <Icon size={16} className="text-white/40" />
              <span className="text-xs text-white/60">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
