const CACHE = "rt-pwa-v8";
const PRECACHE = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/images/logo-full.jpeg", "/images/logo-tile.png"];
const NAV_TIMEOUT_MS = 4000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("timeout")), ms); p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); }); });
const put = (req, res) => caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  // App shell: network first, but on a slow/dead network fall back to the cached shell within 4s so the app still opens.
  if (req.mode === "navigate") {
    e.respondWith(withTimeout(fetch(req), NAV_TIMEOUT_MS).then((res) => { if (res.ok) put("/", res.clone()); return res; }).catch(() => caches.match("/")));
    return;
  }

  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const isStatic = sameOrigin && (/\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname) || /\.(png|jpe?g|svg|webp|ico|woff2?)$/.test(url.pathname));
  if (isStatic) {
    // Hashed build files never change: cache first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) put(req, res.clone()); return res; })));
    return;
  }
  if (isFont) {
    // Fonts: serve cached instantly, refresh in background.
    e.respondWith(caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => { if (res.ok || res.type === "opaque") put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }));
  }
});

self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
