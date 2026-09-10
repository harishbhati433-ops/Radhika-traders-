import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

async function writeClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
  }
}

export function CopyValue({ value, label = "Value", testId, className = "" }) {
  const [ok, setOk] = useState(false);
  if (!value) return null;
  const copy = async (e) => {
    e.preventDefault(); e.stopPropagation();
    await writeClipboard(String(value));
    setOk(true); toast.success(`${label} copied`, { description: String(value), duration: 1800 });
    setTimeout(() => setOk(false), 1500);
  };
  return (
    <button type="button" onClick={copy} title={`Copy ${label}`} aria-label={`Copy ${label}`} data-testid={testId}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 ${ok ? "text-emerald-600" : ""} ${className}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function CopyField({ label, value, testId, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2" data-testid={testId}>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
        <div className={`break-all text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <CopyValue value={value} label={label} testId={testId ? `${testId}-copy` : undefined} />
    </div>
  );
}
