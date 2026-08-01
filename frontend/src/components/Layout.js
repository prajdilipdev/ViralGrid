import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, PenSquare, CalendarDays, Layers, History, BarChart3, Plug, LogOut } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/composer", label: "Composer", icon: PenSquare, testid: "nav-composer" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, testid: "nav-calendar" },
  { to: "/bulk", label: "Bulk", icon: Layers, testid: "nav-bulk" },
  { to: "/history", label: "History", icon: History, testid: "nav-history" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, testid: "nav-analytics" },
  { to: "/connections", label: "Connections", icon: Plug, testid: "nav-connections" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ink-950 text-white flex flex-col md:flex-row">
      <aside className="md:w-52 md:min-h-screen max-w-full border-b md:border-b-0 md:border-r border-white/10 flex md:flex-col bg-ink-900 shrink-0">
        <div className="hidden md:flex items-center gap-2 px-5 h-16 border-b border-white/10 cursor-pointer" onClick={() => navigate("/")}>
          <Logo size={20} className="text-signal" />
          <span
            className="vg-display tracking-tight font-semibold"
            style={{ textShadow: "0 0 18px rgb(var(--vg-signal) / 0.35)" }}
          >
            ViralGrid
          </span>
        </div>
        {/* min-w-0: without it a flex child keeps its content width, so the nav
            pushed the whole page sideways on mobile instead of scrolling itself. */}
        <nav className="flex md:flex-col flex-1 min-w-0 overflow-x-auto md:overflow-visible p-2 md:p-3 gap-1">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={testid}
              className={({ isActive }) =>
                `vg-nav-link flex items-center gap-3 px-4 py-2.5 rounded-md text-sm whitespace-nowrap ${
                  isActive ? "vg-nav-active text-white font-medium" : "text-white/60 hover:text-white"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3 px-4 py-4 border-t border-white/10">
          {user?.picture && <img src={user.picture} alt="" className="w-8 h-8 rounded-full border border-white/20" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-[10px] text-white/40 truncate">{user?.email}</p>
          </div>
          <ThemeToggle />
          <button data-testid="logout-button" onClick={logout} title="Sign out" aria-label="Sign out" className="text-white/40 hover:text-white transition-colors duration-200">
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      {/* keyed on the path so the animation replays on every navigation */}
      <main className="flex-1 min-w-0">
        <div key={location.pathname} className="vg-fade-up">{children}</div>
      </main>
    </div>
  );
}
