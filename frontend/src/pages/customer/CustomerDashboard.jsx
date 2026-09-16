import { useState } from "react";
import { useLivePoll } from "../../lib/useLivePoll";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Leaderboard } from "../../components/Leaderboard";
import { OfferBanners } from "../../components/OfferBanners";
import { WelcomeModal } from "../../components/WelcomeModal";
import { ReferEarnCard } from "../../components/ReferEarnCard";
import { customerNav } from "./nav";
import { useAuth } from "../../context/AuthContext";
import api from "../../lib/api";
import { toast } from "sonner";
import { Wallet, TrendingUp, ArrowDownToLine, Clock, Copy, ArrowRight, ShieldAlert } from "lucide-react";
import { BonusWalletCard } from "../../components/BonusWalletCard";

function Stat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", slate: "bg-slate-100 text-slate-700" };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 inline-flex rounded-xl p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      <div className="font-mono text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [campaigns, setCampaigns] = useState([]);

  useLivePoll(() => {
    api.get("/wallet").then(({ data }) => setWallet(data));
    api.get("/campaigns").then(({ data }) => setCampaigns(data.slice(0, 4)));
  }, []);

  const refLink = `${window.location.origin}/campaigns?ref=${user?.referral_code}`;
  const copy = () => { navigator.clipboard.writeText(user?.referral_code || ""); toast.success("Referral code copied!"); };
  const kycDone = user?.kyc?.status === "pending" || user?.kyc?.status === "verified";

  return (
    <DashboardLayout nav={customerNav} title={`Hi ${user?.name?.split(" ")[0] || ""} 👋`}>
      <WelcomeModal />
      {!kycDone && (
        <Link to="/profile" data-testid="kyc-alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm font-medium text-amber-800 hover:bg-amber-100">
          <ShieldAlert className="h-5 w-5 shrink-0" /> Complete your KYC to enable withdrawals. <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      <OfferBanners />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat icon={Wallet} label="Available Balance" value={`₹${wallet?.balance ?? "…"}`} tone="emerald" />
        <BonusWalletCard wallet={wallet} compact />
        <Stat icon={TrendingUp} label="Total Earnings" value={`₹${wallet?.total_earnings ?? "…"}`} tone="red" />
        <Stat icon={ArrowDownToLine} label="Total Withdrawn" value={`₹${wallet?.total_withdrawn ?? "…"}`} tone="slate" />
        <Stat icon={Clock} label="Pending Withdrawal" value={`₹${wallet?.pending_withdrawal ?? "…"}`} tone="amber" />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-[#0B0F17] p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">Your Referral Code</div>
            <div className="mt-1 font-mono text-2xl font-bold" data-testid="dashboard-referral-code">{user?.referral_code}</div>
            <div className="mt-1 text-xs text-slate-400">Share campaigns with your code to earn.</div>
          </div>
          <button onClick={copy} data-testid="dashboard-copy-code" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20">
            <Copy className="h-4 w-4" /> Copy Code
          </button>
        </div>
      </div>

      <div className="mt-6"><ReferEarnCard code={user?.referral_code} /></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Available Campaigns</h2>
            <Link to="/my-campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-red-700">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => (
              <Link key={c.id} to={`/campaign/${c.slug}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 hover:rt-gold-card">
                <div>
                  <div className="font-display font-bold text-slate-900">{c.offer_name}</div>
                  <div className="text-xs text-slate-500">{c.company} · {c.category}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-600">₹{c.payout_amount}</div>
                  <div className="text-[10px] uppercase text-slate-400">{c.payout_type}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2"><Leaderboard /></div>
      </div>
    </DashboardLayout>
  );
}
