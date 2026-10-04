import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellRing, X } from "lucide-react";
import api from "../lib/api";

// Shown on every employee page: "not checked in" after office start / "not checked out" after office end. Dismiss hides it for 20 minutes.
export function AttendanceNudge() {
  const [n, setN] = useState(null);
  const loc = useLocation();
  useEffect(() => {
    let alive = true;
    const load = () => api.get("/employee/attendance", { noCache: true }).then(({ data }) => alive && setN(data.nudge || null)).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);
  if (!n) return null;
  const key = `rt_nudge_${n.type}`;
  const until = Number(sessionStorage.getItem(key) || 0);
  if (until > Date.now()) return null;
  const dismiss = () => { sessionStorage.setItem(key, String(Date.now() + 20 * 60 * 1000)); setN(null); };
  const out = n.type === "checkout";
  return (
    <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm animate-in fade-in slide-in-from-top-2 ${out ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`} role="alert" data-testid={`att-nudge-${n.type}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${out ? "bg-rose-600" : "bg-amber-500"} text-white`}><BellRing className="h-4 w-4 animate-pulse" /></span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-bold ${out ? "text-rose-900" : "text-amber-900"}`} data-testid="att-nudge-title">{n.title}</div>
        <div className={`text-xs ${out ? "text-rose-800" : "text-amber-800"}`}>{n.message}</div>
      </div>
      {loc.pathname !== "/employee/attendance" && <Link to="/employee/attendance" data-testid="att-nudge-cta" className={`rounded-full px-4 py-2 text-xs font-bold text-white ${out ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>{n.cta}</Link>}
      <button onClick={dismiss} data-testid="att-nudge-dismiss" title="Remind me later" className="rounded-full p-1.5 text-slate-500 hover:bg-white/60"><X className="h-4 w-4" /></button>
    </div>
  );
}
