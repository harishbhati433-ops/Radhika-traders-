import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { CopyValue } from "../../components/CopyValue";
import { CustomerStatementDialog } from "../../components/CustomerStatementDialog";
import { Search, Wallet, Clock, IndianRupee, Download, Loader2, Phone, FileText } from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "—");

export default function AdminWallets() {
  const [data, setData] = useState(null);
  const [show, setShow] = useState("holding");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("total");
  const [stmt, setStmt] = useState(null);

  useEffect(() => { setData(null); api.get("/admin/wallets", { params: { show } }).then(({ data }) => setData(data)); }, [show]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/\s/g, "");
    let list = (data?.items || []).filter((r) => !t || [r.name, r.mobile, r.email, r.customer_id].some((v) => (v || "").toLowerCase().replace(/\s/g, "").includes(t)));
    const key = { total: (r) => r.balance + r.pending_withdrawal, balance: (r) => r.balance, pending: (r) => r.pending_withdrawal, name: (r) => -(r.name || "").charCodeAt(0) }[sort];
    return [...list].sort((a, b) => key(b) - key(a));
  }, [data, q, sort]);

  const exportCsv = () => {
    const head = ["Name", "Mobile", "Email", "Customer ID", "KYC", "Wallet Balance", "Pending Withdrawal", "Total Due", "Total Earned", "Total Withdrawn", "Bank A/C", "IFSC", "UPI"];
    const lines = rows.map((r) => [r.name, r.mobile, r.email, r.customer_id, r.kyc_status, r.balance, r.pending_withdrawal, r.balance + r.pending_withdrawal, r.total_earned, r.total_withdrawn, r.bank_account, r.ifsc, r.upi].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\ufeff" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `wallet-balances-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const s = data?.summary;
  return (
    <DashboardLayout nav={adminNav} title="Wallet Balances">
      <p className="mb-4 text-sm text-slate-500">किस customer के wallet में कितना पैसा पड़ा है (जो अभी आपको देना बाकी है) — नाम, mobile और bank details के साथ।</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Customers holding money", s?.customers ?? "…", Wallet, "wal-stat-customers", "text-slate-900"],
          ["Wallet balance (not yet requested)", s ? inr(s.total_balance) : "…", IndianRupee, "wal-stat-balance", "text-emerald-700"],
          ["Pending withdrawal requests", s ? inr(s.total_pending) : "…", Clock, "wal-stat-pending", "text-amber-700"],
          ["Total payable to customers", s ? inr(s.total_liability) : "…", IndianRupee, "wal-stat-total", "text-red-700"]].map(([l, v, Icon, t, c]) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={t}>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Icon className="h-3.5 w-3.5" /> {l}</div>
            <div className={`mt-1 font-mono text-2xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} data-testid="wal-search" placeholder="Search name / mobile / email / Customer ID" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-red-400 focus:outline-none" /></div>
        <select value={show} onChange={(e) => setShow(e.target.value)} data-testid="wal-show" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option value="holding">Only customers with money due</option><option value="all">All customers with any transaction</option></select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} data-testid="wal-sort" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"><option value="total">Sort: Total due (high → low)</option><option value="balance">Sort: Wallet balance</option><option value="pending">Sort: Pending withdrawal</option><option value="name">Sort: Name</option></select>
        <button onClick={exportCsv} disabled={!rows.length} data-testid="wal-export" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Export CSV</button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm" data-testid="wal-table">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Customer</th><th className="p-3">Mobile / Email</th><th className="p-3">Payout details</th><th className="p-3 text-right">Wallet balance</th><th className="p-3 text-right">Pending withdrawal</th><th className="p-3 text-right">Total due</th><th className="p-3 text-right">Earned / Paid</th><th className="p-3">Last activity</th></tr></thead>
          <tbody>
            {!data && <tr><td colSpan={8} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
            {data && rows.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-500" data-testid="wal-empty">{q ? `No customer matches "${q}"` : "No customer is holding any money right now."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.user_id} data-testid={`wal-row-${r.user_id}`} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                <td className="p-3"><button onClick={() => setStmt(r.user_id)} className="text-left font-semibold text-slate-900 hover:text-red-600" data-testid={`wal-name-${r.user_id}`}>{r.name}</button>
                  <div className="flex items-center gap-0.5 font-mono text-xs text-slate-500">{r.customer_id}<CopyValue value={r.customer_id} label="Customer ID" /></div>
                  <div className="mt-1 flex flex-wrap gap-1"><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${r.kyc_status === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>KYC {r.kyc_status.replace("_", " ")}</span>{r.account_status !== "active" && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">{r.account_status}</span>}</div>
                  <button onClick={() => setStmt(r.user_id)} data-testid={`wal-statement-${r.user_id}`} className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"><FileText className="h-3 w-3" /> Statement</button></td>
                <td className="p-3"><div className="flex items-center gap-1 font-mono font-semibold text-slate-800" data-testid={`wal-mobile-${r.user_id}`}><Phone className="h-3 w-3 text-slate-400" />{r.mobile || "—"}{r.mobile && <CopyValue value={r.mobile} label="Mobile" />}</div><div className="text-xs text-slate-500">{r.email}</div></td>
                <td className="p-3 text-xs text-slate-600">{r.bank_account ? <><div className="font-mono">{r.bank_account} <CopyValue value={r.bank_account} label="Account" /></div><div>{r.ifsc} · {r.account_holder}</div></> : <span className="text-slate-400">No bank</span>}{r.upi && <div className="font-mono">UPI: {r.upi}</div>}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-700" data-testid={`wal-balance-${r.user_id}`}>{inr(r.balance)}</td>
                <td className="p-3 text-right font-mono font-bold text-amber-700" data-testid={`wal-pending-${r.user_id}`}>{r.pending_withdrawal > 0 ? <a href="/admin/withdrawals" className="hover:underline">{inr(r.pending_withdrawal)}</a> : "—"}</td>
                <td className="p-3 text-right font-mono text-base font-bold text-red-700" data-testid={`wal-total-${r.user_id}`}>{inr(r.balance + r.pending_withdrawal)}</td>
                <td className="p-3 text-right font-mono text-xs text-slate-600">{inr(r.total_earned)}<div className="text-slate-400">paid {inr(r.total_withdrawn)}</div></td>
                <td className="p-3 text-xs text-slate-500">Credit: {day(r.last_credit_at)}<div>Paid: {day(r.last_paid_at)}</div></td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-mono text-sm font-bold"><tr><td className="p-3" colSpan={3}>Total ({rows.length} customers)</td><td className="p-3 text-right text-emerald-700" data-testid="wal-foot-balance">{inr(rows.reduce((m, r) => m + r.balance, 0))}</td><td className="p-3 text-right text-amber-700">{inr(rows.reduce((m, r) => m + r.pending_withdrawal, 0))}</td><td className="p-3 text-right text-red-700" data-testid="wal-foot-total">{inr(rows.reduce((m, r) => m + r.balance + r.pending_withdrawal, 0))}</td><td colSpan={2} /></tr></tfoot>}
        </table>
      </div>
      <CustomerStatementDialog userId={stmt} onClose={() => setStmt(null)} />
    </DashboardLayout>
  );
}
