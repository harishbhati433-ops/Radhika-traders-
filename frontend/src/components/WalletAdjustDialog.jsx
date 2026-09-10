import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { SlidersHorizontal, Loader2, AlertTriangle } from "lucide-react";

const MODES = [["add", "Add", "bg-emerald-600"], ["deduct", "Deduct", "bg-rose-600"], ["zero", "Set to ₹0", "bg-slate-800"]];

export function WalletAdjustDialog({ customer, open, onClose, onDone }) {
  const [mode, setMode] = useState("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setMode("add"); setAmount(""); setReason(""); setConfirm(false); } }, [open]);

  const balance = Number(customer?.wallet?.balance ?? 0);
  const amt = mode === "zero" ? balance : parseFloat(amount) || 0;
  const after = mode === "add" ? balance + amt : mode === "deduct" ? balance - amt : 0;
  const color = MODES.find((m) => m[0] === mode)[2];

  const next = () => {
    if (!reason.trim()) return toast.error("Reason is required");
    if (mode !== "zero" && amt <= 0) return toast.error("Enter a valid amount");
    if (mode === "deduct" && amt > balance) return toast.error(`Available balance is only ₹${balance}`);
    if (mode === "zero" && balance <= 0) return toast.error("Balance is already ₹0");
    setConfirm(true);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/wallet/adjust", { user_id: customer.id, mode, amount: amt, reason });
      toast.success(data.message); onDone?.(data); onClose();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="wallet-adjust-modal" className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-red-600" /> Adjust Wallet — {customer?.name}</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-slate-50 p-3 text-sm">Current balance: <b className="font-mono text-emerald-700" data-testid="wallet-adjust-balance">₹{balance}</b></div>
        {!confirm ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {MODES.map(([k, l, cls]) => <button key={k} type="button" onClick={() => setMode(k)} data-testid={`wallet-adjust-mode-${k}`} className={`rounded-full py-2 text-xs font-bold ${mode === k ? `${cls} text-white` : "border border-slate-200 text-slate-700"}`}>{l}</button>)}
            </div>
            {mode !== "zero" && <div><Label>Amount (₹)</Label><Input data-testid="wallet-adjust-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5" /></div>}
            <div><Label>Reason (required — shown to customer)</Label><Input data-testid="wallet-adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" placeholder="e.g. Extra credit reversed" /></div>
            <button type="button" onClick={next} data-testid="wallet-adjust-next" className={`w-full rounded-full py-2.5 text-sm font-bold text-white ${color}`}>Continue</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-testid="wallet-adjust-confirm-box">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{mode === "add" ? "Add" : mode === "deduct" ? "Deduct" : "Reset wallet to ₹0 by deducting"} <b className="font-mono">₹{amt}</b>. Balance <b className="font-mono">₹{balance}</b> → <b className="font-mono">₹{after.toFixed(2).replace(/\.00$/, "")}</b>.<div className="mt-1 text-xs">Reason: {reason}</div></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-bold text-slate-700">Back</button>
              <button type="button" onClick={submit} disabled={busy} data-testid="wallet-adjust-confirm" className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-60 ${color}`}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
