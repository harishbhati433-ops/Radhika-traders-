import { useEffect } from "react";
import { Delete } from "lucide-react";

// 4-dot PIN entry with an on-screen keypad; also accepts keyboard digits.
export function PinPad({ value, onChange, onComplete, disabled, testId = "pin" }) {
  useEffect(() => {
    const onKey = (e) => {
      if (disabled) return;
      if (/^\d$/.test(e.key) && value.length < 4) { const v = value + e.key; onChange(v); if (v.length === 4) onComplete?.(v); }
      else if (e.key === "Backspace") onChange(value.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, disabled, onChange, onComplete]);
  const press = (d) => { if (disabled || value.length >= 4) return; const v = value + d; onChange(v); if (v.length === 4) onComplete?.(v); };
  return (
    <div className="mx-auto w-full max-w-[280px]" data-testid={`${testId}-pad`}>
      <div className="mb-6 flex justify-center gap-4" data-testid={`${testId}-dots`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${i < value.length ? "scale-110 border-red-500 bg-red-500" : "border-slate-400/60 bg-transparent"}`} />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) => k === "" ? <span key={i} /> : (
          <button key={k} type="button" disabled={disabled} onClick={() => (k === "del" ? onChange(value.slice(0, -1)) : press(k))} data-testid={`${testId}-key-${k}`}
            className="flex h-14 items-center justify-center rounded-2xl bg-white/10 font-mono text-xl font-bold text-white transition-transform active:scale-95 hover:bg-white/20 disabled:opacity-40">
            {k === "del" ? <Delete className="h-5 w-5" /> : k}
          </button>
        ))}
      </div>
    </div>
  );
}
