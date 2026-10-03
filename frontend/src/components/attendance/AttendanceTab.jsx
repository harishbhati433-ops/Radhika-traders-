import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { Pencil, X, Download, CalendarPlus } from "lucide-react";
import { StatusPill, STATUS_META, EDIT_STATUSES, EDIT_LABELS, EDIT_HELP, todayIST, thisMonth, dur, mins, inr } from "./shared";

const token = () => localStorage.getItem("rt_token");
export const dl = async (path, params) => {
  try {
    const { data, headers } = await api.get(path, { params, responseType: "blob" });
    const name = (headers["content-disposition"] || "").match(/filename="?([^"]+)"?/)?.[1] || "download";
    const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  } catch { toast.error("Download failed"); }
};
export function ExportButtons({ path, params, testId }) {
  return <div className="inline-flex gap-1" data-testid={testId}>{["xlsx", "csv", "pdf"].map((f) => <button key={f} type="button" onClick={() => dl(path, { ...params, format: f })} data-testid={`${testId}-${f}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase text-slate-700 hover:bg-slate-50"><Download className="h-3 w-3" /> {f}</button>)}</div>;
}

function EditDialog({ row, onClose, onSaved }) {
  const init = ["absent", "checkout_missing"].includes(row.status) ? "present" : row.status;
  const [f, setF] = useState({ status: init, check_in: row.check_in_time ? to24(row.check_in_time) : "10:00", check_out: row.check_out_time ? to24(row.check_out_time) : "17:00", leave_paid: !!row.leave_paid, note: "" });
  const [busy, setBusy] = useState(false);
  const timed = ["present", "late", "half_day", "short_hours"].includes(f.status);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.put(`/admin/attendance/${row.employee_id}/${row.date}`, { ...f, check_in: timed ? f.check_in : null, check_out: timed ? f.check_out : null }); toast.success(`Status set to ${STATUS_META[f.status][0]} — attendance & salary updated`); onSaved(); onClose(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const hist = row.status_history || [];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="att-edit-dialog">
      <form onSubmit={save} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between"><h3 className="font-display text-lg font-bold">{row.employee_name} · {row.date}</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <p className="mb-3 text-xs text-slate-500">Current: <StatusPill s={row.status} paid={row.leave_paid} />{row.check_in_time && <span className="ml-2">Actual {row.check_in_time}{row.check_out_time ? ` – ${row.check_out_time}` : ""}</span>}</p>
        {row.status === "checkout_missing" && <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800" data-testid="att-edit-review-note"><b>Checkout missing</b> — session auto-closed at 6:00 PM{row.auto_closed_time ? ` (${row.auto_closed_time})` : ""}. Enter the employee's actual check-out time below to approve; working duration & deduction will be calculated from it.</div>}
        <Label>New Status (final — automatic logic won't override it)</Label>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} data-testid="att-edit-status" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{EDIT_STATUSES.map((k) => <option key={k} value={k}>{EDIT_LABELS[k] || STATUS_META[k][0]}</option>)}</select>
        <p className="mt-1 text-[11px] text-slate-500" data-testid="att-edit-help">{EDIT_HELP[f.status]}</p>
        {timed && <div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Check-In</Label><Input type="time" value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value })} data-testid="att-edit-in" className="mt-1" /></div><div><Label>Actual Check-Out</Label><Input type="time" value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} data-testid="att-edit-out" className="mt-1" /></div></div>}
        {f.status === "leave" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.leave_paid} onChange={(e) => setF({ ...f, leave_paid: e.target.checked })} data-testid="att-edit-paid" /> Paid leave (salary not deducted)</label>}
        <div className="mt-3"><Label>Remark (optional)</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="att-edit-note" className="mt-1" placeholder="e.g. Informed on phone, traffic jam" /></div>
        <button disabled={busy} data-testid="att-edit-save" className="mt-5 w-full rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">Save status</button>
        {hist.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-3" data-testid="att-edit-history">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Change history</div>
            <ul className="space-y-1.5">
              {[...hist].reverse().map((h, i) => (
                <li key={i} className="text-xs text-slate-600" data-testid={`att-hist-${i}`}><b className="text-slate-800">{STATUS_META[h.old_status]?.[0] || h.old_status}</b> → <b className="text-slate-800">{STATUS_META[h.new_status]?.[0] || h.new_status}</b> · by {h.edited_by} · {h.edited_at_label}{h.remark ? <span className="text-slate-400"> · “{h.remark}”</span> : null}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
const to24 = (t) => { const [hm, ap] = t.split(" "); let [h, m] = hm.split(":").map(Number); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${m.toString().padStart(2, "0")}`; };

function MarkAttendance({ employees, onPick }) {
  const [open, setOpen] = useState(false);
  const [emp, setEmp] = useState("");
  const [date, setDate] = useState(todayIST());
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!emp) return toast.error("Select an employee");
    setBusy(true);
    try {
      const { data } = await api.get("/admin/attendance", { params: { date, employee_id: emp } });
      const row = data.items[0] || { id: "", employee_id: emp, date, status: "absent", check_in_time: "", check_out_time: "", virtual: true, employee_name: employees.find((e) => e.id === emp)?.name };
      onPick(row); setOpen(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  if (!open) return <button type="button" onClick={() => setOpen(true)} data-testid="att-mark-btn" className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"><CalendarPlus className="h-4 w-4" /> Mark / Backdate Attendance</button>;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-900 bg-slate-50 p-3" data-testid="att-mark-panel">
      <div><Label className="text-[11px]">Employee</Label><select value={emp} onChange={(e) => setEmp(e.target.value)} data-testid="att-mark-emp" className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Select employee</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}</select></div>
      <div><Label className="text-[11px]">Date (any past day)</Label><input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} data-testid="att-mark-date" className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></div>
      <button type="button" onClick={go} disabled={busy} data-testid="att-mark-go" className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "…" : "Next →"}</button>
      <button type="button" onClick={() => setOpen(false)} data-testid="att-mark-cancel" className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button>
    </div>
  );
}

