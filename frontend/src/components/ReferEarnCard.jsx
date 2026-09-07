import { useEffect, useState } from "react";
import api from "../lib/api";
import { ShareButtons } from "./ShareButtons";
import { Gift, Users, Copy, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export function ReferEarnCard({ code }) {
  const [bonus, setBonus] = useState(0);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setBonus(data.referral_bonus)).catch(() => {});
    api.get("/my-referrals").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const link = `${window.location.origin}/signup?ref=${code}`;
  const copy = () => { navigator.clipboard.writeText(link); toast.success("Invite link copied!"); };

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6" data-testid="refer-earn-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-400 p-2.5 text-slate-950"><Gift className="h-5 w-5" /></div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {bonus > 0 ? <>Refer a friend, earn <span className="text-red-600">₹{bonus}</span></> : "Invite friends to Radhika Traders"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              {bonus > 0 ? `Share your invite link. When a friend signs up and verifies their email, ₹${bonus} is added to your wallet instantly.` : "Share your invite link and grow the Radhika Traders partner network."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200">
          <Users className="h-4 w-4 text-slate-400" />
          <span className="font-mono font-bold text-slate-900" data-testid="refer-count">{stats?.count ?? 0}</span>
          <span className="text-xs text-slate-500">joined ·</span>
          <span className="font-mono font-bold text-emerald-600" data-testid="refer-earned">₹{stats?.earned ?? 0}</span>
          <span className="text-xs text-slate-500">earned</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
        <input readOnly value={link} data-testid="refer-link-input" className="flex-1 bg-transparent px-1 text-xs text-slate-600 outline-none" />
        <button onClick={copy} data-testid="refer-copy" className="rounded-md bg-slate-900 p-1.5 text-white"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-3"><ShareButtons link={link} message={bonus > 0 ? `Join Radhika Traders with zero investment and start earning! Sign up with my link:` : `Join Radhika Traders — earn with zero investment. Sign up with my link:`} testPrefix="refer-share" /></div>
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
