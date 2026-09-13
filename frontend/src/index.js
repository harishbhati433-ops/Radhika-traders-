import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

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
