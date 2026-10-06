import axios from "axios";
import { toast } from "sonner";

const ENV_URL = process.env.REACT_APP_BACKEND_URL;
const sameHost = (() => {
  try { return new URL(ENV_URL).host === window.location.host; } catch { return false; }
})();
const BACKEND_URL = sameHost || window.location.hostname === "localhost" ? ENV_URL : window.location.origin;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

// Short-lived GET cache: revisiting a panel renders instantly; any write clears it so lists never go stale after an action.
// Identical in-flight GETs are de-duplicated so N components asking for the same thing cost one round trip.
const GET_TTL_MS = 60000;
const getCache = new Map();
const inflight = new Map();
const NO_CACHE = /\/(notifications|auth\/me|files\/|cron\/|statement|export|slip|download|attendance\/settings|attendance\/policy)/;
const stableParams = (p) => (p ? JSON.stringify(Object.keys(p).filter((k) => p[k] !== undefined).sort().reduce((o, k) => ({ ...o, [k]: p[k] }), {})) : "{}");
const cacheKey = (c) => `${c.url}?${stableParams(c.params)}`;
const cacheable = (c) => (c.method || "get").toLowerCase() === "get" && !c.responseType && !c.noCache && !NO_CACHE.test(c.url || "");
export const clearApiCache = () => getCache.clear();
window.addEventListener("rt:logout", clearApiCache);

const netAdapter = axios.getAdapter(axios.defaults.adapter);
api.defaults.adapter = async (config) => {
  if (!cacheable(config)) {
    const res = await netAdapter(config);
    if ((config.method || "get").toLowerCase() !== "get") getCache.clear();
    return res;
  }
  const key = cacheKey(config);
  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_TTL_MS) return { ...hit.res, config, cached: true };
  let p = inflight.get(key);
  if (!p) {
    p = netAdapter(config).then((res) => { getCache.set(key, { at: Date.now(), res }); return res; }).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  const res = await p;
  return { ...res, config };
};

// Warm the cache for a list of [url, params] so the next panel paints instantly. Errors are ignored.
export const prefetchApi = (list) => Promise.allSettled(list.filter(([url, params]) => !getCache.has(cacheKey({ url, params }))).map(([url, params]) => api.get(url, { params })));

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
  if (path.startsWith("http") || path.startsWith("/images/")) return path;
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
