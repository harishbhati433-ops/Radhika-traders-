import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { CalendarCheck, Users, UserCheck, UserX, Clock, Plane, IndianRupee, CheckCircle, Hourglass, AlertTriangle } from "lucide-react";
import { inr } from "./shared";

export function AttendanceSummary({ compact = false }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/attendance/dashboard").then(({ data }) => setD(data)).catch(() => {}); }, []);
  if (!d) return null;
  const cells = [
    [Users, "Total Employees", d.total_employees, "text-slate-800"], [UserCheck, "Present Today", d.present_today, "text-emerald-700"], [UserX, "Absent Today", d.absent_today, "text-rose-700"],
    [Clock, "Late Today", d.late_today, "text-amber-700"], [Plane, "On Leave Today", d.on_leave_today, "text-violet-700"], [AlertTriangle, "Checkout Review", d.pending_review || 0, "text-orange-700"], [IndianRupee, "Total Monthly Salary", inr(d.total_monthly_salary), "text-slate-800"],
    [CheckCircle, "Salary Paid", inr(d.salary_paid), "text-emerald-700"], [Hourglass, "Salary Pending", inr(d.salary_pending), "text-amber-700"],
  ];
  return (
    <div className={compact ? "mt-6" : ""} data-testid="attendance-summary">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900"><CalendarCheck className="h-4 w-4 text-red-600" /> Attendance & Salary · {d.date} <span className="text-xs font-semibold text-slate-400">live · {d.month}</span></div>
        {compact && <Link to="/admin/attendance" className="text-xs font-bold text-red-600 hover:underline" data-testid="attendance-summary-link">Open →</Link>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
        {cells.map(([I, l, v, c]) => <div key={l} className="rounded-2xl border border-slate-200 bg-white p-3"><I className={`h-4 w-4 ${c}`} /><div className={`mt-1 font-mono text-lg font-bold ${c}`} data-testid={`att-kpi-${l.toLowerCase().replace(/ /g, "-")}`}>{v}</div><div className="text-[11px] font-semibold text-slate-500">{l}</div></div>)}
      </div>
    </div>
  );
}
