import { useEffect, useState } from "react";
import api from "./api";

export const DEFAULT_CONTACT = { owner_mobile: "6376541191", support_mobile: "6376541191", whatsapp_number: "6376541191", support_email: "radhikatradersofficial@gmail.com" };
const KEY = "rt_contact_v1";
let cache = null, inflight = null;
const listeners = new Set();
try { cache = JSON.parse(localStorage.getItem(KEY)) || null; } catch { cache = null; }

const digits = (n) => String(n || "").replace(/\D/g, "").slice(-10);
export const fmtWa = (n) => { const d = digits(n); return `+91 ${d.slice(0, 5)} ${d.slice(5)}`; };
export const telLink = (n) => `tel:+91${digits(n)}`;
export const waLink = (n, text) => `https://wa.me/91${digits(n)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const WA_GREETING = "Hello Radhika Traders, I want to know more about your campaigns.";

export function refreshContact() {
  if (!inflight) {
    inflight = api.get("/contact/public", { params: { _t: Date.now() }, headers: { "Cache-Control": "no-cache" } }).then(({ data }) => {
      cache = data;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
      listeners.forEach((l) => l(data));
      return data;
    }).catch(() => cache).finally(() => { inflight = null; });
  }
  return inflight;
}

export function useContact() {
  const [c, setC] = useState(cache || DEFAULT_CONTACT);
  useEffect(() => {
    listeners.add(setC);
    if (cache) setC(cache);
    refreshContact();
    const onFocus = () => refreshContact();
    window.addEventListener("focus", onFocus);
    return () => { listeners.delete(setC); window.removeEventListener("focus", onFocus); };
  }, []);
  return c;
}
