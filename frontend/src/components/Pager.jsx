import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pager({ page, pages, total, limit, onChange, testId = "pager" }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1, to = Math.min(page * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600" data-testid={testId}>
      <span data-testid={`${testId}-info`}>Showing <b>{from}–{to}</b> of <b>{total}</b></span>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} data-testid={`${testId}-prev`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 font-mono font-semibold text-slate-800" data-testid={`${testId}-page`}>{page} / {pages}</span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} data-testid={`${testId}-next`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
