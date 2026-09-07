import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Save } from "lucide-react";

const PRESETS = [0, 10, 20, 50, 100, 200];

export function SignupBonusSetting() {
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/settings/public").then(({ data }) => { setAmount(String(data.signup_bonus)); setSaved(data.signup_bonus); }); }, []);

  const save = async (val) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", { signup_bonus: Number(val) });
      setAmount(String(data.signup_bonus)); setSaved(data.signup_bonus);
      toast.success(data.signup_bonus > 0 ? `Signup bonus set to ₹${data.signup_bonus}` : "Signup bonus turned OFF");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5" data-testid="signup-bonus-setting">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500 p-2.5 text-white"><Sparkles className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold text-slate-900">New Customer Signup Bonus</div>
            <div className="text-xs text-slate-600">Given to a new customer who signs up via a referral link. Stays in their Bonus Wallet (locked) and moves to main wallet after their first approved lead. Set ₹0 to turn off.</div>
            <div className="mt-1 text-xs font-bold text-violet-800" data-testid="signup-bonus-current">Currently: {saved > 0 ? `₹${saved} per signup` : "OFF"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => save(p)} disabled={busy} data-testid={`signup-bonus-preset-${p}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${Number(saved) === p ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {p === 0 ? "OFF (₹0)" : `₹${p}`}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="signup-bonus-custom"
              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => save(amount)} disabled={busy} data-testid="signup-bonus-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
