import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BackendStatusProvider } from "./context/BackendStatus";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import ServerStatusBar from "./components/ServerStatusBar";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Composer from "./pages/Composer";
import CalendarPage from "./pages/CalendarPage";
import BulkScheduler from "./pages/BulkScheduler";
import HistoryPage from "./pages/HistoryPage";
import Analytics from "./pages/Analytics";
import Connections from "./pages/Connections";
import Privacy from "./pages/Privacy";
import "./App.css";

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white/50 text-xs tracking-[0.2em] uppercase animate-pulse">Loading…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

function AppRouter() {
  const location = useLocation();
  // Check URL fragment for session_id — must run synchronously during render
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public — Meta's reviewers must be able to read this without an account */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/composer" element={<Protected><Composer /></Protected>} />
      <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
      <Route path="/bulk" element={<Protected><BulkScheduler /></Protected>} />
      <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/connections" element={<Protected><Connections /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BackendStatusProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <ServerStatusBar />
          <Toaster theme="dark" position="bottom-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </BackendStatusProvider>
  );
}
