import { useEffect, useState } from "react";
import api from "../lib/api";
import { ShareButtons } from "./ShareButtons";
import { useBlobUrl } from "./ShareKit";
import { useAuth } from "../context/AuthContext";
import { Gift, Users, Copy, ChevronDown, MessageSquareText, QrCode, Download, Crown } from "lucide-react";
import { toast } from "sonner";

export function ReferEarnCard({ code }) {
  const { user } = useAuth();
  const [bonus, setBonus] = useState(0);
  const [signupBonus, setSignupBonus] = useState(0);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api.get("/settings/public").then(({ data }) => { setBonus(data.referral_bonus); setSignupBonus(data.signup_bonus); }).catch(() => {});
    api.get("/my-referrals").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const link = `${window.location.origin}/signup?ref=${code}`;
  const qr = useBlobUrl(`/share/qr?url=${encodeURIComponent(link)}&size=400`, [link]);
  const partnerName = (user?.name || "a partner").replace(/\b\w/g, (m) => m.toUpperCase());
  const bonusLine = signupBonus > 0 ? `\n🎁 Sign up with my link and receive a *₹${signupBonus} welcome bonus*` : "";
  const inviteMessage =
    `🙏 Hello!\n\nI'm *${partnerName}*, a partner with *Radhika Traders* 🏦 — an advertising & affiliate marketing agency working with India's leading brokers, banks and insurers.\n\n` +
    `✅ Join free of cost (zero investment)\n🔗 Share campaign links with your network\n💰 Earn a fixed payout on every approved account opening${bonusLine}\n\n` +
    `👉 Join here: ${link}\n\n🏆 *Radhika Traders* · Trusted Partner for Financial Growth\n📞 WhatsApp: +91 63765 41191`;
  const shareMsg = inviteMessage.replace(`\n\n👉 Join here: ${link}`, "\n\n👉 Join here:");
  const copy = () => { navigator.clipboard.writeText(inviteMessage); toast.success("Invite message with your link copied — paste it anywhere"); };
  const copyLinkOnly = () => { navigator.clipboard.writeText(link); toast.success("Link copied"); };

  const ded = stats?.dedicated;
  const totalPer = ded ? Number(ded.payout) || 0 : Number(bonus) || 0;

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6" data-testid="refer-earn-card">
      {ded && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white" data-testid="refer-dedicated-banner">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-400 p-2 text-slate-950"><Crown className="h-4 w-4" /></div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Dedicated Referral Partner · Active</div>
              <div className="text-sm">You earn <span className="font-mono text-lg font-bold text-amber-300" data-testid="refer-dedicated-payout">₹{ded.payout}</span> on every eligible referral{bonus > 0 && <span className="text-slate-300"> — your special rate (replaces the standard ₹{bonus} bonus)</span>}.</div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-white/10 px-3 py-1.5 text-xs">
            <span><span className="font-mono text-base font-bold" data-testid="refer-dedicated-count">{ded.eligible_count}</span> <span className="text-slate-300">paid referrals</span></span>
            <span><span className="font-mono text-base font-bold text-emerald-300" data-testid="refer-dedicated-earned">₹{ded.total_earned}</span> <span className="text-slate-300">dedicated earnings</span></span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-400 p-2.5 text-slate-950"><Gift className="h-5 w-5" /></div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {totalPer > 0 ? <>Refer a friend, earn <span className="text-red-600">₹{totalPer}</span>{ded && <span className="ml-1 text-xs font-semibold text-slate-500">(dedicated rate)</span>}</> : "Invite friends to Radhika Traders"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {totalPer > 0 ? `Share your invite link. When a friend signs up and verifies their email, ₹${totalPer} is added to your wallet.` : "Share your invite link and grow the Radhika Traders partner network."}
              {signupBonus > 0 && <span className="mt-1 block font-semibold text-violet-700" data-testid="refer-signup-bonus-note">🎁 Your friend also gets ₹{signupBonus} signup bonus (unlocked after their first approved lead).</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="font-mono font-bold text-slate-900" data-testid="refer-count">{stats?.count ?? 0}</span>
          <span className="text-xs text-slate-500">joined ·</span>
          <span className="font-mono font-bold text-emerald-600" data-testid="refer-earned">₹{(Number(stats?.earned) || 0) + (Number(ded?.total_earned) || 0)}</span>
          <span className="text-xs text-slate-500">earned</span>
        </div>
      </div>
      {stats && (stats.daily_limit > 0 || stats.monthly_limit > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="refer-limits">
          {stats.daily_limit > 0 && <span className={`rounded-full px-3 py-1 font-bold ${stats.today >= stats.daily_limit ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>Today: {stats.today}/{stats.daily_limit} referrals</span>}
          {stats.monthly_limit > 0 && <span className={`rounded-full px-3 py-1 font-bold ${stats.month >= stats.monthly_limit ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>This month: {stats.month}/{stats.monthly_limit} referrals</span>}
          {(stats.today >= stats.daily_limit && stats.daily_limit > 0) || (stats.month >= stats.monthly_limit && stats.monthly_limit > 0) ? <span className="text-rose-600">Limit reached — new signups via your link are paused until the limit resets.</span> : null}
        </div>
      )}
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
        <input readOnly value={link} data-testid="refer-link-input" className="flex-1 bg-transparent px-1 text-xs text-slate-600 outline-none" />
        <button onClick={copyLinkOnly} title="Copy link only" data-testid="refer-copy" className="rounded-md bg-slate-900 p-1.5 text-white"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-slate-200 bg-white p-3" data-testid="refer-message-preview">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><MessageSquareText className="h-3.5 w-3.5 text-red-600" /> Your invite message (auto-updates with bonus)</span>
            <button onClick={copy} data-testid="refer-copy-message" className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-700">Copy message</button>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-600">{inviteMessage}</pre>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3 sm:w-44" data-testid="refer-qr">
          <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500"><QrCode className="h-3.5 w-3.5" /> Scan to join</div>
          <div className="flex h-32 w-32 items-center justify-center">{qr ? <img src={qr} alt="Invite QR" className="h-32 w-32" data-testid="refer-qr-img" /> : <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />}</div>
          <button onClick={() => { if (!qr) return; const a = document.createElement("a"); a.href = qr; a.download = `invite-qr-${code}.png`; a.click(); }} disabled={!qr} data-testid="refer-qr-download" className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"><Download className="h-3 w-3" /> Download</button>
        </div>
      </div>
      <div className="mt-3"><ShareButtons link={link} message={shareMsg} copyText={inviteMessage} testPrefix="refer-share" /></div>
      {stats?.recent?.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white" data-testid="refer-joined-list">
          <button type="button" onClick={() => setOpen(!open)} data-testid="refer-joined-toggle" className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-800">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-red-600" /> People joined from your link ({stats.count})</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {stats.recent.map((r, i) => (
                <li key={i} data-testid={`refer-joined-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-700">{(r.name || "?")[0]}</span><span className="font-semibold text-slate-800">{r.name}</span></span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">{(r.joined_at || "").slice(0, 10)}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${r.kyc === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>KYC {r.kyc.replace("_", " ")}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
