import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { CopyValue } from "./CopyValue";
import { toast } from "sonner";
import { X, Loader2, FileText, FileSpreadsheet, FileDown, ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const dt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const WD = { pending: "bg-amber-50 text-amber-700", approved: "bg-sky-50 text-sky-700", paid: "bg-emerald-50 text-emerald-700", rejected: "bg-rose-50 text-rose-700" };

export function CustomerStatementDialog({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("transactions");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!userId) return;
    setData(null);
    api.get(`/admin/customers/${userId}/statement`).then(({ data }) => setData(data)).catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load"); onClose(); });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = async (fmt) => {
    setBusy(fmt);
    try {
      const res = await fetch(`${API}/admin/customers/${userId}/statement/download?format=${fmt}`, { headers: { Authorization: `Bearer ${localStorage.getItem("rt_token")}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `statement_${(data?.customer?.name || "customer").replace(/\s+/g, "_")}.${fmt === "excel" ? "xlsx" : fmt}`; a.click(); URL.revokeObjectURL(a.href);
      toast.success(`${fmt.toUpperCase()} downloaded`);
    } catch { toast.error("Download failed"); } finally { setBusy(""); }
  };

  if (!userId) return null;
  const c = data?.customer, w = data?.wallet;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose} data-testid="statement-dialog">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">Wallet Statement</div>
            {c ? <>
              <div className="font-display text-lg font-bold" data-testid="stmt-name">{c.name}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                <span className="flex items-center gap-0.5 font-mono" data-testid="stmt-mobile">{c.mobile || "—"}{c.mobile && <CopyValue value={c.mobile} label="Mobile" className="text-slate-300" />}</span>
                <span>{c.email}</span>
                <span className="flex items-center gap-0.5 font-mono">{c.referral_code}<CopyValue value={c.referral_code} label="Customer ID" className="text-slate-300" /></span>
                {c.bank_account && <span className="font-mono">A/C {c.bank_account} · {c.ifsc}</span>}
                {c.upi && <span className="font-mono">UPI {c.upi}</span>}
              </div>
            </> : <div className="text-sm text-slate-300">Loading…</div>}
          </div>
          <button onClick={onClose} data-testid="stmt-close" className="rounded-lg p-1 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        {!data ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-4 sm:grid-cols-5">
              {[["Total earned (आया)", w.total_earnings, "text-emerald-700", "stmt-earned"], ["Withdrawn / paid (गया)", w.total_withdrawn, "text-slate-800", "stmt-withdrawn"], ["Pending withdrawal", w.pending_withdrawal, "text-amber-700", "stmt-pending"], ["Locked bonus", w.bonus_locked, "text-violet-700", "stmt-locked"], ["Available balance", w.balance, "text-red-700", "stmt-balance"]].map(([l, v, cls, t]) => (
                <div key={t} className="rounded-xl bg-slate-50 px-3 py-2" data-testid={t}><div className="text-[11px] font-semibold text-slate-500">{l}</div><div className={`font-mono text-lg font-bold ${cls}`}>{inr(v)}</div></div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
              <div className="flex gap-1 rounded-full bg-slate-100 p-1">
                {[["transactions", `Transactions (${data.transactions.length})`], ["withdrawals", `Withdrawals (${data.withdrawals.length})`]].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} data-testid={`stmt-tab-${k}`} className={`rounded-full px-3 py-1 text-xs font-bold ${tab === k ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}>{l}</button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {[["pdf", FileText, "PDF"], ["excel", FileSpreadsheet, "Excel"], ["csv", FileDown, "CSV"]].map(([f, Icon, l]) => (
                  <button key={f} onClick={() => download(f)} disabled={!!busy} data-testid={`stmt-download-${f}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busy === f ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />} {l}</button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rt-scroll p-4">
              {tab === "transactions" ? (
                <table className="w-full text-left text-xs" data-testid="stmt-tx-table">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Date</th><th className="p-2">Description</th><th className="p-2">Reference</th><th className="p-2 text-right">Credit (आया)</th><th className="p-2 text-right">Debit (गया)</th><th className="p-2 text-right">Balance</th></tr></thead>
                  <tbody>
                    {data.transactions.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No transactions yet.</td></tr>}
                    {data.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100" data-testid={`stmt-tx-${t.id}`}>
                        <td className="whitespace-nowrap p-2 font-mono text-slate-600">{dt(t.date)}</td>
                        <td className="p-2 text-slate-800">{t.description}{t.created_by && <span className="ml-1 text-[10px] text-slate-400">by {t.created_by}</span>}</td>
                        <td className="p-2 font-mono text-slate-500">{t.ref_id}{t.status && t.status !== "completed" && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold capitalize">{t.status}</span>}</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-700">{t.type === "credit" ? <span className="inline-flex items-center gap-0.5"><ArrowDownLeft className="h-3 w-3" />{inr(t.amount)}</span> : t.type === "bonus" ? <span className="inline-flex items-center gap-0.5 text-violet-600"><Lock className="h-3 w-3" />{inr(t.amount)}</span> : ""}</td>
                        <td className="p-2 text-right font-mono font-bold text-rose-700">{t.type === "debit" ? <span className="inline-flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />{inr(t.amount)}</span> : ""}</td>
                        <td className="p-2 text-right font-mono font-semibold text-slate-800">{inr(t.running_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs" data-testid="stmt-wd-table">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Requested</th><th className="p-2 text-right">Amount</th><th className="p-2">Status</th><th className="p-2">Method / Details</th><th className="p-2">UTR</th><th className="p-2">Note</th></tr></thead>
                  <tbody>
                    {data.withdrawals.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">No withdrawal requests yet.</td></tr>}
                    {data.withdrawals.map((x) => (
                      <tr key={x.id} className="border-t border-slate-100" data-testid={`stmt-wd-${x.id}`}>
                        <td className="whitespace-nowrap p-2 font-mono text-slate-600">{dt(x.date)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">{inr(x.amount)}</td>
                        <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${WD[x.status] || "bg-slate-100 text-slate-600"}`}>{x.status}</span></td>
                        <td className="p-2 text-slate-700">{x.method}{x.details && <div className="text-[11px] text-slate-500">{x.details}</div>}</td>
                        <td className="p-2 font-mono text-slate-600">{x.utr || "—"}</td>
                        <td className="p-2 text-slate-500">{x.admin_note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
