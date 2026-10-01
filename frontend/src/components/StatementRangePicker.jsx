import { useState } from "react";
import { CalendarRange } from "lucide-react";

export const PRESETS = [["today", "Today"], ["yesterday", "Yesterday"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["3m", "3 Months"], ["6m", "6 Months"], ["1y", "1 Year"], ["all", "All Time"], ["custom", "Custom"]];
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function useStatementRange() {
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayIST());
  const params = preset === "custom" ? { preset, date_from: from, date_to: to } : { preset };
  const valid = preset !== "custom" || (from && to);
  return { preset, setPreset, from, setFrom, to, setTo, params, valid };
}

export function StatementRangePicker({ r, compact = false, testId = "stmt-range" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white ${compact ? "p-3" : "p-4"}`} data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><CalendarRange className="h-3.5 w-3.5 text-red-600" /> Statement period</div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(([k, l]) => <button key={k} type="button" onClick={() => r.setPreset(k)} data-testid={`${testId}-${k}`} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${r.preset === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{l}</button>)}
      </div>
      {r.preset === "custom" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 font-semibold text-slate-600">From <input type="date" value={r.from} max={r.to || todayIST()} onChange={(e) => r.setFrom(e.target.value)} data-testid={`${testId}-from`} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal" /></label>
          <label className="flex items-center gap-1.5 font-semibold text-slate-600">To <input type="date" value={r.to} min={r.from} max={todayIST()} onChange={(e) => r.setTo(e.target.value)} data-testid={`${testId}-to`} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-normal" /></label>
          {!r.valid && <span className="text-rose-600" data-testid={`${testId}-hint`}>Select both dates</span>}
        </div>
      )}
    </div>
  );
}
