import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { Loader2, PauseCircle, Ban, Trash2, CheckCircle2, AlertTriangle, Flame } from "lucide-react";

export const ACCOUNT_TONE = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  deactivated: "bg-amber-50 text-amber-800 border-amber-200",
  disabled: "bg-rose-50 text-rose-700 border-rose-200",
  deleted: "bg-slate-100 text-slate-600 border-slate-200",
};

const ACTIONS = {
  active: { label: "Activate", icon: CheckCircle2, cls: "bg-emerald-600", desc: "Customer can log in and use everything again." },
  deactivated: { label: "Pause", icon: PauseCircle, cls: "bg-amber-500", desc: "Temporary pause — login blocked, data and wallet kept. You can activate again anytime." },
  disabled: { label: "Disable", icon: Ban, cls: "bg-rose-600", desc: "Blocked for policy violation — login blocked, shown a violation message. Reversible by admin." },
  deleted: { label: "Delete", icon: Trash2, cls: "bg-slate-800", desc: "Soft delete — hidden from lists, cannot log in, email/mobile stay blocked so they cannot re-register." },
  purge: { label: "Delete Permanently", icon: Flame, cls: "bg-black", desc: "IRREVERSIBLE — removes the account, wallet transactions and withdrawals completely. Their email/mobile can register again." },
};

export function AccountStatusControl({ customer, onChanged }) {
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const status = customer.account_status || "active";

  const apply = async () => {
    if (open !== "active" && !reason.trim()) return toast.error("Please write a reason");
    if (open === "purge" && !window.confirm(`Permanently delete ${customer.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/admin/customers/${customer.id}/status`, { status: open, reason });
      toast.success(data.message); setOpen(null); setReason(""); onChanged?.();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const btn = (key) => {
    const a = ACTIONS[key]; const I = a.icon;
    return (
      <button key={key} onClick={() => setOpen(key)} data-testid={`acct-${key}-${customer.id}`} title={a.desc}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white hover:brightness-110 ${a.cls}`}>
        <I className="h-3 w-3" /> {a.label}
      </button>
    );
  };
  const available = status === "active" ? ["deactivated", "disabled", "deleted"] : status === "deleted" ? ["active", "purge"] : ["active", "disabled", "deleted"];

  return (
    <>
      <div className="flex flex-wrap gap-1">{available.map(btn)}</div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent data-testid="acct-status-modal">
          {open && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> {ACTIONS[open].label} — {customer.name}</DialogTitle></DialogHeader>
              <p className="text-sm text-slate-600">{ACTIONS[open].desc}</p>
              <div className="text-xs text-slate-500">{customer.email} · {customer.mobile}</div>
              {open !== "active" && (
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} data-testid="acct-reason"
                  placeholder="Reason (required) — e.g. fake leads submitted, duplicate accounts, abusive behaviour…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              )}
              <button onClick={apply} disabled={busy} data-testid="acct-confirm" className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-60 ${ACTIONS[open].cls}`}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm {ACTIONS[open].label}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
