import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, Clock, MessageCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { useContact, waLink } from "../lib/contact";

export const fmtIST = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) + " IST" : "";

function useCountdown(iso) {
  const [left, setLeft] = useState(() => (iso ? new Date(iso) - Date.now() : 0));
  useEffect(() => { if (!iso) return; const t = setInterval(() => setLeft(new Date(iso) - Date.now()), 1000); return () => clearInterval(t); }, [iso]);
  if (!iso || left <= 0) return "";
  const s = Math.floor(left / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${d ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MaintenancePage({ state, onRecheck }) {
  const countdown = useCountdown(state?.reopen_at);
  const contact = useContact();
  useEffect(() => { if (state?.reopen_at && new Date(state.reopen_at) - Date.now() <= 0) onRecheck?.(); }, [countdown, state, onRecheck]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F17] px-4 py-10 text-white" data-testid="maintenance-page">
      <div className="w-full max-w-lg text-left">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo.jpeg" alt="Radhika Traders" className="h-12 w-12 rounded-xl object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div><div className="font-display text-xl font-extrabold tracking-tight">RADHIKA <span className="text-amber-400">TRADERS</span></div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Trusted partner for financial growth</div></div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40"><Wrench className="h-3.5 w-3.5" /> Temporarily closed</div>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl">We'll be back shortly.</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base" data-testid="maintenance-message">{state?.message}</p>
        {state?.reopen_at && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5" data-testid="maintenance-reopen">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Clock className="h-4 w-4 text-amber-400" /> Website opens again at</div>
            <div className="mt-1 font-display text-xl font-bold text-white sm:text-2xl" data-testid="maintenance-reopen-time">{fmtIST(state.reopen_at)}</div>
            {countdown && <div className="mt-1 font-mono text-sm text-amber-300" data-testid="maintenance-countdown">in {countdown}</div>}
          </div>
        )}
        <div className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-200 ring-1 ring-emerald-400/30"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Your account, wallet balance, leads and KYC are completely safe. Nothing is lost — everything will be exactly as you left it.</div>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={waLink(contact.whatsapp_number)} target="_blank" rel="noreferrer" data-testid="maintenance-whatsapp" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:brightness-110"><MessageCircle className="h-4 w-4" /> WhatsApp support</a>
          <button onClick={onRecheck} data-testid="maintenance-recheck" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Check again</button>
        </div>
        <Link to="/admin/login" className="mt-10 inline-block text-[11px] text-slate-500 hover:text-slate-300" data-testid="maintenance-admin-link">Admin login</Link>
      </div>
    </div>
  );
}

export default MaintenancePage;
