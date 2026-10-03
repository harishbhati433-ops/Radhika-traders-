import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { X, FileText, CheckCircle, Loader2, CalendarRange, RefreshCw, Eye, EyeOff, Trash2 } from "lucide-react";
import { ImageUpload } from "../ImageUpload";
import { StatementDialog } from "./StatementDialog";
import { inr, thisMonth } from "./shared";
import { ExportButtons, dl } from "./AttendanceTab";

const F = ({ k, l, f, setF }) => <div><Label>{l}</Label><Input type="number" min="0" step="0.01" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`sal-${k}`} className="mt-1" /></div>;

function DateDeductions({ row, onChanged }) {
  const [list, setList] = useState(row.date_deductions || []);
  const [d, setD] = useState({ date: `${row.month}-01`, amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!d.amount || Number(d.amount) <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try { const { data } = await api.post(`/admin/salary/${row.employee_id}/${row.month}/date-deduction`, { ...d, amount: Number(d.amount) }); setList(data.date_deductions); setD({ ...d, amount: "", reason: "" }); toast.success(`₹${d.amount} deducted for ${d.date}`); onChanged(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    try { const { data } = await api.delete(`/admin/salary/${row.employee_id}/${row.month}/date-deduction/${id}`); setList(data.date_deductions); toast.success("Deduction removed"); onChanged(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const [y, m] = row.month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return (
    <div className="mt-5 border-t border-slate-100 pt-4" data-testid="sal-date-ded">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Deduct for a specific date</div>
      <div className="mt-2 grid grid-cols-[1fr_90px_1fr_auto] items-end gap-2">
        <div><Label className="text-[11px]">Date</Label><input type="date" min={`${row.month}-01`} max={`${row.month}-${String(last).padStart(2, "0")}`} value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} data-testid="sal-dd-date" className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" /></div>
        <div><Label className="text-[11px]">Amount ₹</Label><Input type="number" min="1" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} data-testid="sal-dd-amount" className="mt-1 h-9 text-xs" /></div>
        <div><Label className="text-[11px]">Reason</Label><Input value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} data-testid="sal-dd-reason" className="mt-1 h-9 text-xs" placeholder="optional" /></div>
        <button type="button" onClick={add} disabled={busy} data-testid="sal-dd-add" className="h-9 rounded-full bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-60">Add</button>
      </div>
      {list.length > 0 && <ul className="mt-3 space-y-1">{list.map((x) => <li key={x.id} className="flex items-center justify-between rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-800" data-testid={`sal-dd-item-${x.id}`}><span><b>{x.date}</b> · −₹{x.amount}{x.reason ? ` · ${x.reason}` : ""} <span className="text-rose-400">· by {x.by}</span></span><button type="button" onClick={() => remove(x.id)} data-testid={`sal-dd-remove-${x.id}`} className="rounded-full p-1 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button></li>)}</ul>}
    </div>
  );
}

function AdjustDialog({ row, onClose, onSaved }) {
  const [f, setF] = useState({ monthly_salary: row.monthly_salary, bonus: row.bonus, incentive: row.incentive, advance: row.advance, deduction: row.deduction, note: row.note });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (Number(f.monthly_salary) !== Number(row.monthly_salary)) await api.put(`/admin/salary/${row.employee_id}`, { monthly_salary: Number(f.monthly_salary) });
      await api.put(`/admin/salary/${row.employee_id}/${row.month}`, { bonus: +f.bonus || 0, incentive: +f.incentive || 0, advance: +f.advance || 0, deduction: +f.deduction || 0, note: f.note });
      toast.success("Salary updated"); onSaved(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const p = { f, setF };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="sal-dialog">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold">{row.employee_name} · {row.month}</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <F k="monthly_salary" l="Base Monthly Salary (₹) — daily rate = ÷30" {...p} />
        <div className="mt-3 grid grid-cols-2 gap-3"><F k="bonus" l="Bonus (+)" {...p} /><F k="incentive" l="Incentive (+)" {...p} /><F k="advance" l="Advance Salary (−)" {...p} /><F k="deduction" l="Fixed Deduction from month (−)" {...p} /></div>
        <div className="mt-3"><Label>Reason / Remark</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="sal-note" className="mt-1" placeholder="e.g. Advance given on 5th, late fine" /></div>
        <button disabled={busy} data-testid="sal-save" className="mt-5 w-full rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">Save</button>
        <DateDeductions row={row} onChanged={onSaved} />
      </form>
    </div>
  );
}

function PayDialog({ row, onClose, onDone }) {
  const [proof, setProof] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const { data } = await api.put(`/admin/salary/${row.employee_id}/${row.month}`, { bonus: row.bonus, incentive: row.incentive, advance: row.advance, deduction: row.deduction, note: row.note, payment_status: "paid", proof_url: proof, utr });
      toast.success(data.email_sent_to ? `Marked paid · credit email sent to ${data.email_sent_to}` : "Marked paid (employee has no email set — no mail sent)", { duration: 7000 }); onDone(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="sal-pay-dialog">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Pay {inr(row.net_payable)} · {row.employee_name}</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <p className="mb-4 text-xs text-slate-500">Salary for {row.month}. Upload the transfer screenshot — the employee gets an email “Salary credited {inr(row.net_payable)}” with this proof.</p>
        <ImageUpload label="Payment screenshot (proof)" value={proof} onChange={setProof} testId="sal-pay-proof" />
        <div className="mt-3"><Label>UTR / Transaction ID (optional)</Label><Input value={utr} onChange={(e) => setUtr(e.target.value)} data-testid="sal-pay-utr" className="mt-1" placeholder="e.g. 4257XXXXXXXX" /></div>
        <button disabled={busy} data-testid="sal-pay-confirm" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Confirm Paid & Email Employee</button>
      </form>
    </div>
  );
}

export function SalaryTab() {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [edit, setEdit] = useState(null);
  const [paying, setPaying] = useState(null);
  const [stmt, setStmt] = useState(null);
  const load = () => api.get("/admin/salary", { params: { month } }).then(({ data }) => setRows(data.rows)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  const pay = async (r) => {
    if (r.payment_status !== "paid") return setPaying(r);
    if (!window.confirm(`Mark ${r.employee_name}'s ${month} salary as PENDING again?`)) return;
    try { await api.put(`/admin/salary/${r.employee_id}/${month}`, { bonus: r.bonus, incentive: r.incentive, advance: r.advance, deduction: r.deduction, note: r.note, payment_status: "pending" }); toast.success("Marked pending"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const tot = (k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
  const publish = async (r) => {
    if (r.published && !window.confirm(`Hide ${r.employee_name}'s ${month} salary from the employee panel again?`)) return;
    if (!r.published && !window.confirm(`Publish ${r.employee_name}'s ${month} Final Salary ${inr(r.net_payable)} to the employee panel? It will be treated as finalized.`)) return;
    try { await api.put(`/admin/salary/${r.employee_id}/${month}/publish`, { published: !r.published }); toast.success(r.published ? "Salary hidden from employee" : "Salary published — employee can now see it"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const recalc = async () => {
    try { const { data } = await api.post("/admin/salary/recalculate", null, { params: { month } }); toast.success(`Recalculated on ${data.basis} basis · ${data.records} attendance records refreshed`); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3"><input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} data-testid="sal-month" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><span className="text-xs text-slate-500">Daily rate = Monthly ÷ 30 (fixed) · Sunday = paid weekly off · Sunday worked = +1 daily rate extra · Final = Base + Sunday Extra + Bonus − Attendance Deduction − Manual Adjustment</span></div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-700"><button type="button" onClick={recalc} data-testid="sal-recalc" className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-3 w-3" /> Recalculate (÷30 basis)</button><span data-testid="sal-total-payable">Total payable <b className="font-mono">{inr(tot("net_payable"))}</b></span><ExportButtons path="/admin/salary/export" params={{ month }} testId="sal-export" /></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Employee", "Base Salary", "Daily Rate", "Present", "Short", "Half", "Absent", "Leave P/U", "Wk Off", "Sun Worked", "Sunday Extra", "Att. Deduction", "Bonus+Inc", "Manual Adj", "Final Salary", "Publish", "Payment", ""].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee_id} className="border-t border-slate-100" data-testid={`sal-row-${r.employee_id}`}>
                <td className="p-3"><div className="font-semibold text-slate-900">{r.employee_name}</div><div className="font-mono text-[10px] text-slate-400">{r.employee_code}</div></td>
                <td className="p-3 font-mono">{r.monthly_salary ? inr(r.monthly_salary) : <span className="text-rose-600">Not set</span>}</td><td className="p-3 font-mono" data-testid={`sal-perday-${r.employee_id}`}>{inr(r.per_day)}</td>
                <td className="p-3 font-mono">{r.present + r.late}</td><td className="p-3 font-mono text-amber-700">{r.short_hours}</td><td className="p-3 font-mono">{r.half_day}</td><td className="p-3 font-mono text-rose-700">{r.absent}</td><td className="p-3 font-mono">{r.paid_leave}/{r.unpaid_leave}</td><td className="p-3 font-mono">{r.weekly_off}</td>
                <td className="p-3 font-mono text-teal-700">{r.sunday_worked}</td><td className="p-3 font-mono text-teal-700" data-testid={`sal-sunextra-${r.employee_id}`}>+{inr(r.sunday_extra)}</td><td className="p-3 font-mono text-rose-700" data-testid={`sal-attded-${r.employee_id}`}>−{inr(r.attendance_deduction)}</td>
                <td className="p-3 font-mono text-emerald-700">+{inr(r.bonus + r.incentive)}</td><td className="p-3 font-mono text-rose-700" data-testid={`sal-manual-${r.employee_id}`}>−{inr(r.manual_adjustment)}</td>
                <td className="p-3 font-mono text-sm font-bold text-slate-900" data-testid={`sal-net-${r.employee_id}`}>{inr(r.net_payable)}</td>
                <td className="p-3"><button onClick={() => publish(r)} data-testid={`sal-publish-${r.employee_id}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${r.published ? "bg-sky-100 text-sky-700" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{r.published ? <><Eye className="h-3 w-3" /> Published</> : <><EyeOff className="h-3 w-3" /> Publish to employee</>}</button></td>
                <td className="p-3"><button onClick={() => pay(r)} data-testid={`sal-pay-${r.employee_id}`} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${r.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><CheckCircle className="h-3 w-3" /> {r.payment_status === "paid" ? `Paid ${r.payment_date}` : "Mark Paid"}</button>{r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer" data-testid={`sal-proof-${r.employee_id}`} className="ml-1 text-[10px] font-bold text-sky-700 hover:underline">proof</a>}</td>
                <td className="p-3 whitespace-nowrap text-right"><button onClick={() => setEdit(r)} data-testid={`sal-edit-${r.employee_id}`} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50">Set / Adjust</button> <button onClick={() => dl(`/admin/salary/slip/${r.employee_id}`, { month, format: "pdf" })} data-testid={`sal-slip-${r.employee_id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white"><FileText className="h-3 w-3" /> Slip</button> <button onClick={() => setStmt(r)} data-testid={`sal-stmt-${r.employee_id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-900 hover:bg-slate-100"><CalendarRange className="h-3 w-3" /> 3/6/12 Mo</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={18} className="p-8 text-center text-slate-400">No employees.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <AdjustDialog row={edit} onClose={() => setEdit(null)} onSaved={load} />}
      {paying && <PayDialog row={paying} onClose={() => setPaying(null)} onDone={load} />}
      {stmt && <StatementDialog row={stmt} onClose={() => setStmt(null)} />}
    </div>
  );
}
