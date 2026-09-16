import { Link } from "react-router-dom";
import { Lock, Gift, CheckCircle2, XCircle } from "lucide-react";

const dt = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function BonusWalletCard({ wallet, compact }) {
  const sb = wallet?.signup_bonus;
  const st = sb?.status || "pending";
  const amt = sb?.amount ?? wallet?.bonus_locked ?? 0;
  const cfg = {
    locked: { Icon: Lock, tone: "border-violet-200 bg-violet-50 text-violet-900", sub: "text-violet-700", label: "Signup Bonus · Locked", note: "Not withdrawable yet — moves to your Main Wallet automatically when your first lead is approved." },
    credited: { Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-900", sub: "text-emerald-700", label: "Signup Bonus · Credited", note: `Added to your Main Wallet${sb?.credited_at ? ` on ${dt(sb.credited_at)}` : ""} — first lead approved.` },
    pending: { Icon: Gift, tone: "border-violet-200 bg-violet-50 text-violet-900", sub: "text-violet-700", label: "Signup Bonus", note: "Get your first lead approved and this bonus is credited to your Main Wallet." },
    not_eligible: { Icon: XCircle, tone: "border-slate-200 bg-slate-50 text-slate-700", sub: "text-slate-500", label: "Signup Bonus · Not eligible", note: "Duplicate account detected — signup bonus is given only once per person." },
    off: { Icon: Gift, tone: "border-slate-200 bg-slate-50 text-slate-700", sub: "text-slate-500", label: "Signup Bonus", note: "No signup bonus is running right now." },
  }[st];
  const shown = st === "credited" || st === "locked" ? amt : st === "pending" ? amt : 0;
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm font-bold"><cfg.Icon className="h-4 w-4" /> Bonus Wallet</div>
      <div className={`mt-2 font-mono font-bold ${compact ? "text-2xl" : "text-3xl"}`} data-testid="wallet-bonus-locked">₹{wallet ? shown : "…"}</div>
      <div className={`mt-1 text-xs font-semibold ${cfg.sub}`} data-testid="bonus-wallet-status">{cfg.label}</div>
      <div className={`mt-0.5 text-xs ${cfg.sub}`}>{cfg.note}</div>
    </>
  );
  const cls = `rounded-2xl border p-5 ${cfg.tone}`;
  return compact ? <Link to="/wallet" data-testid="bonus-wallet-card" className={`block ${cls} hover:brightness-[0.98]`}>{body}</Link> : <div data-testid="bonus-wallet-card" className={cls}>{body}</div>;
}
