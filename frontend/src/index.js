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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
