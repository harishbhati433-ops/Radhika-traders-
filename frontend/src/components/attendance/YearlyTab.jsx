import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Minus, IndianRupee, CheckCircle, Hourglass } from "lucide-react";
import { inr } from "./shared";
import { ExportButtons } from "./AttendanceTab";

const thisYear = () => Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 4));

function Delta({ cur, prev }) {
  if (!cur || !prev) return null;
  const diff = cur.total - prev.total;
  const pct = prev.total ? Math.round((diff / prev.total) * 100) : null;
  const I = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const c = diff > 0 ? "text-rose-700" : diff < 0 ? "text-emerald-700" : "text-slate-500";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4" data-testid="yr-compare">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">This month vs last month</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>{prev.label}: <b className="font-mono">{inr(prev.total)}</b></span>
        <span>{cur.label} (so far): <b className="font-mono">{inr(cur.total)}</b></span>
        <span className={`inline-flex items-center gap-1 font-bold ${c}`}><I className="h-4 w-4" /> {diff >= 0 ? "+" : "−"}{inr(Math.abs(diff))}{pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}</span>
      </div>
    </div>
  );
}

export function YearlyTab() {
  const [year, setYear] = useState(thisYear());
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/salary/yearly", { params: { year } }).then(({ data }) => setD(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail))); }, [year]);
  if (!d) return <div className="p-8 text-center text-slate-400">Loading…</div>;
  const years = Array.from({ length: 4 }, (_, i) => thisYear() - i);
  const kpis = [[IndianRupee, `Total ${year}`, d.totals.total, "text-slate-800"], [CheckCircle, "Paid", d.totals.paid, "text-emerald-700"], [Hourglass, "Pending", d.totals.pending, "text-amber-700"]];
  return (
    <div data-testid="yearly-tab">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3"><select value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="yr-year" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select><span className="text-xs text-slate-500">Month-by-month salary for the whole year · current month updates live every day</span></div>
        <ExportButtons path="/admin/salary/yearly/export" params={{ year }} testId="yr-export" />
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {kpis.map(([I, l, v, c]) => <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4"><I className={`h-4 w-4 ${c}`} /><div className={`mt-1 font-mono text-xl font-bold ${c}`} data-testid={`yr-kpi-${l.toLowerCase().split(" ")[0]}`}>{inr(v)}</div><div className="text-[11px] font-semibold text-slate-500">{l}</div></div>)}
      </div>
      <div className="mb-4"><Delta cur={d.current} prev={d.previous} /></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Month</th>{d.employees.map((e) => <th key={e.id} className="p-3 whitespace-nowrap">{e.name}<div className="font-mono text-[9px] normal-case text-slate-400">{e.employee_code}</div></th>)}<th className="p-3">Total</th><th className="p-3">Paid</th><th className="p-3">Pending</th><th className="p-3">Paid Days</th></tr></thead>
          <tbody>
            {d.months.map((m) => {
              const by = Object.fromEntries(m.employees.map((e) => [e.employee_id, e]));
              return (
                <tr key={m.month} className={`border-t border-slate-100 ${m.is_current ? "bg-amber-50/60" : ""}`} data-testid={`yr-row-${m.month}`}>
                  <td className="p-3 font-semibold text-slate-900">{m.label}{m.is_current && <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">LIVE</span>}</td>
                  {d.employees.map((e) => { const r = by[e.id]; return <td key={e.id} className="p-3 font-mono whitespace-nowrap">{r ? <>{inr(r.net_payable)} <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${r.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.payment_status === "paid" ? "Paid" : "Pending"}</span></> : "—"}</td>; })}
                  <td className="p-3 font-mono font-bold text-slate-900" data-testid={`yr-total-${m.month}`}>{inr(m.total)}</td><td className="p-3 font-mono text-emerald-700">{inr(m.paid)}</td><td className="p-3 font-mono text-amber-700">{inr(m.pending)}</td><td className="p-3 font-mono">{m.paid_days}</td>
                </tr>
              );
            })}
            {d.months.length === 0 && <tr><td colSpan={5 + d.employees.length} className="p-8 text-center text-slate-400">No months yet for {year}.</td></tr>}
          </tbody>
          {d.months.length > 0 && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold"><tr><td className="p-3">Total {year}</td>{d.employees.map((e) => <td key={e.id} className="p-3 font-mono">{inr(d.months.reduce((s, m) => s + (m.employees.find((x) => x.employee_id === e.id)?.net_payable || 0), 0))}</td>)}<td className="p-3 font-mono" data-testid="yr-grand-total">{inr(d.totals.total)}</td><td className="p-3 font-mono text-emerald-700">{inr(d.totals.paid)}</td><td className="p-3 font-mono text-amber-700">{inr(d.totals.pending)}</td><td className="p-3 font-mono">{d.months.reduce((s, m) => s + m.paid_days, 0).toFixed(1)}</td></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
