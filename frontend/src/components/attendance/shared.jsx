export const STATUS_META = {
  present: ["Present", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  late: ["Late", "bg-amber-50 text-amber-700 border-amber-200"],
  half_day: ["Half Day", "bg-sky-50 text-sky-700 border-sky-200"],
  absent: ["Absent", "bg-rose-50 text-rose-700 border-rose-200"],
  leave: ["Leave", "bg-violet-50 text-violet-700 border-violet-200"],
  holiday: ["Holiday", "bg-slate-100 text-slate-700 border-slate-200"],
  weekly_off: ["Weekly Off", "bg-slate-100 text-slate-600 border-slate-200"],
};

export function StatusPill({ s, paid, testId }) {
  const [l, cls] = STATUS_META[s] || [s, "bg-slate-100 text-slate-600 border-slate-200"];
  return <span data-testid={testId} className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{l}{s === "leave" ? (paid ? " (Paid)" : " (Unpaid)") : ""}</span>;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function MonthSummary({ s, testId = "att-summary" }) {
  const cells = [["Present", s.present + s.late, "text-emerald-700"], ["Absent", s.absent, "text-rose-700"], ["Late", s.late_marks, "text-amber-700"], ["Half Day", s.half_day, "text-sky-700"], ["Paid Leave", s.paid_leave, "text-violet-700"], ["Unpaid Leave", s.unpaid_leave, "text-violet-700"]];
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid={testId}>
      {cells.map(([l, v, c]) => <div key={l} className="rounded-xl border border-slate-200 bg-white p-3 text-center"><div className={`font-mono text-xl font-bold ${c}`} data-testid={`${testId}-${l.toLowerCase().replace(" ", "-")}`}>{v}</div><div className="text-[11px] font-semibold text-slate-500">{l}</div></div>)}
    </div>
  );
}
