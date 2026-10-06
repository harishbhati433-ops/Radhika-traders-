import axios from "axios";
import { toast } from "sonner";
import { getToken, clearSession } from "./portal";

const ENV_URL = process.env.REACT_APP_BACKEND_URL;
const sameHost = (() => {
  try { return new URL(ENV_URL).host === window.location.host; } catch { return false; }
})();
const BACKEND_URL = sameHost || window.location.hostname === "localhost" ? ENV_URL : window.location.origin;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, timeout: 25000 });

// Short-lived GET cache: revisiting a panel renders instantly; any write clears it so lists never go stale after an action.
// Identical in-flight GETs are de-duplicated so N components asking for the same thing cost one round trip.
const GET_TTL_MS = 60000;
const getCache = new Map();
const inflight = new Map();
const NO_CACHE = /\/(notifications|auth\/me|files\/|cron\/|statement|export|slip|download|attendance\/settings|attendance\/policy)/;
const stableParams = (p) => (p ? JSON.stringify(Object.keys(p).filter((k) => p[k] !== undefined).sort().reduce((o, k) => ({ ...o, [k]: p[k] }), {})) : "{}");
const cacheKey = (c) => `${c.url}?${stableParams(c.params)}`;
const cacheable = (c) => (c.method || "get").toLowerCase() === "get" && !c.responseType && !c.noCache && !NO_CACHE.test(c.url || "");

// Weak-network layer: last good JSON for each GET is kept on the device; if the network fails we serve it (flagged stale)
// instead of a blank page, and tell the UI via rt:net-degraded / rt:net-ok.
const PERSIST_KEY = "rt_api_persist_v1";
const PERSIST_MAX = 1_200_000;
const stale = (() => { try { return new Map(Object.entries(JSON.parse(localStorage.getItem(PERSIST_KEY) || "{}"))); } catch { return new Map(); } })();
window.__rtApiStale = stale;
let persistTimer = null;
const persist = () => {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const entries = [...stale.entries()].sort((a, b) => b[1].at - a[1].at);
      let size = 0; const out = {};
      for (const [k, v] of entries) { const s = JSON.stringify(v); if (size + s.length > PERSIST_MAX) break; size += s.length; out[k] = v; }
      localStorage.setItem(PERSIST_KEY, JSON.stringify(out));
    } catch {}
  }, 400);
};
const remember = (key, res) => {
  if (key.includes('"_t"')) return;
  try { const s = JSON.stringify(res.data); if (s.length < 150_000) { stale.set(key, { at: Date.now(), data: res.data }); persist(); } } catch {}
};
const net = (ok, detail) => window.dispatchEvent(new CustomEvent(ok ? "rt:net-ok" : "rt:net-degraded", { detail }));
const isNetFail = (e) => !e.response || e.code === "ECONNABORTED" || [502, 503, 504].includes(e.response?.status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const clearApiCache = () => { getCache.clear(); stale.clear(); try { localStorage.removeItem(PERSIST_KEY); } catch {} };
window.addEventListener("rt:logout", clearApiCache);

const netAdapter = axios.getAdapter(axios.defaults.adapter);
const fetchWithRetry = async (config, tries = 3) => {
  for (let i = 0; ; i++) {
    try { const res = await netAdapter(config); net(true); return res; }
    catch (e) { if (i >= tries - 1 || !isNetFail(e) || e.response?.status === 503) throw e; await sleep(700 * (i + 1)); }
  }
};
api.defaults.adapter = async (config) => {
  if (!cacheable(config)) {
    const res = await netAdapter(config);
    if ((config.method || "get").toLowerCase() !== "get") getCache.clear();
    net(true);
    return res;
  }
  const key = cacheKey(config);
  const hit = getCache.get(key);
  if (hit && Date.now() - hit.at < GET_TTL_MS) return { ...hit.res, config, cached: true };
  let p = inflight.get(key);
  if (!p) {
    p = fetchWithRetry(config).then((res) => { getCache.set(key, { at: Date.now(), res }); remember(key, res); return res; })
      .catch((e) => {
        const old = stale.get(key);
        if (!isNetFail(e) || !old) throw e;
        net(false, { key, at: old.at });
        return { data: old.data, status: 200, statusText: "OK (saved copy)", headers: {}, config, request: null, stale: true, cachedAt: old.at };
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  const res = await p;
  return { ...res, config };
};

// Warm the cache for a list of [url, params] so the next panel paints instantly. Errors are ignored.
export const prefetchApi = (list) => Promise.allSettled(list.filter(([url, params]) => !getCache.has(cacheKey({ url, params }))).map(([url, params]) => api.get(url, { params })));

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((r) => r, (err) => {
  if (!err.response) {
    // Offline / timeout: give every caller a human message instead of "Something went wrong"
    const detail = err.code === "ECONNABORTED" ? "Network is very slow — the request timed out. Please try again." : "No internet connection. Please check your network and try again.";
    err.response = { status: 0, data: { detail }, headers: {}, config: err.config };
    net(false, { write: true });
    return Promise.reject(err);
  }
  if (err.response?.status === 401 && getToken()) {
    clearSession();
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
