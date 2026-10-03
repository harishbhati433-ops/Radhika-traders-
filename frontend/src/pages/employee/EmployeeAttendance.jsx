import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "../admin/nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { LogIn, LogOut, Clock, Loader2 } from "lucide-react";
import { StatusPill, MonthSummary, thisMonth, dur, mins } from "../../components/attendance/shared";
import { MySalary } from "../../components/attendance/MySalary";

function Clockface() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return <div className="font-mono text-4xl font-bold tracking-tight" data-testid="att-clock">{t.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>;
}

function LiveWorked({ since }) {
  const [m, setM] = useState(0);
  useEffect(() => { const f = () => setM(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000))); f(); const i = setInterval(f, 30000); return () => clearInterval(i); }, [since]);
  const left = Math.max(0, 420 - m);
  return <p className="mt-2 text-xs text-slate-300" data-testid="att-live-worked">Worked so far <b className="text-white">{dur(m)}</b>{left > 0 ? <> · <b className="text-amber-300">{dur(left)}</b> more for a Full Day</> : <> · <b className="text-emerald-300">Full Day reached</b> — you can check out</>}</p>;
}

export default function EmployeeAttendance() {
  const [month, setMonth] = useState(thisMonth());
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/employee/attendance", { params: { month } }).then(({ data }) => setD(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = async (kind) => {
    setBusy(true);
    try { const { data } = await api.post(`/employee/attendance/${kind}`); toast.success(kind === "check-in" ? `Checked in at ${data.check_in_time}${data.late_minutes ? ` — ${data.late_minutes} min after 10:00 AM (work 7h for a Full Day)` : " — On time"}` : `Checked out at ${data.check_out_time} · worked ${dur(data.worked_minutes)}${data.short_minutes ? ` · short by ${data.short_minutes} min` : " · Full Day"}`, { duration: 7000 }); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(false); }
  };

  const today = d?.today;
  return (
    <DashboardLayout nav={adminNav} title="My Attendance">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white lg:col-span-2" data-testid="att-today-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-300">Today · {d?.date} · Office {d?.office?.start || "10:00 AM"} – {d?.office?.end || "05:00 PM"} · 7h required · auto-close {d?.office?.auto_close || "06:00 PM"}</div>
              <Clockface />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                {today ? <><span>In <b data-testid="att-today-in">{today.check_in_time || "—"}</b></span><span>·</span><span>Out <b data-testid="att-today-out">{today.check_out_time || (today.status === "checkout_missing" ? "Missing" : "—")}</b></span>{today.worked_minutes != null && <><span>·</span><span>Worked <b data-testid="att-today-dur">{dur(today.worked_minutes)}</b></span></>}{today.short_minutes > 0 && <><span>·</span><span className="text-amber-300">Short <b>{today.short_minutes} min</b></span></>}<StatusPill s={today.status} paid={today.leave_paid} testId="att-today-status" /></> : <span data-testid="att-today-none">Not checked in yet</span>}
              </div>
              {today?.status === "checkout_missing" && <p className="mt-2 text-xs text-orange-300" data-testid="att-today-review">You didn't check out — session auto-closed at 6:00 PM. Admin will review and enter your actual check-out time.</p>}
              {today?.check_in && !today?.check_out && today.status !== "checkout_missing" && <LiveWorked since={today.check_in} />}
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
          <ul className="space-y-1 list-disc pl-4"><li>Office <b>{d?.office?.start || "10:00 AM"} – {d?.office?.end || "05:00 PM"}</b> · required <b>7 hours</b> of work</li><li>Work the full 7 hours = <b>Full Day</b>, whatever time you arrive (10:20 → 5:20, 11:00 → 6:00)</li><li>Less than 7 hours = <b>Short Hours</b> — only the missing minutes count</li><li><b>Sunday</b> = paid weekly off · working on Sunday = <b>Sunday Worked</b> (extra)</li><li>Always check out yourself — your time counts till your own check-out</li><li>Forgot to check out? Session auto-closes at <b>6:00 PM</b> as <b>Checkout Missing</b>; admin reviews your actual time</li></ul>
        </div>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-slate-900">Monthly summary</h3>
        <input type="month" value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} data-testid="att-month" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" />
      </div>
      {d && <MonthSummary s={d.summary} />}
      <MySalary />

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Date</th><th className="p-3">Check-In</th><th className="p-3">Check-Out</th><th className="p-3">Worked</th><th className="p-3">Short</th><th className="p-3">Status</th><th className="p-3">Note</th></tr></thead>
          <tbody>
            {(d?.items || []).map((a) => (
              <tr key={a.id} className="border-t border-slate-100" data-testid={`att-row-${a.date}`}>
                <td className="p-3 font-mono text-xs">{a.date}</td><td className="p-3">{a.check_in_time || "—"}</td><td className="p-3">{a.check_out_time || (a.status === "checkout_missing" ? <span className="text-orange-700">Missing</span> : "—")}</td><td className="p-3 font-mono">{a.worked_minutes != null ? dur(a.worked_minutes) : "—"}</td><td className={`p-3 font-mono ${a.short_minutes ? "text-rose-700" : ""}`}>{a.worked_minutes != null ? mins(a.short_minutes || 0) : "—"}</td>
                <td className="p-3"><StatusPill s={a.status} paid={a.leave_paid} /></td><td className="p-3 text-xs text-slate-500">{a.note}{a.source === "admin" && <span className="ml-1 text-[10px] text-slate-400">(by admin)</span>}</td>
              </tr>
            ))}
            {d && d.items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400" data-testid="att-empty">No attendance records this month.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
