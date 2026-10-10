import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Collapsible section that remembers its open/closed state per `id` (localStorage), so users only expand what they want to see.
export function Collapsible({ id, title, subtitle, icon: Icon, badge, defaultOpen = false, children, className = "", testId }) {
  const key = `rt_collapse_${id}`;
  const [open, setOpen] = useState(() => { const v = localStorage.getItem(key); return v === null ? defaultOpen : v === "1"; });
  const toggle = () => { const v = !open; setOpen(v); localStorage.setItem(key, v ? "1" : "0"); };
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`} data-testid={testId || `collapsible-${id}`}>
      <button type="button" onClick={toggle} aria-expanded={open} data-testid={`${testId || `collapsible-${id}`}-toggle`}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50">
        {Icon && <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-400"><Icon className="h-4 w-4" /></span>}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-bold text-slate-900 sm:text-base">{title}</span>
          {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
        </span>
        {badge && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{badge}</span>}
        <span className="shrink-0 text-xs font-semibold text-slate-500">{open ? "Hide" : "Show"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-3 sm:p-4">{children}</div>}
    </div>
  );
}
