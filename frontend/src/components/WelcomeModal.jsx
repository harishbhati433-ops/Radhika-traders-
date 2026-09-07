import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent } from "./ui/dialog";
import { Award, Megaphone, ShieldCheck, Share2, Wallet, ArrowRight } from "lucide-react";

const KEY = "rt_welcome_seen_";

export function WelcomeModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    if (sessionStorage.getItem("rt_just_signed_up") === user.id && !localStorage.getItem(KEY + user.id)) setOpen(true);
  }, [user?.id]);

  const close = () => { localStorage.setItem(KEY + user.id, "1"); sessionStorage.removeItem("rt_just_signed_up"); setOpen(false); };
  if (!user) return null;
  const first = user.name?.split(" ")[0] || "Partner";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg overflow-hidden p-0" data-testid="welcome-modal">
        <div className="border-b-4 border-amber-400 bg-[#991B1B] px-7 py-6 text-white">
          <div className="text-[10px] font-bold tracking-[0.25em] text-amber-200">RADHIKA TRADERS · TRUSTED PARTNER FOR FINANCIAL GROWTH</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3"><Award className="h-7 w-7 text-amber-300" /></div>
            <div>
              <div className="font-display text-2xl font-extrabold">Welcome, {first}!</div>
              <div className="text-sm text-red-100">Congratulations — you are now a Radhika Traders partner.</div>
            </div>
          </div>
        </div>
        <div className="px-7 py-6">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-600">Your Partner ID</span>
            <span className="font-mono text-base font-bold text-slate-900" data-testid="welcome-modal-code">{user.referral_code}</span>
          </div>
          <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400">Get started in 3 steps</div>
          <ol className="mt-3 space-y-3 text-sm">
            {[
              [ShieldCheck, "Complete your KYC", "Add PAN, bank or UPI details so your payouts are never delayed.", "/profile"],
              [Megaphone, "Pick a campaign", "Open Campaigns and copy your personal referral link.", "/my-campaigns"],
              [Share2, "Share & earn", "Share on WhatsApp / Telegram — every approved account pays you a fixed amount.", "/dashboard"],
            ].map(([Icon, t, d, to], i) => (
              <li key={t} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">{i + 1}</div>
                <div className="flex-1"><div className="flex items-center gap-1.5 font-semibold text-slate-900"><Icon className="h-4 w-4 text-red-600" /> {t}</div><div className="text-xs text-slate-500">{d}</div></div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link to="/profile" onClick={close} data-testid="welcome-modal-kyc" className="rt-gradient-btn flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold"><ShieldCheck className="h-4 w-4" /> Complete KYC now</Link>
            <Link to="/welcome-letter" onClick={close} data-testid="welcome-modal-letter" className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Wallet className="h-4 w-4" /> View welcome letter <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <button onClick={close} data-testid="welcome-modal-close" className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600">Explore dashboard →</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
