export function Logo({ light = false, size = "md" }) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const title = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex ${dim} items-center justify-center rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 shadow-md`}>
        <span className="font-display font-black text-white" style={{ letterSpacing: "-1px" }}>RT</span>
      </div>
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
