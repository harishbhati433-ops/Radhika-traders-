import { toast } from "sonner";
import { Copy, Smartphone, Landmark, Phone } from "lucide-react";

function Row({ label, value, testId }) {
  if (!value) return null;
  const copy = () => { navigator.clipboard.writeText(value); toast.success(`${label} copied`); };
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-sm font-bold text-slate-900" data-testid={testId}>{value}</span>
        <button type="button" onClick={copy} className="rounded-md bg-slate-100 p-1 text-slate-600 hover:bg-slate-900 hover:text-white" aria-label={`Copy ${label}`}>
          <Copy className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

export function PayoutDetails({ w }) {
  const p = w.payout_info || {};
  const isUpi = w.method === "UPI";
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3" data-testid={`wd-payout-${w.id}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-800">
        {isUpi ? <Smartphone className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />} Pay to · {w.method}
      </div>
      {isUpi ? (
        <Row label="UPI ID" value={w.details || p.upi} testId={`wd-upi-${w.id}`} />
      ) : (
        <>
          <Row label="Holder" value={p.account_holder} />
          <Row label="A/C No" value={w.details || p.bank_account} testId={`wd-acc-${w.id}`} />
          <Row label="IFSC" value={p.ifsc} />
        </>
      )}
      {isUpi && p.bank_account && <Row label="Alt A/C" value={`${p.bank_account} · ${p.ifsc}`} />}
      {!isUpi && p.upi && <Row label="Alt UPI" value={p.upi} />}
      {w.user_mobile && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
          <Phone className="h-3 w-3" /> <a href={`tel:+91${w.user_mobile}`} className="font-semibold hover:text-red-600">{w.user_mobile}</a>
          {p.pan && <span className="ml-auto font-mono text-[11px]">PAN {p.pan}</span>}
        </div>
      )}
    </div>
  );
}
