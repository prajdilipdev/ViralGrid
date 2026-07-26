import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { setToken } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // Only a 401 means "really signed out". A cold-starting or unreachable
    // server must not drop the user at the login screen, so retry first.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await api.get("/auth/me", { timeout: 120000 });
        setUser(res.data);
        setLoading(false);
        return;
      } catch (e) {
        if (e.response?.status === 401) {
          setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
