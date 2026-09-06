export function Logo({ light = false, size = "md" }) {
  const dim = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const title = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-logo">
      <img src="/images/logo-mark.jpeg" alt="Radhika Traders logo" className={`${dim} shrink-0 rounded-xl object-cover shadow-md ring-1 ring-amber-500/40`} />
      <div className="leading-none">
        <div className={`font-display font-extrabold ${title} ${light ? "text-white" : "text-slate-900"}`} style={{ letterSpacing: "-0.5px" }}>
          RADHIKA <span className="text-red-600">TRADERS</span>
        </div>
        <div className={`text-[9px] font-semibold uppercase tracking-[0.2em] ${light ? "text-amber-300" : "text-amber-600"}`}>
          Trusted Partner for Financial Growth
        </div>
      </div>
    </div>
  );
}
