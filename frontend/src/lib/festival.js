import { useEffect, useState } from "react";
import api from "./api";

const KEY = "rt-festival";
const TTL = 2 * 60 * 1000;
let mem = null, inflight = null;

export const palette = (f) => f?.palette || { bg: "#0B0F17", accent: "#f59e0b", accent2: "#fde68a", glow: "#f97316", text: "#fff7ed" };

async function fetchActive() {
  if (!inflight) {
    inflight = api.get("/festival/active").then(({ data }) => {
      mem = { at: Date.now(), value: data.active || null };
      try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
      return mem.value;
    }).catch(() => (mem?.value ?? null)).finally(() => { inflight = null; });
  }
  return inflight;
}

export function useFestival() {
  const [fest, setFest] = useState(() => {
    if (mem) return mem.value;
    try { const c = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (c && Date.now() - c.at < TTL) { mem = c; return c.value; } } catch {}
    return null;
  });
  useEffect(() => {
    if (mem && Date.now() - mem.at < TTL) { setFest(mem.value); return; }
    let on = true;
    fetchActive().then((v) => on && setFest(v));
    const onVis = () => { if (document.visibilityState === "visible" && (!mem || Date.now() - mem.at >= TTL)) fetchActive().then((v) => on && setFest(v)); };
    document.addEventListener("visibilitychange", onVis);
    return () => { on = false; document.removeEventListener("visibilitychange", onVis); };
  }, []);
  return fest;
}

export const refreshFestival = () => { mem = null; try { sessionStorage.removeItem(KEY); } catch {} };
