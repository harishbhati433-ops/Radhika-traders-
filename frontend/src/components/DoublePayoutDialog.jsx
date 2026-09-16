import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { X, Loader2, AlertTriangle, RotateCcw } from "lucide-react";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function DoublePayoutDialog({ open, onClose, onDone }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => { setData(null); api.get("/admin/wallets/double-payouts").then(({ data }) => setData(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail))); };
  useEffect(() => { if (open) load(); }, [open]);

  const reverse = async () => {
    if (!window.confirm(`Reverse ${data.open_count} extra referral payout(s) totalling ${inr(data.open_total)}? Only available wallet balance is deducted — pending withdrawal requests are never touched.`)) return;
    setBusy(true);
    try { const { data: r } = await api.post("/admin/wallets/double-payouts/reverse"); toast.success(r.message); load(); onDone?.(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed"); } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose} data-testid="double-payout-dialog">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div><div className="font-display text-lg font-bold text-slate-900">Double referral payouts scan</div><div className="text-xs text-slate-500">Joins where a referrer received BOTH the standard referral bonus (REF) and the dedicated payout (DREF). The extra REF amount can be reversed.</div></div>
          <button onClick={onClose} data-testid="dp-close"><X className="h-5 w-5" /></button>
        </div>
        {!data ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm" data-testid="dp-summary">
              <div className="flex items-center gap-2 text-amber-900"><AlertTriangle className="h-4 w-4" /><b>{data.open_count}</b> extra payout(s) still to reverse · total <b className="font-mono">{inr(data.open_total)}</b></div>
              <button onClick={reverse} disabled={busy || !data.open_count} data-testid="dp-reverse-all" className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reverse all extra payouts</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {data.items.length === 0 ? <div className="py-10 text-center text-sm text-slate-500" data-testid="dp-empty">No double payouts found. All wallets are clean.</div> : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Referrer</th><th className="p-2">Joined customer</th><th className="p-2">Paid on</th><th className="p-2 text-right">Dedicated (kept)</th><th className="p-2 text-right">Standard (extra)</th><th className="p-2 text-right">Balance / Pending WD</th><th className="p-2">Status</th></tr></thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.ref_id} className="border-t border-slate-100" data-testid={`dp-row-${r.ref_id}`}>
                        <td className="p-2"><div className="font-semibold text-slate-900">{r.name}</div><div className="font-mono text-slate-500">{r.mobile} · {r.customer_id}</div></td>
                        <td className="p-2">{r.joiner}</td>
                        <td className="whitespace-nowrap p-2 font-mono text-slate-600">{(r.paid_at || "").slice(0, 10)}</td>
                        <td className="p-2 text-right font-mono text-emerald-700">{inr(r.dref_amount)}<div className="text-[10px] text-slate-400">{r.dref_id}</div></td>
                        <td className="p-2 text-right font-mono font-bold text-rose-700">{inr(r.ref_amount)}<div className="text-[10px] text-slate-400">{r.ref_id}</div></td>
                        <td className="p-2 text-right font-mono text-slate-700">{inr(r.balance)}<div className="text-[10px] text-amber-700">pending {inr(r.pending_withdrawal)}</div></td>
                        <td className="p-2">{r.already_reversed ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Reversed</span> : <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Extra — to reverse</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
