import { Link } from "react-router-dom";
import { Lock, Gift, CheckCircle2, XCircle } from "lucide-react";
import { useT } from "../lib/i18n";

const dt = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function BonusWalletCard({ wallet, compact }) {
  const t = useT();
  const sb = wallet?.signup_bonus;
  const st = sb?.status || "pending";
  const amt = sb?.amount ?? wallet?.bonus_locked ?? 0;
  const cfg = {
    locked: { Icon: Lock, tone: "border-violet-200 bg-violet-50 text-violet-900", sub: "text-violet-700", label: "Signup Bonus · Locked", note: `₹${sb?.released ?? 0} of ₹${sb?.total ?? amt} released so far. Every approved lead gives you a Scratch Card that moves bonus money to your Main Wallet.` },
    released: { Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-900", sub: "text-emerald-700", label: "Signup Bonus · Fully released", note: `All ₹${sb?.total ?? amt} moved to your Main Wallet via Scratch Cards.` },
    credited: { Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-900", sub: "text-emerald-700", label: "Signup Bonus · Credited", note: `Added to your Main Wallet${sb?.credited_at ? ` on ${dt(sb.credited_at)}` : ""} — first lead approved.` },
    pending: { Icon: Gift, tone: "border-violet-200 bg-violet-50 text-violet-900", sub: "text-violet-700", label: "Signup Bonus", note: "Get leads approved — each one unlocks a Scratch Card that releases this bonus to your Main Wallet." },
    not_eligible: { Icon: XCircle, tone: "border-slate-200 bg-slate-50 text-slate-700", sub: "text-slate-500", label: "Signup Bonus · Not eligible", note: "Duplicate account detected — signup bonus is given only once per person." },
    off: { Icon: Gift, tone: "border-slate-200 bg-slate-50 text-slate-700", sub: "text-slate-500", label: "Signup Bonus", note: "No signup bonus is running right now." },
  }[st];
  const shown = st === "locked" ? (sb?.remaining ?? wallet?.bonus_locked ?? amt) : st === "credited" || st === "released" || st === "pending" ? amt : 0;
  const body = (
    <>
      <div className="flex items-center gap-2 text-sm font-bold"><cfg.Icon className="h-4 w-4" /> {t("Bonus Wallet")}</div>
      <div className={`mt-2 font-mono font-bold ${compact ? "text-2xl" : "text-3xl"}`} data-testid="wallet-bonus-locked">₹{wallet ? shown : "…"}</div>
      <div className={`mt-1 text-xs font-semibold ${cfg.sub}`} data-testid="bonus-wallet-status">{t(cfg.label)}</div>
      <div className={`mt-0.5 text-xs ${cfg.sub}`}>{t(cfg.note)}</div>
    </>
  );
  const cls = `rounded-2xl border p-5 ${cfg.tone}`;
  return compact ? <Link to="/app/wallet" data-testid="bonus-wallet-card" className={`block ${cls} hover:brightness-[0.98]`}>{body}</Link> : <div data-testid="bonus-wallet-card" className={cls}>{body}</div>;
}
