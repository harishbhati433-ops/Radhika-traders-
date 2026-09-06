import { useState } from "react";
import { ImageUpload } from "./ImageUpload";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Loader2, Check } from "lucide-react";

export function MarkPaidDialog({ w, onClose, onConfirm }) {
  const [proof, setProof] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onConfirm({ proof_url: proof, utr }); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="mark-paid-dialog">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-bold text-slate-900">Mark ₹{w.amount} as Paid</h3>
        <p className="mt-1 text-xs text-slate-500">To {w.user_name} · {w.method} · {w.details}. Upload the payment screenshot — it will be emailed to the customer and shown in their dashboard.</p>
        <div className="mt-4 space-y-4">
          <ImageUpload label="Payment screenshot (proof)" value={proof} onChange={setProof} testId="paid-proof-upload" />
          <div><Label>UTR / Transaction ID (optional)</Label><Input data-testid="paid-utr" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 4257XXXXXXXX" className="mt-1.5" /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="submit" data-testid="paid-confirm" disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm Paid
          </button>
        </div>
      </form>
    </div>
  );
}
