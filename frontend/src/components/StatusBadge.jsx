export function StatusBadge({ status }) {
  const map = {
    live: { label: "LIVE", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500 rt-live-dot" },
    paused: { label: "PAUSED", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
    closed: { label: "CLOSED", cls: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  };
  const s = map[status] || map.live;
  return (
    <span data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
