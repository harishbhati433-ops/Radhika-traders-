import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "../admin/nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, Loader2 } from "lucide-react";
import { StatusPill, MonthSummary, thisMonth } from "../../components/attendance/shared";

function Clockface() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return <div className="font-mono text-4xl font-bold tracking-tight" data-testid="att-clock">{t.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>;
}

export default function EmployeeAttendance() {
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/employee/attendance", { params: { month } }).then(({ data }) => setD(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = async (kind) => {
    setBusy(true);
    try { const { data } = await api.post(`/employee/attendance/${kind}`); toast.success(kind === "check-in" ? `Checked in at ${data.check_in_time}${data.late ? " — marked Late" : " — On time"}` : `Checked out at ${data.check_out_time} · ${data.hours} hours`); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  const today = d?.today;
  return (
    <DashboardLayout nav={adminNav} title="My Attendance">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white lg:col-span-2" data-testid="att-today-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300">Today · {d?.date} · Office 10:00 AM – 5:00 PM</div>
              <Clockface />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                {today ? <><span>In <b data-testid="att-today-in">{today.check_in_time || "—"}</b></span><span>·</span><span>Out <b data-testid="att-today-out">{today.check_out_time || "—"}</b></span>{today.hours != null && <><span>·</span><span><b>{today.hours}</b> h</span></>}<StatusPill s={today.status} paid={today.leave_paid} testId="att-today-status" /></> : <span data-testid="att-today-none">Not checked in yet</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!today?.check_in && <button onClick={() => mark("check-in")} disabled={busy} data-testid="att-check-in" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Check In</button>}
              {today?.check_in && !today?.check_out && <button onClick={() => mark("check-out")} disabled={busy} data-testid="att-check-out" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Check Out</button>}
              {today?.check_out && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold" data-testid="att-done"><Clock className="h-4 w-4" /> Day complete</span>}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
          <div className="mb-2 font-bold text-slate-900">Rules</div>
          <ul className="space-y-1 list-disc pl-4"><li>Check-in by <b>10:00 AM</b> = On Time, after = <b>Late</b></li><li>Check-in and Check-out both required</li><li>Less than 4 working hours = <b>Half Day</b></li><li>No check-in = Absent (admin can correct)</li></ul>
        </div>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-slate-900">Monthly summary</h3>
        <input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} data-testid="att-month" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" />
      </div>
      {d && <MonthSummary s={d.summary} />}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Check-In</th><th className="p-3">Check-Out</th><th className="p-3">Hours</th><th className="p-3">Status</th><th className="p-3">Note</th></tr></thead>
          <tbody>
            {(d?.items || []).map((a) => (
              <tr key={a.id} className="border-t border-slate-100" data-testid={`att-row-${a.date}`}>
                <td className="p-3 font-mono text-xs">{a.date}</td><td className="p-3">{a.check_in_time || "—"}</td><td className="p-3">{a.check_out_time || "—"}</td><td className="p-3 font-mono">{a.hours ?? "—"}</td>
                <td className="p-3"><StatusPill s={a.status} paid={a.leave_paid} /></td><td className="p-3 text-xs text-slate-500">{a.note}{a.source === "admin" && <span className="ml-1 text-[10px] text-slate-400">(by admin)</span>}</td>
              </tr>
            ))}
            {d && d.items.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400" data-testid="att-empty">No attendance records this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
