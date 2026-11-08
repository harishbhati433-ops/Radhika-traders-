import { useEffect, useState } from "react";
import api from "./api";

const TTL = 20 * 1000;
let mem = null, inflight = null;

export const palette = (f) => f?.palette || { bg: "#0B0F17", accent: "#f59e0b", accent2: "#fde68a", glow: "#f97316", text: "#fff7ed" };

const fresh = () => mem && Date.now() - mem.at < TTL;

async function fetchActive() {
  if (!inflight) {
    inflight = api.get("/festival/active", { params: { _: Date.now() } }).then(({ data }) => {
      mem = { at: Date.now(), value: data.active || null };
      return mem.value;
    }).catch(() => (mem?.value ?? null)).finally(() => { inflight = null; });
  }
  return inflight;
}

export function useFestival() {
  const [fest, setFest] = useState(() => (mem ? mem.value : null));
  useEffect(() => {
    let on = true;
    const load = () => fetchActive().then((v) => on && setFest(v));
    if (fresh()) setFest(mem.value); else load();
    const onVis = () => { if (document.visibilityState === "visible" && !fresh()) load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { on = false; document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);
  return fest;
}

export const refreshFestival = () => { mem = null; };
