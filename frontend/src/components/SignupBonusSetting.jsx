import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Loader2, Save, Power, History, Users } from "lucide-react";

const PRESETS = [10, 20, 50, 100, 200];
const dt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function SignupBonusSetting() {
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(null);
  const [showLog, setShowLog] = useState(false);

  const loadLog = () => api.get("/admin/signup-bonus/log").then(({ data }) => { setLog(data); setEnabled(data.enabled); setSaved(data.amount); setAmount(String(data.amount)); }).catch(() => {});
  useEffect(() => { loadLog(); }, []);

  const save = async (body, msg) => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/settings", body);
      setAmount(String(data.signup_bonus)); setSaved(data.signup_bonus); setEnabled(data.signup_bonus_enabled);
      toast.success(msg || `Signup bonus set to ₹${data.signup_bonus}`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const backfill = async () => {
    if (!window.confirm(`Give ₹${saved} Signup Bonus to ALL existing verified customers who never received it?\n\n• Customers without an approved lead → ₹${saved} LOCKED in their Bonus Wallet (not withdrawable)\n• Customers who already have an approved lead → ₹${saved} CREDITED to Main Wallet\n• Duplicate accounts are skipped. Runs only once per customer.`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/signup-bonus/backfill");
      toast.success(`Done — Locked: ${data.locked} · Credited: ${data.credited} · Duplicate skipped: ${data.duplicate} · Already had: ${data.already_had}`, { duration: 9000 });
      loadLog();
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
            <div className="text-xs text-slate-600">Every new customer (with or without referral link) sees this amount LOCKED in their Bonus Wallet right after signup. It moves to the Main Wallet automatically when their first lead is approved. Only once per person — duplicate accounts (same mobile / email / PAN) are not eligible.</div>
            <div className="mt-1 text-xs font-bold text-violet-800" data-testid="signup-bonus-current">Currently: {enabled && saved > 0 ? `ON · ₹${saved} per new customer` : "OFF"}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => save({ signup_bonus_enabled: !enabled }, !enabled ? "Signup bonus turned ON" : "Signup bonus turned OFF")} disabled={busy} data-testid="signup-bonus-toggle"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white ${enabled ? "bg-emerald-600" : "bg-slate-500"}`}>
            <Power className="h-3.5 w-3.5" /> {enabled ? "ON" : "OFF"}
          </button>
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => save({ signup_bonus: p })} disabled={busy} data-testid={`signup-bonus-preset-${p}`}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${Number(saved) === p ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>₹{p}</button>
          ))}
          <div className="flex items-center gap-1">
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="signup-bonus-custom" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => save({ signup_bonus: Number(amount) })} disabled={busy} data-testid="signup-bonus-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          </div>
          <button type="button" onClick={() => { setShowLog(!showLog); loadLog(); }} data-testid="signup-bonus-log-toggle" className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-700">
            <History className="h-3.5 w-3.5" /> Bonus records {log ? `(${log.items.length})` : ""}
          </button>
          <button type="button" onClick={backfill} disabled={busy || !enabled || !(saved > 0)} data-testid="signup-bonus-backfill" title="Give the bonus to every existing customer who never got it" className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
            <Users className="h-3.5 w-3.5" /> Give to existing customers
          </button>
        </div>
      </div>
      {showLog && log && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-violet-200 bg-white" data-testid="signup-bonus-log">
          <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 px-3 py-2 text-xs text-slate-600"><span>Total credited: <b className="font-mono text-emerald-700">₹{log.credited_total}</b></span><span>{log.items.filter((i) => i.status === "credited").length} credited · {log.items.filter((i) => i.status !== "credited").length} not eligible</span></div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">User</th><th className="p-2">User ID</th><th className="p-2 text-right">Bonus</th><th className="p-2">Date & Time</th><th className="p-2">Lead approval</th><th className="p-2">Wallet credit</th><th className="p-2">Note</th></tr></thead>
            <tbody>
              {log.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No signup bonus records yet.</td></tr>}
              {log.items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100" data-testid={`sb-log-${i.id}`}>
                  <td className="p-2"><div className="font-semibold text-slate-900">{i.user_name}</div><div className="text-slate-500">{i.mobile}{i.referred ? " · via referral" : " · direct signup"}</div></td>
                  <td className="p-2 font-mono text-slate-600">{i.customer_id}</td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900">₹{i.amount}</td>
                  <td className="whitespace-nowrap p-2 font-mono text-slate-600">{dt(i.created_at)}</td>
                  <td className="p-2"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Approved · {i.lead_id}</span></td>
                  <td className="p-2">{i.status === "credited" ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Credited · {i.ref_id}</span> : <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Not credited</span>}</td>
                  <td className="p-2 text-slate-500">{i.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
