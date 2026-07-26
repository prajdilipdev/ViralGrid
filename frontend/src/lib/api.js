import axios from "axios";

// Backend base URL: set REACT_APP_BACKEND_URL at build time.
// Falls back to same-origin so single-host deploys work without config.
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "") || window.location.origin;

const TOKEN_KEY = "viralgrid_session_token";

/**
 * The session cookie is cross-site (frontend and backend live on different
 * hosts), and Safari/iOS blocks third-party cookies by default — logins there
 * appeared to work but every request came back 401. So we also keep the token
 * client-side and send it as a Bearer header, which no browser blocks.
 */
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode / storage disabled — cookie auth still applies */ }
};

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const mediaUrl = (filename) =>
  `${BACKEND_URL}/api/media/file/${filename}`;

export default api;
