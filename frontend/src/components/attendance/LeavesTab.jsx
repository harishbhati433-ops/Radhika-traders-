import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Check, X, Loader2, RefreshCw, Wallet, WalletCards } from "lucide-react";
import { LeavePill, fmtRange } from "./MyLeaves";

const FILTERS = [["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]];

export function LeavesTab({ onChanged }) {
  const [status, setStatus] = useState("pending");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api.get("/admin/leaves", { params: status ? { status } : {}, noCache: true }).then(({ data }) => setData(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (l, action, paid) => {
    setBusy(l.id + action);
    try {
      const { data: upd } = await api.patch(`/admin/leaves/${l.id}`, { action, paid });
      toast.success(action === "approve" ? `Approved as ${paid ? "Paid" : "Unpaid"} leave — attendance & salary updated` : action === "reject" ? "Leave rejected" : `Switched to ${upd.paid ? "Paid" : "Unpaid"} — salary sheet updated`);
      load(); onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };
  const B = ({ onClick, id, cls, children }) => <button onClick={onClick} disabled={!!busy} data-testid={id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${cls}`}>{busy === id.replace(/^leave-/, "").split("-").slice(1).join("-") ? null : null}{children}</button>;

  return (
    <div data-testid="leaves-tab">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([k, l]) => <button key={k} onClick={() => setStatus(k)} data-testid={`leaves-filter-${k || "all"}`} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === k ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}{k === "pending" && data?.pending > 0 && <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] text-slate-900" data-testid="leaves-pending-count">{data.pending}</span>}</button>)}
        </div>
        <button onClick={load} data-testid="leaves-refresh" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">One-tap decision. <b>Paid</b> = no salary cut · <b>Unpaid</b> = that day's salary is deducted automatically in the Salary Sheet. You can switch Paid ↔ Unpaid anytime later.</p>
      {!data ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500" data-testid="leaves-empty">No {status || ""} leave requests.</div>
      ) : (
        <div className="grid gap-3">
          {data.items.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4" data-testid={`leave-card-${l.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-bold text-slate-900">{l.employee_name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{l.employee_code}</span>
                  <LeavePill l={l} testId={`leave-status-${l.id}`} />
                </div>
                <div className="mt-1 text-sm text-slate-800"><span className="font-semibold">{fmtRange(l)}</span> · {l.days} working day{l.days > 1 ? "s" : ""} · <span className="capitalize">{l.leave_type}</span></div>
                <div className="text-xs text-slate-500">Reason: {l.reason}</div>
                <div className="mt-1 text-[11px] text-slate-400">Requested {new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}{l.decided_by && ` · Decided by ${l.decided_by}`}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.status === "pending" && <>
                  <B id={`leave-approve-paid-${l.id}`} onClick={() => act(l, "approve", true)} cls="bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-3.5 w-3.5" /> Approve · Paid</B>
                  <B id={`leave-approve-unpaid-${l.id}`} onClick={() => act(l, "approve", false)} cls="bg-amber-500 text-slate-900 hover:bg-amber-400"><Wallet className="h-3.5 w-3.5" /> Approve · Unpaid</B>
                  <B id={`leave-reject-${l.id}`} onClick={() => act(l, "reject")} cls="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"><X className="h-3.5 w-3.5" /> Reject</B>
                </>}
                {l.status === "approved" && <>
                  <B id={`leave-toggle-pay-${l.id}`} onClick={() => act(l, l.paid ? "set_unpaid" : "set_paid")} cls="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><WalletCards className="h-3.5 w-3.5" /> Make {l.paid ? "Unpaid" : "Paid"}</B>
                  <B id={`leave-reject-${l.id}`} onClick={() => act(l, "reject")} cls="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"><X className="h-3.5 w-3.5" /> Cancel leave</B>
                </>}
                {l.status === "rejected" && <>
                  <B id={`leave-approve-paid-${l.id}`} onClick={() => act(l, "approve", true)} cls="border border-emerald-200 bg-emerald-50 text-emerald-700"><Check className="h-3.5 w-3.5" /> Approve · Paid</B>
                  <B id={`leave-approve-unpaid-${l.id}`} onClick={() => act(l, "approve", false)} cls="border border-amber-200 bg-amber-50 text-amber-800"><Wallet className="h-3.5 w-3.5" /> Approve · Unpaid</B>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
