import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";
import { ReferralBonusSetting } from "../../components/ReferralBonusSetting";
import { MinWithdrawalSetting } from "../../components/MinWithdrawalSetting";
import { Megaphone, Radio, PauseCircle, XCircle, Users, Wallet, TrendingUp, ArrowDownToLine, Clock, CheckCircle } from "lucide-react";

function KPI({ icon: Icon, label, value, tone }) {
  const tones = { emerald: "from-emerald-500 to-emerald-700", red: "from-red-600 to-red-900", amber: "from-amber-500 to-amber-700", slate: "from-slate-700 to-slate-900", sky: "from-sky-500 to-sky-700" };
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${tones[tone]} p-2.5 text-white`}><Icon className="h-5 w-5" /></div>
      <div className="font-mono text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setD(data)); }, []);

  return (
    <DashboardLayout nav={adminNav} title="Admin Dashboard">
      {!d ? <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPI icon={Megaphone} label="Total Campaigns" value={d.total_campaigns} tone="slate" />
            <KPI icon={Radio} label="Live" value={d.live} tone="emerald" />
            <KPI icon={PauseCircle} label="Paused" value={d.paused} tone="amber" />
            <KPI icon={XCircle} label="Closed" value={d.closed} tone="red" />
            <KPI icon={Users} label="Customers" value={d.total_customers} tone="sky" />
            <KPI icon={Wallet} label="Wallet Balance" value={`₹${d.total_wallet_balance}`} tone="emerald" />
            <KPI icon={TrendingUp} label="Total Earnings" value={`₹${d.total_earnings}`} tone="red" />
            <KPI icon={CheckCircle} label="Offers Enabled" value={d.enabled_offers} tone="slate" />
          </div>

          <div className="mt-6 space-y-4"><MinWithdrawalSetting /><ReferralBonusSetting /></div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-slate-500"><ArrowDownToLine className="h-4 w-4" /> Total Withdrawals</div><div className="mt-1 font-mono text-2xl font-bold">{d.withdrawals_total}</div></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 text-amber-700"><Clock className="h-4 w-4" /> Pending</div><div className="mt-1 font-mono text-2xl font-bold text-amber-700">{d.withdrawals_pending}</div></div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle className="h-4 w-4" /> Paid</div><div className="mt-1 font-mono text-2xl font-bold text-emerald-700">{d.withdrawals_paid}</div></div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900">Recently Updated Campaigns</h2>
            <Link to="/admin/campaigns" className="text-sm font-semibold text-red-700">Manage all →</Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="divide-y divide-slate-100">
              {d.recent_campaigns.map((c) => (
                <Link key={c.id} to={`/campaign/${c.slug}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div><div className="font-semibold text-slate-800">{c.offer_name}</div><div className="text-xs text-slate-400">{c.company} · ₹{c.payout_amount}</div></div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