export function AttendanceTab() {
  const [mode, setMode] = useState("today");
  const [date, setDate] = useState(todayIST());
  const [month, setMonth] = useState(thisMonth());
  const [emp, setEmp] = useState("");
  const [status, setStatus] = useState("");
  const [d, setD] = useState({ items: [], employees: [] });
  const [edit, setEdit] = useState(null);
  const params = { ...(mode === "month" ? { month } : { date: mode === "today" ? todayIST() : date }), ...(emp ? { employee_id: emp } : {}), ...(status ? { status } : {}) };
  const load = () => api.get("/admin/attendance", { params }).then(({ data }) => setD(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [mode, date, month, emp, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";
  return (
    <div>
      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5" data-testid="att-filters">
        <select value={mode} onChange={(e) => setMode(e.target.value)} data-testid="att-filter-mode" className={sel}><option value="today">Today</option><option value="date">Date wise</option><option value="month">Month wise</option></select>
        {mode === "date" && <input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} data-testid="att-filter-date" className={sel} />}
        {mode === "month" && <input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} data-testid="att-filter-month" className={sel} />}
        <select value={emp} onChange={(e) => setEmp(e.target.value)} data-testid="att-filter-emp" className={sel}><option value="">All employees</option>{d.employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="att-filter-status" className={sel}><option value="">All statuses</option>{Object.entries(STATUS_META).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <ExportButtons path="/admin/attendance/export" params={{ ...(mode === "month" ? { month } : { date: mode === "today" ? todayIST() : date }), ...(emp ? { employee_id: emp } : {}) }} testId="att-export" />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <MarkAttendance employees={d.employees} onPick={setEdit} />
        <span className="text-[11px] text-slate-500">Backdated entries (yesterday, last week, last month…) recalculate that month's salary sheet instantly.</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-slate-50 px-4 py-2 text-[11px] text-slate-600" data-testid="att-rules">
        <span><b>Office</b> {d.rules?.office_start || "10:00 AM"} – {d.rules?.office_end || "05:00 PM"}</span><span><b>Required</b> 7h working</span><span><b>Full Day</b> = 7h worked, any arrival time, ₹0 deduction</span><span><b>Short</b> = minute-wise deduction</span><span><b>Auto close</b> {d.rules?.auto_close || "06:00 PM"} → Checkout Missing (admin review, unpaid until approved)</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Date", "Employee", "Check-In", "Manual Check-Out", "Working Duration", "Late Min", "Extra Min", "Adjusted Min", "Short Min", "Status", "Salary Deduction", "Note", ""].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {d.items.map((a) => (
              <tr key={`${a.employee_id}-${a.date}`} className={`border-t border-slate-100 ${a.status === "checkout_missing" ? "bg-orange-50/40" : ""}`} data-testid={`adm-att-row-${a.employee_id}-${a.date}`}>
                <td className="p-3 font-mono">{a.date}</td><td className="p-3"><div className="font-semibold text-slate-900">{a.employee_name}</div><div className="font-mono text-[10px] text-slate-400">{a.employee_code}</div></td>
                <td className="p-3 whitespace-nowrap" data-testid={`adm-att-in-${a.employee_id}-${a.date}`}>{a.check_in_time || "—"}</td>
                <td className="p-3 whitespace-nowrap" data-testid={`adm-att-out-${a.employee_id}-${a.date}`}>{a.check_out_time || (a.status === "checkout_missing" ? <span className="text-orange-700">Missing</span> : "—")}</td>
                <td className="p-3 font-mono font-bold" data-testid={`adm-att-dur-${a.employee_id}-${a.date}`}>{a.worked_minutes != null ? dur(a.worked_minutes) : "—"}</td>
                <td className={`p-3 font-mono ${a.late_minutes ? "text-amber-700" : ""}`}>{a.check_in_time ? mins(a.late_minutes || 0) : "—"}</td>
                <td className="p-3 font-mono text-emerald-700">{a.worked_minutes != null ? mins(a.extra_minutes || 0) : "—"}</td>
                <td className="p-3 font-mono text-sky-700">{a.worked_minutes != null ? mins(a.adjusted_minutes || 0) : "—"}</td>
                <td className={`p-3 font-mono ${a.short_minutes ? "font-bold text-rose-700" : ""}`} data-testid={`adm-att-short-${a.employee_id}-${a.date}`}>{a.worked_minutes != null ? mins(a.short_minutes || 0) : "—"}</td>
                <td className="p-3"><StatusPill s={a.status} paid={a.leave_paid} testId={`adm-att-status-${a.employee_id}-${a.date}`} /></td>
                <td className={`p-3 font-mono whitespace-nowrap ${a.deduction ? "font-bold text-rose-700" : "text-emerald-700"}`} data-testid={`adm-att-ded-${a.employee_id}-${a.date}`}>{a.deduction == null ? <span className="text-slate-400">salary not set</span> : a.status === "checkout_missing" ? <span title="Unpaid until admin approves checkout">{inr(a.deduction)} · pending</span> : inr(a.deduction)}</td>
                <td className="p-3 text-slate-500" data-testid={`adm-att-note-${a.employee_id}-${a.date}`}>
                  {a.manual_override && a.status_history?.length > 0 && (() => { const h = a.status_history[a.status_history.length - 1]; return <div className="text-[10px] font-semibold text-slate-700">Manual: {STATUS_META[h.old_status]?.[0] || h.old_status} → {STATUS_META[h.new_status]?.[0] || h.new_status}</div>; })()}
                  {a.note && <div>{a.note}</div>}
                  {a.source === "admin" && <div className="text-[10px] text-slate-400">by {a.edited_by}{a.edited_at_label ? ` · ${a.edited_at_label}` : ""}</div>}
                </td>
                <td className="p-3 text-right"><button onClick={() => setEdit(a)} data-testid={`adm-att-edit-${a.employee_id}-${a.date}`} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${a.status === "checkout_missing" ? "border-orange-300 bg-orange-100 text-orange-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}><Pencil className="h-3 w-3" /> {a.status === "checkout_missing" ? "Review" : "Edit"}</button></td>
              </tr>
            ))}
            {d.items.length === 0 && <tr><td colSpan={13} className="p-8 text-center text-slate-400" data-testid="adm-att-empty">No records.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <EditDialog row={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}
