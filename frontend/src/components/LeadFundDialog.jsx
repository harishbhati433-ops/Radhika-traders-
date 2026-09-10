import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Wallet, Loader2, AlertTriangle } from "lucide-react";

export function LeadFundDialog({ lead, defaultAmount, open, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setAmount(defaultAmount ? String(defaultAmount) : ""); setNote(""); setConfirm(false); } }, [open, defaultAmount]);

  const amt = parseFloat(amount);
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/leads/${lead.id}/fund`, { amount: amt, note });
      toast.success(data.message); onDone?.(data); onClose();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="lead-fund-modal" className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" /> Add Fund — Lead {lead?.lead_id}</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-500">Credits the wallet of the referring publisher</div>
          <div className="mt-0.5 font-semibold text-slate-900" data-testid="lead-fund-partner">{lead?.partner_name || "—"} <span className="font-mono text-xs text-slate-400">{lead?.ref_code}</span></div>
          <div className="text-xs text-slate-500">{lead?.campaign_name} · Customer: {lead?.customer_name || "—"}</div>
        </div>
        {!confirm ? (
          <div className="space-y-3">
            <div><Label>Amount (₹)</Label><Input data-testid="lead-fund-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" autoFocus /></div>
            <div><Label>Note (optional)</Label><Input data-testid="lead-fund-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="e.g. Account opened payout" /></div>
            <button type="button" onClick={() => (amt > 0 ? setConfirm(true) : toast.error("Enter a valid amount"))} data-testid="lead-fund-next"
              className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Continue</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="lead-fund-confirm-box">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>Add <b className="font-mono">₹{amt}</b> to <b>{lead?.partner_name}</b>'s wallet for lead <b className="font-mono">{lead?.lead_id}</b>? This is separate from lead approval and cannot be undone automatically.</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-700">Back</button>
              <button type="button" onClick={submit} disabled={busy} data-testid="lead-fund-confirm" className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Yes, add ₹{amt}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
