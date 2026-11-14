import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Capture Chrome's install prompt as early as possible so any "Install app" button can trigger one-tap install.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__rtInstallPrompt = e;
  window.dispatchEvent(new Event("rt-install-changed"));
});
window.addEventListener("appinstalled", () => { window.__rtInstallPrompt = null; window.dispatchEvent(new Event("rt-install-changed")); });

// Register the PWA service worker only once the page is idle so its precache never competes with the first paint.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const go = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 3000)))(go);
  });
}

// Self-heal: if a stale cached shell references a build chunk that no longer exists, reload once to pick up the fresh shell.
const chunkFail = (msg) => /Loading (CSS )?chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i.test(String(msg || ""));
const healOnce = () => { if (sessionStorage.getItem("rt_chunk_reload")) return; sessionStorage.setItem("rt_chunk_reload", "1"); window.location.reload(); };
window.addEventListener("error", (e) => { if (chunkFail(e?.message)) healOnce(); });
window.addEventListener("unhandledrejection", (e) => { if (chunkFail(e?.reason?.message || e?.reason)) healOnce(); });
window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("rt_chunk_reload"), 10000));

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
