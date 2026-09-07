import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { ArrowDownToLine, Loader2, Save } from "lucide-react";

const PRESETS = [100, 200, 300, 400, 500];

export function MinWithdrawalSetting() {
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings/public").then(({ data }) => { setAmount(String(data.min_withdrawal)); setSaved(data.min_withdrawal); }); }, []);

  const save = async (val) => {
    const n = Number(val);
    if (!n || n < 1) return toast.error("Enter a valid amount (min ₹1)");
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", { min_withdrawal: n });
      setAmount(String(data.min_withdrawal)); setSaved(data.min_withdrawal);
      toast.success(`Minimum withdrawal set to ₹${data.min_withdrawal}`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5" data-testid="min-withdrawal-setting">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-500 p-2.5 text-white"><ArrowDownToLine className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold text-slate-900">Minimum Withdrawal</div>
            <div className="text-xs text-slate-600">Customers can only request a withdrawal of this amount or more. Applies instantly.</div>
            <div className="mt-1 text-xs font-bold text-sky-800" data-testid="min-withdrawal-current">Currently: ₹{saved ?? "…"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => save(p)} disabled={busy} data-testid={`min-withdrawal-preset-${p}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${Number(saved) === p ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              ₹{p}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="min-withdrawal-custom"
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" placeholder="Custom" />
            <button type="button" onClick={() => save(amount)} disabled={busy} data-testid="min-withdrawal-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
