import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api from "../../lib/api";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Lock } from "lucide-react";
import { BonusWalletCard } from "../../components/BonusWalletCard";

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);

  useEffect(() => {
    api.get("/wallet").then(({ data }) => setWallet(data));
    api.get("/wallet/transactions").then(({ data }) => setTxns(data));
  }, []);

  const cards = [
    ["Available Balance", wallet?.balance, "text-emerald-600"],
    ["Total Earnings", wallet?.total_earnings, "text-slate-900"],
    ["Total Credited", wallet?.total_credited, "text-slate-900"],
    ["Total Withdrawn", wallet?.total_withdrawn, "text-slate-900"],
    ["Pending Withdrawal", wallet?.pending_withdrawal, "text-amber-600"],
  ];

  return (
    <DashboardLayout nav={customerNav} title="My Wallet">
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 via-red-800 to-[#0B0F17] p-6 text-white lg:col-span-2">
          <div className="flex items-center gap-2 text-red-100"><WalletIcon className="h-5 w-5" /> Main Wallet · Available Balance</div>
          <div className="mt-2 font-mono text-4xl font-bold" data-testid="wallet-balance">₹{wallet?.balance ?? "…"}</div>
          <div className="mt-1 text-xs text-red-200">Withdrawable amount</div>
        </div>
        <BonusWalletCard wallet={wallet} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.slice(1).map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className={`mt-1 font-mono text-xl font-bold ${c}`}>₹{v ?? "…"}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-bold text-slate-900">Transaction History</h2>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {txns.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500" data-testid="wallet-no-txns">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-4" data-testid={`txn-${t.id}`}>
                <div className={`rounded-full p-2 ${t.type === "credit" ? "bg-emerald-50 text-emerald-600" : t.type === "bonus" ? "bg-violet-50 text-violet-600" : "bg-rose-50 text-rose-600"}`}>
                  {t.type === "bonus" ? <Lock className="h-4 w-4" /> : t.type === "credit" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{t.description} {t.type === "bonus" && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">LOCKED</span>}</div>
                  <div className="text-xs text-slate-400">{(t.created_at || "").slice(0, 10)} · {t.ref_id}</div>
                </div>
                <div className={`font-mono font-bold ${t.type === "credit" ? "text-emerald-600" : t.type === "bonus" ? "text-violet-600" : "text-rose-600"}`}>
                  {t.type === "debit" ? "−" : "+"}₹{t.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
