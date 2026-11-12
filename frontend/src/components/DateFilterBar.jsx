import { Search, CalendarDays, RotateCcw } from "lucide-react";
import { Input } from "./ui/input";

const d2s = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
export const QUICK = {
  today: () => { const t = new Date(); return [d2s(t), d2s(t)]; },
  yesterday: () => { const t = new Date(); t.setDate(t.getDate() - 1); return [d2s(t), d2s(t)]; },
  last7: () => { const t = new Date(), f = new Date(); f.setDate(t.getDate() - 6); return [d2s(f), d2s(t)]; },
  thisMonth: () => { const t = new Date(); return [d2s(new Date(t.getFullYear(), t.getMonth(), 1)), d2s(t)]; },
  lastMonth: () => { const t = new Date(); return [d2s(new Date(t.getFullYear(), t.getMonth() - 1, 1)), d2s(new Date(t.getFullYear(), t.getMonth(), 0))]; },
};
const LABELS = { today: "Today", yesterday: "Yesterday", last7: "Last 7 Days", thisMonth: "This Month", lastMonth: "Last Month", custom: "Custom" };
export const EMPTY_FILTER = { quick: "", from: "", to: "", q: "" };

export function DateFilterBar({ f, setF, testId = "filter" }) {
  const pick = (k) => { if (k === "custom") return setF({ ...f, quick: "custom" }); const [from, to] = QUICK[k](); setF({ ...f, quick: k, from, to }); };
  const active = f.from || f.to || f.q;
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" data-testid={`${testId}-bar`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarDays className="mr-1 h-4 w-4 text-slate-400" />
        {Object.keys(LABELS).map((k) => <button key={k} type="button" onClick={() => pick(k)} data-testid={`${testId}-quick-${k}`} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${f.quick === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{LABELS[k]}</button>)}
        {active && <button type="button" onClick={() => setF(EMPTY_FILTER)} data-testid={`${testId}-reset`} className="ml-auto inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <label className="text-xs font-semibold text-slate-600">From<Input type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, quick: "custom", from: e.target.value })} className="mt-1" data-testid={`${testId}-from`} /></label>
        <label className="text-xs font-semibold text-slate-600">To<Input type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, quick: "custom", to: e.target.value })} className="mt-1" data-testid={`${testId}-to`} /></label>
        <label className="text-xs font-semibold text-slate-600">Search<span className="relative mt-1 block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Name, email or Request ID (WD-xxxxxxxx)" className="pl-9" data-testid={`${testId}-search`} /></span></label>
      </div>
    </div>
  );
}
