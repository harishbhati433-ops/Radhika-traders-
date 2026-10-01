import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { Pencil, X, Download } from "lucide-react";
import { StatusPill, STATUS_META, todayIST, thisMonth } from "./shared";

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
  const [f, setF] = useState({ status: row.status === "absent" ? "present" : row.status, check_in: row.check_in_time ? to24(row.check_in_time) : "10:00", check_out: row.check_out_time ? to24(row.check_out_time) : "17:00", leave_paid: !!row.leave_paid, note: row.note || "" });
  const [busy, setBusy] = useState(false);
  const timed = ["present", "late", "half_day"].includes(f.status);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.put(`/admin/attendance/${row.employee_id}/${row.date}`, { ...f, check_in: timed ? f.check_in : null, check_out: timed ? f.check_out : null }); toast.success("Attendance updated & logged"); onSaved(); onClose(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="att-edit-dialog">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold">{row.employee_name} · {row.date}</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <Label>Status</Label>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} data-testid="att-edit-status" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">{Object.entries(STATUS_META).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        {timed && <div className="mt-3 grid grid-cols-2 gap-3"><div><Label>Check-In</Label><Input type="time" value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value })} data-testid="att-edit-in" className="mt-1" /></div><div><Label>Check-Out</Label><Input type="time" value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} data-testid="att-edit-out" className="mt-1" /></div></div>}
        {f.status === "leave" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.leave_paid} onChange={(e) => setF({ ...f, leave_paid: e.target.checked })} data-testid="att-edit-paid" /> Paid leave (salary not deducted)</label>}
        <div className="mt-3"><Label>Note / reason</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="att-edit-note" className="mt-1" placeholder="e.g. Forgot to check out" /></div>
        <button disabled={busy} data-testid="att-edit-save" className="mt-5 w-full rounded-full bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">Save correction</button>
      </form>
    </div>
  );
}
const to24 = (t) => { const [hm, ap] = t.split(" "); let [h, m] = hm.split(":").map(Number); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return `${String(h).padStart(2, "0")}:${m.toString().padStart(2, "0")}`; };

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
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Employee</th><th className="p-3">Check-In</th><th className="p-3">Check-Out</th><th className="p-3">Hours</th><th className="p-3">Status</th><th className="p-3">Note</th><th className="p-3"></th></tr></thead>
          <tbody>
            {d.items.map((a) => (
              <tr key={`${a.employee_id}-${a.date}`} className="border-t border-slate-100" data-testid={`adm-att-row-${a.employee_id}-${a.date}`}>
                <td className="p-3 font-mono text-xs">{a.date}</td><td className="p-3"><div className="font-semibold text-slate-900">{a.employee_name}</div><div className="font-mono text-[10px] text-slate-400">{a.employee_code}</div></td>
                <td className="p-3">{a.check_in_time || "—"}</td><td className="p-3">{a.check_out_time || "—"}</td><td className="p-3 font-mono">{a.hours ?? "—"}</td>
                <td className="p-3"><StatusPill s={a.status} paid={a.leave_paid} testId={`adm-att-status-${a.employee_id}-${a.date}`} /></td>
                <td className="p-3 text-xs text-slate-500">{a.note}{a.source === "admin" && <span className="ml-1 text-[10px] text-slate-400">· edited by {a.edited_by}</span>}</td>
                <td className="p-3 text-right"><button onClick={() => setEdit(a)} data-testid={`adm-att-edit-${a.employee_id}-${a.date}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-3 w-3" /> Edit</button></td>
              </tr>
            ))}
            {d.items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400" data-testid="adm-att-empty">No records.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <EditDialog row={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}
