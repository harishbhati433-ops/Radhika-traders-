import { useEffect, useState } from "react";
import api, { fileUrl } from "../../lib/api";
import { IndianRupee, Lock, Receipt } from "lucide-react";
import { inr } from "./shared";

export function MySalary() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/employee/salary").then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, []);
  if (items === null) return null;
  return (
    <div className="mt-8" data-testid="my-salary">
      <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-slate-900"><IndianRupee className="h-4 w-4 text-red-600" /> My Salary <span className="text-xs font-semibold text-slate-400">· only months finalized by admin</span></h3>
      {items.length === 0 && <div className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500" data-testid="my-salary-empty"><Lock className="h-4 w-4" /> No salary published yet. Your salary is finalized and shown here by the admin after the month ends.</div>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <div key={s.month} className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`my-salary-${s.month}`}>
            <div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">{new Date(`${s.month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div><div className="mt-1 font-mono text-2xl font-bold text-slate-900" data-testid={`my-salary-final-${s.month}`}>{inr(s.net_payable)}</div><div className="text-[11px] text-slate-500" data-testid={`my-salary-basis-${s.month}`}>{s.in_progress ? `Salary till ${new Date(s.as_of).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${s.paid_days} paid days` : "Final Salary"}</div></div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`} data-testid={`my-salary-pay-${s.month}`}>{s.payment_status === "paid" ? `✓ Paid ${s.payment_date}` : "Payment pending"}</span></div>
            {s.payment_status === "paid" && (s.utr || s.proof_url) && <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800" data-testid={`my-salary-proof-${s.month}`}>{s.utr && <span>UTR / Ref: <b className="font-mono">{s.utr}</b></span>}{s.proof_url && <a href={fileUrl(s.proof_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold underline"><Receipt className="h-3 w-3" /> View payment proof</a>}</div>}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              {s.in_progress ? (
                <><dt>Earned till date ({s.paid_days} days × {inr(s.per_day)})</dt><dd className="text-right font-mono" data-testid={`my-salary-earned-${s.month}`}>{inr(Math.round(s.paid_days * s.per_day * 100) / 100)}</dd></>
              ) : (
                <><dt>Base Salary</dt><dd className="text-right font-mono">{inr(s.monthly_salary)}</dd></>
              )}
              <dt>Sunday Extra ({s.sunday_worked} worked)</dt><dd className="text-right font-mono text-teal-700">+{inr(s.sunday_extra)}</dd>
              <dt>Bonus / Incentive</dt><dd className="text-right font-mono text-emerald-700">+{inr(s.bonus_incentive)}</dd>
              {!s.in_progress && <><dt>Attendance Deduction</dt><dd className="text-right font-mono text-rose-700">−{inr(s.attendance_deduction)}</dd></>}
              <dt>Adjustments (advance / deductions)</dt><dd className="text-right font-mono text-rose-700">−{inr(s.manual_adjustment)}</dd>
              {s.in_progress && <dt className="col-span-2 mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800" data-testid={`my-salary-progress-${s.month}`}>Month still running — this amount covers the days you were present till today. Full-month salary (base {inr(s.monthly_salary)} − attendance deduction {inr(s.attendance_deduction)}) will be finalized by the admin.</dt>}
              <dt className="col-span-2 mt-1 text-[11px] text-slate-400">Present {s.present + s.late} · Half {s.half_day} · Absent {s.absent} · Leave {s.paid_leave}/{s.unpaid_leave} · Weekly off {s.weekly_off}</dt>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
