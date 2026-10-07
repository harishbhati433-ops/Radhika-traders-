import { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { AttendanceSummary } from "../../components/attendance/AttendanceSummary";
import { AttendanceTab } from "../../components/attendance/AttendanceTab";
import { SalaryTab } from "../../components/attendance/SalaryTab";
import { YearlyTab } from "../../components/attendance/YearlyTab";
import { LeavesTab } from "../../components/attendance/LeavesTab";
import api from "../../lib/api";
import { OfficeTimingCard } from "../../components/attendance/OfficeTimingCard";
import { AttendancePolicyCard } from "../../components/attendance/AttendancePolicyCard";

export default function AdminAttendance() {
  const [tab, setTab] = useState("attendance");
  const [tick, setTick] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const loadPending = () => api.get("/admin/leaves", { params: { status: "pending" }, noCache: true }).then(({ data }) => setPendingLeaves(data.pending)).catch(() => {});
  useEffect(() => { loadPending(); }, []);
  return (
    <DashboardLayout nav={adminNav} title="Attendance & Salary">
      <AttendanceSummary />
      <OfficeTimingCard onSaved={() => setTick((t) => t + 1)} />
      <AttendancePolicyCard />
      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        {[["attendance", "Attendance"], ["leaves", "Leave Requests"], ["salary", "Salary Sheet"], ["yearly", "Yearly Summary"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`att-tab-${k}`} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}{k === "leaves" && pendingLeaves > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900" data-testid="att-tab-leaves-badge">{pendingLeaves}</span>}</button>)}
      </div>
      {tab === "attendance" ? <AttendanceTab key={tick} /> : tab === "leaves" ? <LeavesTab onChanged={() => { loadPending(); setTick((t) => t + 1); }} /> : tab === "salary" ? <SalaryTab /> : <YearlyTab />}
    </DashboardLayout>
  );
}
