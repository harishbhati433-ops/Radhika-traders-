import { useState } from "react";
import { Label } from "../ui/label";
import { X, FileText, Download } from "lucide-react";
import { thisMonth } from "./shared";
import { dl } from "./AttendanceTab";

const shift = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 - n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

export function StatementDialog({ row, onClose }) {
  const [to, setTo] = useState(thisMonth());
  const [from, setFrom] = useState(shift(thisMonth(), 2));
  const [busy, setBusy] = useState(false);
  const presets = [["3 months", 2], ["6 months", 5], ["12 months", 11]];
  const go = async (format) => { setBusy(true); await dl(`/admin/salary/statement/${row.employee_id}`, { from_month: from, to_month: to, format }); setBusy(false); };
  const cls = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="sal-stmt-dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Salary Statement · {row.employee_name}</h3><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div>
        <p className="mb-4 text-xs text-slate-500">One PDF with month-by-month salary and the period total — for 3, 6, 12 months or any custom range.</p>
        <div className="mb-3 flex flex-wrap gap-2">{presets.map(([l, n]) => <button key={l} type="button" onClick={() => { setTo(thisMonth()); setFrom(shift(thisMonth(), n)); }} data-testid={`sal-stmt-preset-${n + 1}`} className={`rounded-full border px-3 py-1 text-xs font-bold ${from === shift(thisMonth(), n) && to === thisMonth() ? "border-red-600 bg-red-600 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Last {l}</button>)}</div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>From month</Label><input type="month" value={from} max={to} onChange={(e) => setFrom(e.target.value)} data-testid="sal-stmt-from" className={cls} /></div>
          <div><Label>To month</Label><input type="month" value={to} min={from} max={thisMonth()} onChange={(e) => setTo(e.target.value)} data-testid="sal-stmt-to" className={cls} /></div>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => go("pdf")} disabled={busy} data-testid="sal-stmt-pdf" className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FileText className="h-4 w-4" /> Download PDF</button>
          <button type="button" onClick={() => go("xlsx")} disabled={busy} data-testid="sal-stmt-xlsx" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-60"><Download className="h-4 w-4" /> Excel</button>
        </div>
      </div>
    </div>
  );
}
