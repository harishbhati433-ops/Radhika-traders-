import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Loader2, Save, PauseCircle, PlayCircle } from "lucide-react";

export function WithdrawalToggleSetting() {
  const [enabled, setEnabled] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings/public").then(({ data }) => { setEnabled(data.withdrawals_enabled); setMsg(data.withdrawals_paused_message); }); }, []);

  const save = async (patch) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", patch);
      setEnabled(data.withdrawals_enabled); setMsg(data.withdrawals_paused_message);
      toast.success(data.withdrawals_enabled ? "Withdrawals are ON — customers can request payouts" : "Withdrawals PAUSED — no new requests allowed");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const on = enabled === true;
  return (
    <div className={`rounded-2xl border p-5 ${on ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/70"}`} data-testid="withdrawal-toggle-setting">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 text-white ${on ? "bg-emerald-500" : "bg-rose-500"}`}>{on ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}</div>
          <div>
            <div className="font-display font-bold text-slate-900">Withdrawal Requests</div>
            <div className="text-xs text-slate-600">Turn OFF to stop all customers from placing new withdrawal requests. Existing pending requests are not affected.</div>
            <div className={`mt-1 text-xs font-bold ${on ? "text-emerald-800" : "text-rose-800"}`} data-testid="withdrawal-toggle-current">Currently: {enabled === null ? "…" : on ? "ON — customers can withdraw" : "PAUSED — requests blocked"}</div>
          </div>
        </div>
        <button type="button" onClick={() => save({ withdrawals_enabled: !on })} disabled={busy || enabled === null} data-testid="withdrawal-toggle-btn"
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${on ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {on ? "Pause Withdrawals" : "Resume Withdrawals"}
        </button>
      </div>
      {!on && enabled !== null && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} data-testid="withdrawal-paused-message"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Message shown to customers while paused" />
          <button type="button" onClick={() => save({ withdrawals_paused_message: msg })} disabled={busy} data-testid="withdrawal-paused-message-save" className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
            <Save className="h-3.5 w-3.5" /> Save message
          </button>
        </div>
      )}
    </div>
  );
}
