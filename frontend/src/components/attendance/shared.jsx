export const STATUS_META = {
  present: ["Present (Full Day)", "bg-emerald-50 text-emerald-700 border-emerald-200"],
  sunday_worked: ["Sunday Worked (+extra)", "bg-teal-50 text-teal-700 border-teal-200"],
  short_hours: ["Short Hours", "bg-amber-50 text-amber-700 border-amber-200"],
  late: ["Late", "bg-amber-50 text-amber-700 border-amber-200"],
  half_day: ["Half Day", "bg-sky-50 text-sky-700 border-sky-200"],
  absent: ["Absent", "bg-rose-50 text-rose-700 border-rose-200"],
  leave: ["Leave", "bg-violet-50 text-violet-700 border-violet-200"],
  holiday: ["Holiday", "bg-slate-100 text-slate-700 border-slate-200"],
  weekly_off: ["Weekly Off", "bg-slate-100 text-slate-600 border-slate-200"],
  checkout_missing: ["Checkout Missing – Admin Review", "bg-orange-50 text-orange-700 border-orange-300"],
};
export const EDIT_STATUSES = ["present", "late", "half_day", "absent", "leave", "holiday", "weekly_off", "sunday_worked", "short_hours"];
export const EDIT_LABELS = { present: "Present (Full Day salary)", late: "Late (full day salary, late mark)", sunday_worked: "Sunday Worked (+1 day extra)", short_hours: "Short Hours — auto, minute-wise from times" };
export const EDIT_HELP = {
  present: "Full day salary applies. Any short-hours deduction is removed.", late: "Counted as Late mark; full day salary applies.", half_day: "50% of the day's salary (on a Sunday: +50% extra).", absent: "That day's salary (Monthly ÷ 30) is deducted.",
  leave: "Paid leave = full salary, unpaid leave = deducted (tick below).", holiday: "Not counted as absence or late; paid.", weekly_off: "Paid weekly off; not counted as absence.", sunday_worked: "Sunday is already paid; working adds +1 daily rate as Sunday Extra.", short_hours: "System calculates from check-in/out: 7h = full, else deducted per missing minute.",
};
export const dur = (m) => (m == null ? "—" : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
export const mins = (m) => (m == null ? "—" : m === 0 ? "0" : `${m} min`);

export function StatusPill({ s, paid, testId }) {
  const [l, cls] = STATUS_META[s] || [s, "bg-slate-100 text-slate-600 border-slate-200"];
  return <span data-testid={testId} className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{l}{s === "leave" ? (paid ? " (Paid)" : " (Unpaid)") : ""}</span>;
}

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function MonthSummary({ s, testId = "att-summary" }) {
  const cells = [["Present", s.present + s.late, "text-emerald-700"], ["Short Hours", s.short_hours || 0, "text-amber-700"], ["Absent", s.absent, "text-rose-700"], ["Half Day", s.half_day, "text-sky-700"], ["Sunday Worked", s.sunday_worked || 0, "text-teal-700"], ["Weekly Off", s.weekly_off || 0, "text-slate-600"], ["Checkout Missing", s.checkout_missing || 0, "text-orange-700"], ["Leave P/U", `${s.paid_leave}/${s.unpaid_leave}`, "text-violet-700"]];
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" data-testid={testId}>
      {cells.map(([l, v, c]) => <div key={l} className="rounded-xl border border-slate-200 bg-white p-3 text-center"><div className={`font-mono text-xl font-bold ${c}`} data-testid={`${testId}-${l.toLowerCase().replace(" ", "-")}`}>{v}</div><div className="text-[11px] font-semibold text-slate-500">{l}</div></div>)}
    </div>
  );
}
