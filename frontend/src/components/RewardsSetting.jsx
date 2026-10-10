import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Gift, Percent, Loader2, Save, Power, Users, Ticket, AlertTriangle } from "lucide-react";

const dt = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const STATUS = { issued: "bg-amber-100 text-amber-800", scratched: "bg-emerald-100 text-emerald-800", cancelled: "bg-slate-200 text-slate-600", reversed: "bg-rose-100 text-rose-700" };

export function RewardsSetting() {
  const [d, setD] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("users");

  const load = () => api.get("/admin/rewards").then(({ data }) => { setD(data); setF(data.settings); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (body, msg) => {
    setBusy(true);
    try { const { data } = await api.put("/admin/rewards/settings", body); setF(data); toast.success(msg || "Reward settings saved"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const waive = async (a) => {
    if (!window.confirm(`Waive ₹${a.remaining} pending adjustment for ${a.user_name}? It will NOT be recovered from future credits.`)) return;
    try { await api.post(`/admin/rewards/adjustments/${a.id}/settle`); toast.success("Adjustment waived"); load(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  if (!d) return null;
  const s = f;
  const open = d.adjustments.filter((a) => a.status === "open");
  const num = (k) => ({ type: "number", min: "0", value: s[k] ?? "", onChange: (e) => setF({ ...f, [k]: e.target.value }), className: "w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" });
  const tabs = [["users", `Users (${d.users.length})`], ["cards", `Scratch Cards (${d.cards.length})`], ["extra", `Bonus txns (${d.extra_txns.length})`], ["adj", `Adjustments (${open.length} open)`]];

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5" data-testid="rewards-setting">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-500 p-2.5 text-white"><Gift className="h-5 w-5" /></div>
        <div>
          <div className="font-display font-bold text-slate-900">Scratch Card & Extra Bonus (Signup Bonus release)</div>
          <div className="text-xs text-slate-600">Signup Bonus stays LOCKED. On every approved lead (while locked balance &gt; ₹0) the customer gets a Scratch Card that moves money from Locked → Main Wallet, plus an extra % of the campaign payout. Both stop automatically at ₹0. Rejecting an approved lead cancels/reverses its rewards.</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Percent className="h-4 w-4 text-amber-600" /> Extra bonus per approved lead</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <input data-testid="rw-extra-pct" {...num("extra_bonus_percent")} step="0.5" /> <span className="text-slate-600">% of campaign payout → Main Wallet (0 = off)</span>
            <button type="button" disabled={busy} onClick={() => save({ extra_bonus_percent: Number(s.extra_bonus_percent) })} data-testid="rw-extra-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" /> Save</button>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Ticket className="h-4 w-4 text-amber-600" /> Scratch Card</div>
            <button type="button" disabled={busy} onClick={() => save({ scratch_enabled: !s.scratch_enabled }, s.scratch_enabled ? "Scratch Cards disabled" : "Scratch Cards enabled")} data-testid="rw-scratch-toggle"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white ${s.scratch_enabled ? "bg-emerald-600" : "bg-slate-500"}`}><Power className="h-3.5 w-3.5" /> {s.scratch_enabled ? "ON" : "OFF"}</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <select data-testid="rw-scratch-mode" value={s.scratch_mode} onChange={(e) => setF({ ...f, scratch_mode: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"><option value="fixed">Fixed amount</option><option value="range">Random range</option></select>
            {s.scratch_mode === "range" ? <>₹<input data-testid="rw-scratch-min" {...num("scratch_min")} /> to ₹<input data-testid="rw-scratch-max" {...num("scratch_max")} /></> : <>₹<input data-testid="rw-scratch-amount" {...num("scratch_amount")} /> per card</>}
            <button type="button" disabled={busy} onClick={() => save({ scratch_mode: s.scratch_mode, scratch_amount: Number(s.scratch_amount), scratch_min: Number(s.scratch_min), scratch_max: Number(s.scratch_max) })} data-testid="rw-scratch-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-bold text-white">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</button>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Card amount never exceeds the customer's remaining locked balance.</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1">{tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} data-testid={`rw-tab-${k}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === k ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>{l}</button>)}</div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200 bg-white rt-scroll" data-testid={`rw-table-${tab}`}>
        <table className="w-full text-left text-xs">
          {tab === "users" && <>
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2"><Users className="inline h-3 w-3" /> Customer</th><th className="p-2 text-right">Signup Bonus</th><th className="p-2 text-right">Released</th><th className="p-2 text-right">Locked left</th><th className="p-2 text-right">Extra bonus</th><th className="p-2">Cards</th><th className="p-2 text-right">Main Wallet</th><th className="p-2">Status</th></tr></thead>
            <tbody>{d.users.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No customers with a Signup Bonus yet.</td></tr>}
              {d.users.map((u) => <tr key={u.user_id} className="border-t border-slate-100" data-testid={`rw-user-${u.user_id}`}><td className="p-2"><div className="font-semibold text-slate-900">{u.name}</div><div className="font-mono text-slate-500">{u.customer_id} · {u.mobile}</div></td><td className="p-2 text-right font-mono">₹{u.total}</td><td className="p-2 text-right font-mono text-emerald-700">₹{u.released}</td><td className="p-2 text-right font-mono font-bold text-violet-700">₹{u.remaining}</td><td className="p-2 text-right font-mono">₹{u.extra_bonus_total}</td><td className="p-2">{u.cards_scratched} scratched · {u.cards_pending} pending</td><td className="p-2 text-right font-mono">₹{u.main_balance}</td><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.status === "active" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>{u.status === "active" ? "Bonus active" : "Fully released"}</span></td></tr>)}
            </tbody></>}
          {tab === "cards" && <>
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Customer</th><th className="p-2">Lead</th><th className="p-2">Campaign</th><th className="p-2 text-right">Reward</th><th className="p-2">Status</th><th className="p-2">Issued</th><th className="p-2">Scratched</th><th className="p-2">Ref</th></tr></thead>
            <tbody>{d.cards.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No scratch cards issued yet.</td></tr>}
              {d.cards.map((c) => <tr key={c.id} className="border-t border-slate-100" data-testid={`rw-card-${c.id}`}><td className="p-2"><div className="font-semibold">{c.user_name}</div><div className="font-mono text-slate-500">{c.customer_id}</div></td><td className="p-2 font-mono">{c.lead_ref}</td><td className="p-2">{c.campaign_name}</td><td className="p-2 text-right font-mono font-bold">₹{c.amount}</td><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[c.status]}`}>{c.status}</span></td><td className="whitespace-nowrap p-2 text-slate-500">{dt(c.created_at)}</td><td className="whitespace-nowrap p-2 text-slate-500">{dt(c.scratched_at)}</td><td className="p-2 font-mono text-slate-500">{c.ref_id || "—"}</td></tr>)}
            </tbody></>}
          {tab === "extra" && <>
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Customer</th><th className="p-2">Lead</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th className="p-2">Date</th><th className="p-2">Ref</th></tr></thead>
            <tbody>{d.extra_txns.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No extra bonus / reversal transactions yet.</td></tr>}
              {d.extra_txns.map((t) => <tr key={t.id} className="border-t border-slate-100"><td className="p-2 font-semibold">{t.user_name}</td><td className="p-2 font-mono">{t.lead_ref}</td><td className="p-2">{t.description}</td><td className={`p-2 text-right font-mono font-bold ${t.type === "credit" ? "text-emerald-700" : "text-rose-700"}`}>{t.type === "credit" ? "+" : "−"}₹{t.amount}</td><td className="whitespace-nowrap p-2 text-slate-500">{dt(t.created_at)}</td><td className="p-2 font-mono text-slate-500">{t.ref_id}</td></tr>)}
            </tbody></>}
          {tab === "adj" && <>
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2"><AlertTriangle className="inline h-3 w-3" /> Customer</th><th className="p-2">Lead</th><th className="p-2">Reason</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Remaining</th><th className="p-2">Status</th><th className="p-2">Date</th><th className="p-2">Action</th></tr></thead>
            <tbody>{d.adjustments.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No pending adjustments — every reversal was recovered from the wallet directly.</td></tr>}
              {d.adjustments.map((a) => <tr key={a.id} className="border-t border-slate-100" data-testid={`rw-adj-${a.id}`}><td className="p-2 font-semibold">{a.user_name}</td><td className="p-2 font-mono">{a.lead_ref}</td><td className="p-2">{a.description}</td><td className="p-2 text-right font-mono">₹{a.amount}</td><td className="p-2 text-right font-mono font-bold text-rose-700">₹{a.remaining}</td><td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.status === "open" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-600"}`}>{a.status}</span></td><td className="whitespace-nowrap p-2 text-slate-500">{dt(a.created_at)}</td><td className="p-2">{a.status === "open" && <button type="button" onClick={() => waive(a)} data-testid={`rw-adj-waive-${a.id}`} className="rounded-full border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700">Waive</button>}</td></tr>)}
            </tbody></>}
        </table>
      </div>
    </div>
  );
}
