import axios from "axios";

// Backend base URL: set REACT_APP_BACKEND_URL at build time.
// Falls back to same-origin so single-host deploys work without config.
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "") || window.location.origin;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

export const mediaUrl = (filename) =>
  `${BACKEND_URL}/api/media/file/${filename}`;

export default api;
