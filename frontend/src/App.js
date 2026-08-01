import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BackendStatusProvider } from "./context/BackendStatus";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "sonner";
import Layout from "./components/Layout";
import ServerStatusBar from "./components/ServerStatusBar";
import ErrorBoundary from "./components/ErrorBoundary";
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
import DataDeletion from "./pages/DataDeletion";
import About from "./pages/About";
import Contact from "./pages/Contact";
import "./App.css";

const Protected = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
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
      <Route path="/data-deletion" element={<DataDeletion />} />
      <Route path="/data-deletion-instructions" element={<Navigate to="/data-deletion" replace />} />
      <Route path="/about" element={<About />} />
      <Route path="/about-us" element={<Navigate to="/about" replace />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/contact-us" element={<Navigate to="/contact" replace />} />
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
    <ThemeProvider>
      <BackendStatusProvider>
        <AuthProvider>
          <BrowserRouter>
            {/* A render error in one page must not take the whole app down. */}
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
            <ServerStatusBar />
            <Toaster position="bottom-right" richColors />
            {/* Film grain sits above everything, ignores pointer events. */}
            <div className="vg-grain" aria-hidden="true" />
          </BrowserRouter>
        </AuthProvider>
      </BackendStatusProvider>
    </ThemeProvider>
  );
}
