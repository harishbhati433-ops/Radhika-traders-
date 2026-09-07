import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Users, Loader2, Save } from "lucide-react";

const DAILY = [0, 1, 2, 3, 5];
const MONTHLY = [0, 10, 20, 30, 50, 100];

function LimitRow({ label, presets, value, saved, onChange, onSave, busy, testId }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 text-xs font-bold text-slate-700">{label}</span>
      {presets.map((p) => (
        <button key={p} type="button" onClick={() => onSave(p)} disabled={busy} data-testid={`${testId}-preset-${p}`}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${Number(saved) === p ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
          {p === 0 ? "Unlimited" : p}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} data-testid={`${testId}-custom`} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button type="button" onClick={() => onSave(value)} disabled={busy} data-testid={`${testId}-save`} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
      </div>
    </div>
  );
}

export function ReferralLimitSetting() {
  const [s, setS] = useState(null);
  const [daily, setDaily] = useState("");
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = (d) => { setS(d); setDaily(String(d.referral_daily_limit)); setMonthly(String(d.referral_monthly_limit)); };
  useEffect(() => { api.get("/settings/public").then(({ data }) => apply(data)); }, []);

  const save = async (patch) => {
    setBusy(true);
    try { const { data } = await api.put("/admin/settings", patch); apply(data); toast.success("Referral limits updated"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const fmt = (n) => (Number(n) === 0 ? "Unlimited" : n);

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5" data-testid="referral-limit-setting">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-500 p-2.5 text-white"><Users className="h-5 w-5" /></div>
        <div>
          <div className="font-display font-bold text-slate-900">Referral Limits (per customer)</div>
          <div className="text-xs text-slate-600">How many people one customer can refer (verified signups via their link). Extra signups via that link are blocked until the window resets. 0 = unlimited.</div>
          <div className="mt-1 text-xs font-bold text-teal-800" data-testid="referral-limit-current">Currently: {s ? `${fmt(s.referral_daily_limit)} per day · ${fmt(s.referral_monthly_limit)} per month` : "…"}</div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <LimitRow label="Per day" presets={DAILY} value={daily} saved={s?.referral_daily_limit} onChange={setDaily} busy={busy} testId="referral-daily"
          onSave={(v) => save({ referral_daily_limit: Number(v) })} />
        <LimitRow label="Per month" presets={MONTHLY} value={monthly} saved={s?.referral_monthly_limit} onChange={setMonthly} busy={busy} testId="referral-monthly"
          onSave={(v) => save({ referral_monthly_limit: Number(v) })} />
      </div>
    </div>
  );
}
