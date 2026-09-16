import axios from "axios";
import { toast } from "sonner";

const ENV_URL = process.env.REACT_APP_BACKEND_URL;
const sameHost = (() => {
  try { return new URL(ENV_URL).host === window.location.host; } catch { return false; }
})();
const BACKEND_URL = sameHost || window.location.hostname === "localhost" ? ENV_URL : window.location.origin;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rt_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && localStorage.getItem("rt_token")) {
    localStorage.removeItem("rt_token");
    const d = err.response?.data?.detail;
    if (typeof d === "string" && /password was changed/i.test(d)) toast.error(d, { duration: 8000 });
    window.dispatchEvent(new Event("rt:logout"));
  }
  if (err.response?.status === 503 && err.response?.data?.detail?.code === "shutdown") {
    window.dispatchEvent(new CustomEvent("rt:shutdown", { detail: err.response.data.detail }));
  }
  return Promise.reject(err);
});

export function fileUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/api/")) return `${BACKEND_URL}${path}`;
  return `${API}/files/${path}`;
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
