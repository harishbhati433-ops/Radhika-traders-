import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { CalendarDays, Loader2, Send, X } from "lucide-react";
import { todayIST } from "./shared";

export const LEAVE_STATUS = {
  pending: ["Pending", "border-amber-200 bg-amber-50 text-amber-800"],
  approved: ["Approved", "border-emerald-200 bg-emerald-50 text-emerald-800"],
  rejected: ["Rejected", "border-rose-200 bg-rose-50 text-rose-700"],
  cancelled: ["Withdrawn", "border-slate-200 bg-slate-50 text-slate-500"],
};

export function LeavePill({ l, testId }) {
  const [label, cls] = LEAVE_STATUS[l.status] || ["", ""];
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid={testId}>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{label}</span>
      {l.status === "approved" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${l.paid ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`} data-testid={`${testId}-pay`}>{l.paid ? "Paid · no salary cut" : "Unpaid · salary deducted"}</span>}
    </span>
  );
}

export const fmtRange = (l) => (l.from_date === l.to_date ? l.from_date : `${l.from_date} → ${l.to_date}`);

export function MyLeaves() {
  const [data, setData] = useState(null);
  const [f, setF] = useState({ from_date: todayIST(), to_date: todayIST(), reason: "", leave_type: "casual" });
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/employee/leaves", { noCache: true }).then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/employee/leaves", f);
      toast.success("Leave request sent to admin"); setF({ ...f, reason: "" }); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const withdraw = async (id) => {
    try { await api.delete(`/employee/leaves/${id}`); toast.success("Request withdrawn"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const s = data?.summary;
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" data-testid="my-leaves">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><CalendarDays className="h-5 w-5 text-red-600" /> Leave Requests</h3>
        {s && <div className="flex flex-wrap gap-2 text-[11px] font-bold" data-testid="my-leaves-summary">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Pending {s.pending}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">Paid leave {s.paid_days}d</span>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">Unpaid leave {s.unpaid_days}d</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{s.year}</span>
        </div>}
      </div>
      <form onSubmit={submit} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4" data-testid="leave-form">
        <div><Label>From</Label><Input type="date" required value={f.from_date} onChange={(e) => setF({ ...f, from_date: e.target.value, to_date: f.to_date < e.target.value ? e.target.value : f.to_date })} data-testid="leave-from" className="mt-1" /></div>
        <div><Label>To</Label><Input type="date" required min={f.from_date} value={f.to_date} onChange={(e) => setF({ ...f, to_date: e.target.value })} data-testid="leave-to" className="mt-1" /></div>
        <div><Label>Type</Label>
          <select value={f.leave_type} onChange={(e) => setF({ ...f, leave_type: e.target.value })} data-testid="leave-type" className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            {["casual", "sick", "emergency", "other"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select></div>
        <div className="sm:col-span-3"><Label>Reason</Label><Input required minLength={3} maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} data-testid="leave-reason" className="mt-1" placeholder="e.g. Family function in village" /></div>
        <div className="flex items-end"><button disabled={busy} data-testid="leave-submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-red-600 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Apply</button></div>
        <p className="text-[11px] text-slate-500 sm:col-span-4">Sundays are already weekly off and are not counted. Admin decides <b>Paid</b> (no salary cut) or <b>Unpaid</b> (that day's salary is deducted in your salary sheet).</p>
      </form>
      <ul className="mt-4 divide-y divide-slate-100" data-testid="my-leaves-list">
        {data && data.items.length === 0 && <li className="py-3 text-sm text-slate-500" data-testid="my-leaves-empty">No leave requests yet.</li>}
        {data?.items.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid={`my-leave-${l.id}`}>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">{fmtRange(l)} <span className="font-mono text-xs text-slate-500">· {l.days} day{l.days > 1 ? "s" : ""} · {l.leave_type}</span></div>
              <div className="text-xs text-slate-500">{l.reason}{l.admin_note && <span className="text-slate-700"> · Admin: {l.admin_note}</span>}</div>
            </div>
            <div className="flex items-center gap-2">
              <LeavePill l={l} testId={`my-leave-status-${l.id}`} />
              {l.status === "pending" && <button onClick={() => withdraw(l.id)} data-testid={`my-leave-withdraw-${l.id}`} title="Withdraw request" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><X className="h-4 w-4" /></button>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
