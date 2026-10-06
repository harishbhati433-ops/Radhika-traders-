import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CloudOff } from "lucide-react";

// Slim top banner: offline / weak network / showing saved data. Hides itself as soon as a request succeeds.
export function NetworkBanner() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);
  const [degraded, setDegraded] = useState(null);
  useEffect(() => {
    const off = () => setOffline(true);
    const on = () => { setOffline(false); setDegraded(null); };
    const bad = (e) => setDegraded((prev) => ({ ...(prev || {}), ...(e.detail || {}) }));
    const ok = () => setDegraded(null);
    window.addEventListener("offline", off); window.addEventListener("online", on);
    window.addEventListener("rt:net-degraded", bad); window.addEventListener("rt:net-ok", ok);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); window.removeEventListener("rt:net-degraded", bad); window.removeEventListener("rt:net-ok", ok); };
  }, []);
  if (!offline && !degraded) return null;
  const saved = degraded?.at ? `Showing saved data from ${new Date(degraded.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.` : "";
  return (
    <div role="status" data-testid="network-banner" className={`fixed inset-x-0 top-0 z-[120] flex items-center justify-center gap-2 px-3 py-1.5 text-center text-[11px] font-bold text-white shadow-lg ${offline ? "bg-slate-900" : "bg-amber-600"}`}>
      {offline ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : <CloudOff className="h-3.5 w-3.5 shrink-0" />}
      <span>{offline ? "You're offline — you can keep viewing saved data." : `Weak connection. ${saved}`.trim()}</span>
      <button type="button" onClick={() => window.location.reload()} data-testid="network-banner-retry" className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/25"><RefreshCw className="h-3 w-3" /> Retry</button>
    </div>
  );
}
