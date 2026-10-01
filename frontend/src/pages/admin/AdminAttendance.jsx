import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { AttendanceSummary } from "../../components/attendance/AttendanceSummary";
import { AttendanceTab } from "../../components/attendance/AttendanceTab";
import { SalaryTab } from "../../components/attendance/SalaryTab";

export default function AdminAttendance() {
  const [tab, setTab] = useState("attendance");
  return (
    <DashboardLayout nav={adminNav} title="Attendance & Salary">
      <AttendanceSummary />
      <div className="mt-6 mb-4 flex gap-2">
        {[["attendance", "Attendance"], ["salary", "Salary Sheet"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`att-tab-${k}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>)}
      </div>
      {tab === "attendance" ? <AttendanceTab /> : <SalaryTab />}
    </DashboardLayout>
  );
}
