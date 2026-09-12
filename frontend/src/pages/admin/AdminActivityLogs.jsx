import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { Input } from "../../components/ui/input";
import { RotateCcw, ShieldCheck } from "lucide-react";

const sel = "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700";
const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const TONE = (s) => /approved|paid|success|verified|credited|created|live|active|enabled|restored|sent/.test(s) ? "bg-emerald-50 text-emerald-700 border-emerald-200"
  : /reject|fail|deleted|disabled|purged|archived|deduct|zero/.test(s) ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200";

export default function AdminActivityLogs() {
  const empty = { employee_id: "", action: "", campaign_id: "", entity: "", status: "", date_from: "", date_to: "", role: "" };
  const [flt, setFlt] = useState(empty);
  const [meta, setMeta] = useState({ actions: [], statuses: [], actors: [], campaigns: [] });
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/admin/activity-logs/meta").then(({ data }) => setMeta(data)); }, []);
  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(flt).filter(([, v]) => v));
    const t = setTimeout(() => api.get("/admin/activity-logs", { params }).then(({ data }) => setData(data)).finally(() => setLoading(false)), 250);
    return () => clearTimeout(t);
  }, [flt]);

  return (
    <DashboardLayout nav={adminNav} title="Activity Logs">
      <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900" data-testid="logs-immutable-note">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Immutable audit trail — logs are written automatically by the server and can never be edited or deleted. Times shown in IST.
      </div>
      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="logs-filters">
        <select data-testid="logs-filter-employee" className={sel} value={flt.employee_id} onChange={(e) => setFlt({ ...flt, employee_id: e.target.value })}>
          <option value="">All users (Admin + Employees)</option>
          {meta.actors.map((a) => <option key={a.id} value={a.id}>{a.role === "admin" ? "★ " : ""}{a.name} ({a.username}){a.status && a.status !== "active" ? ` · ${a.status}` : ""}</option>)}
        </select>
        <select data-testid="logs-filter-action" className={sel} value={flt.action} onChange={(e) => setFlt({ ...flt, action: e.target.value })}>
          <option value="">All actions</option>{meta.actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
        <select data-testid="logs-filter-campaign" className={sel} value={flt.campaign_id} onChange={(e) => setFlt({ ...flt, campaign_id: e.target.value })}>
          <option value="">All campaigns</option>{meta.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select data-testid="logs-filter-status" className={sel} value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}>
          <option value="">All statuses</option>{meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Input data-testid="logs-filter-entity" placeholder="Lead ID / Client ID / name / UTR…" value={flt.entity} onChange={(e) => setFlt({ ...flt, entity: e.target.value })} className="text-xs" />
        <Input data-testid="logs-filter-from" type="date" value={flt.date_from} onChange={(e) => setFlt({ ...flt, date_from: e.target.value })} className="text-xs" />
        <Input data-testid="logs-filter-to" type="date" value={flt.date_to} onChange={(e) => setFlt({ ...flt, date_to: e.target.value })} className="text-xs" />
        <div className="flex items-center gap-2">
          <select data-testid="logs-filter-role" className={sel} value={flt.role} onChange={(e) => setFlt({ ...flt, role: e.target.value })}><option value="">Admin + Employee</option><option value="employee">Employees only</option><option value="admin">Admin only</option></select>
          <button onClick={() => setFlt(empty)} data-testid="logs-reset" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
        </div>
      </div>
      <div className="mb-2 text-xs font-semibold text-slate-500" data-testid="logs-count">{loading ? "Loading…" : `${data.total} record${data.total === 1 ? "" : "s"}${data.total > data.items.length ? ` (showing latest ${data.items.length})` : ""}`}</div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Date / Time (IST)</th><th className="p-3">Employee</th><th className="p-3">Action</th><th className="p-3">ID / Entity</th><th className="p-3">Campaign / Client</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th><th className="p-3">IP</th></tr></thead>
          <tbody>
            {data.items.length === 0 && !loading && <tr><td colSpan={8} className="p-8 text-center text-slate-400" data-testid="logs-empty">No activity found for these filters.</td></tr>}
            {data.items.map((l) => (
              <tr key={l.id} data-testid={`log-row-${l.id}`} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                <td className="whitespace-nowrap p-3 font-mono text-slate-600">{fmt(l.created_at)}</td>
                <td className="p-3"><div className="font-semibold text-slate-900">{l.actor_name}</div><div className="text-[11px] text-slate-500">{l.actor_role === "admin" ? "Super Admin" : `@${l.actor_username}`}</div></td>
                <td className="p-3"><span className="font-semibold capitalize text-slate-800">{l.action.replace(/_/g, " ")}</span>{l.detail && <div className="mt-0.5 max-w-[260px] text-[11px] text-slate-500">{l.detail}</div>}</td>
                <td className="p-3"><div className="font-mono text-slate-700">{l.entity_id || "—"}</div>{l.entity_label && <div className="text-[11px] text-slate-500">{l.entity_label}</div>}<div className="text-[10px] uppercase text-slate-400">{l.entity_type}</div></td>
                <td className="p-3">{l.campaign_name && <div className="text-slate-800">{l.campaign_name}</div>}{l.client_name && <div className="text-[11px] text-slate-500">Client: {l.client_name}</div>}{!l.campaign_name && !l.client_name && "—"}</td>
                <td className="p-3">{l.status ? <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${TONE(l.status)}`}>{l.status.replace(/_/g, " ")}</span> : "—"}</td>
                <td className="whitespace-nowrap p-3 text-right font-mono font-semibold text-slate-800">{l.amount != null ? (l.entity_type === "broadcast" || l.entity_type === "report" ? `${l.amount} users` : `₹${Number(l.amount).toLocaleString("en-IN")}`) : "—"}</td>
                <td className="whitespace-nowrap p-3 font-mono text-slate-500">{l.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
