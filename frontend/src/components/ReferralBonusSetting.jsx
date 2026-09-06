import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Gift, Loader2, Save } from "lucide-react";

const PRESETS = [0, 10, 20, 50];

export function ReferralBonusSetting() {
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings/public").then(({ data }) => { setAmount(String(data.referral_bonus)); setSaved(data.referral_bonus); }); }, []);

  const save = async (val) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", { referral_bonus: Number(val) });
      setAmount(String(data.referral_bonus)); setSaved(data.referral_bonus);
      toast.success(data.referral_bonus > 0 ? `Referral bonus set to ₹${data.referral_bonus}` : "Referral bonus turned OFF");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5" data-testid="referral-bonus-setting">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-400 p-2.5 text-slate-950"><Gift className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold text-slate-900">Refer & Earn Bonus</div>
            <div className="text-xs text-slate-600">Amount credited to a partner when someone they refer signs up on the website. Set ₹0 to turn it off.</div>
            <div className="mt-1 text-xs font-bold text-amber-800" data-testid="referral-bonus-current">Currently: {saved > 0 ? `₹${saved} per signup` : "OFF"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => save(p)} disabled={busy} data-testid={`referral-preset-${p}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${Number(saved) === p ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {p === 0 ? "OFF (₹0)" : `₹${p}`}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="referral-custom-amount"
              className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => save(amount)} disabled={busy} data-testid="referral-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
