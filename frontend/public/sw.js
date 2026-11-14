const CACHE = "rt-pwa-v12";
const PRECACHE = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png", "/images/logo-full.jpeg", "/images/logo-tile.png", "/sounds/alert.mp3"];
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

  // App shell: serve the cached shell instantly (fast open, no lag), refresh it from the network in the background.
  // First visit / no cache: network with a 4s timeout.
  if (req.mode === "navigate") {
    e.respondWith(caches.match("/").then((hit) => {
      const fresh = fetch(req).then((res) => { if (res.ok) put("/", res.clone()); return res; });
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return withTimeout(fresh, NAV_TIMEOUT_MS).catch(() => caches.match("/"));
    }));
    return;
  }

  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  const isStatic = sameOrigin && (/\.[a-f0-9]{8,}\.(js|css)$/.test(url.pathname) || /\.(png|jpe?g|svg|webp|ico|woff2?|mp3|wav)$/.test(url.pathname));
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

// Browser rotated/expired the push endpoint: re-subscribe right away and tell open tabs to re-register with the server.
self.addEventListener("pushsubscriptionchange", (e) => {
  const key = e.oldSubscription && e.oldSubscription.options && e.oldSubscription.options.applicationServerKey;
  e.waitUntil(
    (key ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : Promise.resolve(null))
      .catch(() => null)
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((cs) => cs.forEach((c) => c.postMessage({ type: "rt-resync-push" })))
  );
});

// Web Push: show a system notification (works with the app closed) and tell any open tab to play its alert sound.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "Radhika Traders";
  const opts = {
    body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", tag: d.tag || "rt", renotify: true,
    vibrate: [200, 100, 200, 100, 400], timestamp: Date.now(), requireInteraction: false, silent: false,
    data: { url: d.url || "/", type: d.type || "" },
  };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, opts),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => cs.forEach((c) => c.postMessage({ type: "PUSH", title, body: opts.body, url: opts.data.url, kind: opts.data.type }))),
  ]));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.location.origin));
    if (c) return (c.navigate ? c.navigate(url) : Promise.resolve(c)).then((w) => (w || c).focus()).catch(() => c.focus());
    return self.clients.openWindow(url);
  }));
});
