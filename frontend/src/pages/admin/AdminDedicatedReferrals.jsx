import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { CopyValue } from "../../components/CopyValue";
import { toast } from "sonner";
import { Search, RotateCcw, Loader2, UserPlus, Power, Pencil, History, X, Gift } from "lucide-react";

const QUICK = [5, 10, 15, 20];
const fmt = (iso) => (iso || "").slice(0, 16).replace("T", " ");

function PayoutPicker({ value, onChange, testId }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK.map((v) => <button key={v} type="button" onClick={() => onChange(String(v))} data-testid={`${testId}-quick-${v}`} className={`rounded-full px-2.5 py-1 text-xs font-bold ${String(value) === String(v) ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>₹{v}</button>)}
      <div className="flex items-center rounded-full border border-slate-200 bg-white px-2"><span className="text-xs text-slate-500">₹</span><input data-testid={testId} type="number" min="0" step="0.5" value={value} onChange={(e) => onChange(e.target.value)} placeholder="custom" className="w-20 bg-transparent py-1 text-xs font-bold focus:outline-none" /></div>
    </div>
  );
}

export default function AdminDedicatedReferrals() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [payout, setPayout] = useState("10");
  const [editing, setEditing] = useState(null);
  const [editPayout, setEditPayout] = useState("");
  const [logFor, setLogFor] = useState(null);
  const [log, setLog] = useState(null);

  const load = () => api.get("/admin/dedicated-referrals").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const search = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return toast.error("Enter at least 2 characters");
    setSearching(true);
    try { const { data } = await api.get("/admin/dedicated-referrals/search", { params: { q: q.trim() } }); setResults(data); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setSearching(false); }
  };
  const enable = async () => {
    const p = parseFloat(payout);
    if (!(p >= 0)) return toast.error("Enter a valid payout");
    if (!window.confirm(`Enable dedicated referral for ${adding.name} at ₹${p} per eligible referral?`)) return;
    try { await api.post("/admin/dedicated-referrals", { user_id: adding.user_id, payout: p, enabled: true }); toast.success(`Dedicated referral enabled for ${adding.name}`); setAdding(null); setResults(null); setQ(""); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const toggle = async (d) => {
    if (!window.confirm(`${d.enabled ? "Disable" : "Enable"} dedicated referral for ${d.name}?`)) return;
    try { await api.patch(`/admin/dedicated-referrals/${d.user_id}`, { enabled: !d.enabled }); toast.success(d.enabled ? "Disabled" : "Enabled"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const savePayout = async () => {
    const p = parseFloat(editPayout);
    if (!(p >= 0)) return toast.error("Enter a valid payout");
    try { await api.patch(`/admin/dedicated-referrals/${editing.user_id}`, { payout: p }); toast.success(`Payout updated to ₹${p}`); setEditing(null); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const openLog = async (d) => { setLogFor(d); setLog(null); const { data } = await api.get(`/admin/dedicated-referrals/${d.user_id}/log`); setLog(data); };

  const totals = list.reduce((m, d) => ({ active: m.active + (d.enabled ? 1 : 0), eligible: m.eligible + d.eligible_count, earned: m.earned + d.total_earned }), { active: 0, eligible: 0, earned: 0 });

  return (
    <DashboardLayout nav={adminNav} title="Dedicated Customer Referral">
      <p className="mb-4 text-sm text-slate-500">A separate, per-customer referral payout for hand-picked publishers. It is paid <b>in addition to</b> the standard Refer &amp; Earn bonus and does not change the existing referral system for anyone else.</p>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[["Active dedicated customers", totals.active, "ded-stat-active"], ["Eligible referrals paid", totals.eligible, "ded-stat-eligible"], ["Total dedicated earnings", `₹${totals.earned.toFixed(2).replace(/\.00$/, "")}`, "ded-stat-earned"]].map(([l, v, t]) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={t}><div className="font-mono text-2xl font-bold text-slate-900">{v}</div><div className="text-xs font-semibold text-slate-500">{l}</div></div>
        ))}
      </div>

      <form onSubmit={search} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4" data-testid="ded-search-box">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-600"><UserPlus className="h-3.5 w-3.5" /> Add a dedicated customer</label>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="ded-search-input" placeholder="Search by Customer Name, Customer ID or Mobile Number" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none" />
          <button type="submit" disabled={searching} data-testid="ded-search-btn" className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</button>
          <button type="button" onClick={() => { setQ(""); setResults(null); setAdding(null); }} data-testid="ded-search-reset" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"><RotateCcw className="h-4 w-4" /> Reset</button>
        </div>
        {results && (
          <div className="mt-3 space-y-2" data-testid="ded-search-results">
            {results.length === 0 && <div className="text-sm font-semibold text-rose-600" data-testid="ded-search-notfound">Not Found — no customer matches "{q}"</div>}
            {results.map((r) => (
              <div key={r.user_id} data-testid={`ded-result-${r.user_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                <div><b>{r.name}</b> <span className="font-mono text-xs text-slate-500">{r.customer_id}</span> · {r.mobile} · <span className="text-xs text-slate-500">{r.email}</span></div>
                {r.dedicated ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.dedicated.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>Already added · ₹{r.dedicated.payout} · {r.dedicated.enabled ? "Enabled" : "Disabled"}</span>
                  : <button onClick={() => { setAdding(r); setPayout("10"); }} data-testid={`ded-select-${r.user_id}`} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">Select</button>}
              </div>
            ))}
          </div>
        )}
        {adding && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3" data-testid="ded-enable-box">
            <div className="mb-2 text-sm">Enable for <b>{adding.name}</b> <span className="font-mono text-xs text-slate-500">{adding.customer_id}</span> — payout per eligible referral:</div>
            <PayoutPicker value={payout} onChange={setPayout} testId="ded-payout" />
            <div className="mt-3 flex gap-2"><button onClick={enable} data-testid="ded-enable-confirm" className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Enable Dedicated Referral</button><button onClick={() => setAdding(null)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">Cancel</button></div>
          </div>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm" data-testid="ded-table">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Customer</th><th className="p-3">Payout</th><th className="p-3">Referrals</th><th className="p-3">Eligible</th><th className="p-3">Earnings</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500" data-testid="ded-empty">No dedicated customers yet. Search above to add one.</td></tr>}
            {list.map((d) => (
              <tr key={d.id} data-testid={`ded-row-${d.user_id}`} className="border-t border-slate-100">
                <td className="p-3"><div className="font-semibold text-slate-900">{d.name}</div><div className="flex items-center gap-0.5 font-mono text-xs text-slate-500">{d.customer_id}<CopyValue value={d.customer_id} label="Customer ID" /> · {d.mobile}</div></td>
                <td className="p-3">
                  {editing?.user_id === d.user_id ? <div className="flex flex-col gap-2"><PayoutPicker value={editPayout} onChange={setEditPayout} testId="ded-edit-payout" /><div className="flex gap-1.5"><button onClick={savePayout} data-testid="ded-edit-save" className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">Save</button><button onClick={() => setEditing(null)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold">Cancel</button></div></div>
                    : <span className="font-mono text-base font-bold text-emerald-700" data-testid={`ded-payout-${d.user_id}`}>₹{d.payout}</span>}
                </td>
                <td className="p-3 font-mono" data-testid={`ded-count-${d.user_id}`}>{d.referral_count}</td>
                <td className="p-3 font-mono" data-testid={`ded-eligible-${d.user_id}`}>{d.eligible_count}</td>
                <td className="p-3 font-mono font-bold" data-testid={`ded-earned-${d.user_id}`}>₹{d.total_earned}</td>
                <td className="p-3"><span data-testid={`ded-status-${d.user_id}`} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${d.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{d.enabled ? "Enabled" : "Disabled"}</span></td>
                <td className="p-3"><div className="flex flex-wrap gap-1.5">
                  <button onClick={() => { setEditing(d); setEditPayout(String(d.payout)); }} data-testid={`ded-edit-${d.user_id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700"><Pencil className="h-3 w-3" /> Payout</button>
                  <button onClick={() => toggle(d)} data-testid={`ded-toggle-${d.user_id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white ${d.enabled ? "bg-rose-500" : "bg-emerald-600"}`}><Power className="h-3 w-3" /> {d.enabled ? "Disable" : "Enable"}</button>
                  <button onClick={() => openLog(d)} data-testid={`ded-log-${d.user_id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700"><History className="h-3 w-3" /> Log</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setLogFor(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rt-scroll rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()} data-testid="ded-log-modal">
            <div className="flex items-start justify-between"><h3 className="font-display text-lg font-bold">Activity Log — {logFor.name}</h3><button onClick={() => setLogFor(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            {!log ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-slate-400" /> : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-600">Changes &amp; payouts</div>
                  <div className="space-y-1.5">{log.log.length === 0 && <div className="text-xs text-slate-400">No activity yet.</div>}{log.log.map((l) => <div key={l.id} className="rounded-lg bg-slate-50 p-2.5 text-xs" data-testid="ded-log-item"><div className="flex justify-between"><b className="capitalize">{l.action.replace(/_/g, " ")}</b>{l.amount != null && <span className="font-mono text-emerald-700">₹{l.amount}</span>}</div><div className="text-slate-700">{l.detail}</div><div className="mt-0.5 text-[11px] text-slate-400">{fmt(l.created_at)} · {l.by}</div></div>)}</div></div>
                <div><div className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-600"><Gift className="h-3.5 w-3.5" /> Referred customers ({log.referrals.length})</div>
                  <div className="space-y-1.5">{log.referrals.length === 0 && <div className="text-xs text-slate-400">No referrals yet.</div>}{log.referrals.map((r) => <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 text-xs"><div><b>{r.name}</b><div className="text-slate-500">{r.email} · joined {fmt(r.joined_at).slice(0, 10)}</div></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.eligible ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{r.eligible ? "Eligible · paid" : "Not eligible"}</span></div>)}</div></div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
