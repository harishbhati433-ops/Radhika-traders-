import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { StatusBadge } from "../../components/StatusBadge";
import { CampaignForm } from "./CampaignForm";
import api, { formatApiErrorDetail } from "../../lib/api";
import { fileUrl } from "../../lib/api";
import { toast } from "sonner";
import { Input } from "../../components/ui/input";
import { Plus, Pencil, Archive, RotateCcw, Search, Eye, EyeOff, Radio, PauseCircle, XCircle, Play } from "lucide-react";

export default function AdminCampaigns() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [params, setParams] = useSearchParams();

  const load = () => {
    if (showArchived) api.get("/campaigns/archived").then(({ data }) => setItems(data));
    else api.get("/campaigns", { params: { admin_view: true, ...(search ? { search } : {}) } }).then(({ data }) => {
      setItems(data);
      const eid = params.get("edit");
      if (eid) { const c = data.find((x) => x.id === eid); if (c) { setEditing(c); setFormOpen(true); } setParams({}, { replace: true }); }
    });
  };
  useEffect(() => { api.get("/categories?all=true").then(({ data }) => setCats(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [search, showArchived]);

  const [statusBusy, setStatusBusy] = useState("");
  const setStatus = async (c, status) => {
    if (statusBusy) return;
    // Clicking the active Pause / Close button again toggles the campaign back to Live.
    const target = c.status === status && status !== "live" ? "live" : status;
    if (c.status === target) return;
    setStatusBusy(c.id + target);
    try {
      const { data } = await api.patch(`/campaigns/${c.id}/status?status=${target}`);
      toast.success(target === "live" ? `${c.offer_name} is LIVE${c.status === "paused" ? " again (resumed)" : c.status === "closed" ? " again (reopened)" : ""} — customers notified` : target === "paused" ? `${c.offer_name} paused — customers notified` : `${c.offer_name} closed — customers notified`, { description: data?.notified ? "In-app notification sent to all active customers (no email)" : undefined });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Could not change status"); } finally { setStatusBusy(""); }
  };
  const toggleOffer = async (c) => { await api.patch(`/campaigns/${c.id}/toggle-offer?enabled=${!c.offer_enabled}`); load(); };
  const archive = async (c) => { if (!window.confirm(`Archive "${c.offer_name}"? It can be restored.`)) return; await api.delete(`/campaigns/${c.id}`); toast.success("Archived"); load(); };
  const restore = async (c) => { await api.post(`/campaigns/${c.id}/restore`); toast.success("Restored"); load(); };
  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setFormOpen(true); };

  return (
    <DashboardLayout nav={adminNav} title="Campaign Management">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input data-testid="admin-campaign-search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" disabled={showArchived} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArchived(!showArchived)} data-testid="toggle-archived"
            className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${showArchived ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-600"}`}>
            <Archive className="h-4 w-4" /> {showArchived ? "Archived" : "Show Archived"}
          </button>
          {!showArchived && <button onClick={openNew} data-testid="new-campaign-btn" className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold"><Plus className="h-4 w-4" /> New Campaign</button>}
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <p className="py-12 text-center text-slate-500" data-testid="admin-no-campaigns">No campaigns.</p>}
        {items.map((c) => (
          <div key={c.id} data-testid={`admin-campaign-${c.slug}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            {c.logo_url ? <img src={fileUrl(c.logo_url)} alt="" className="h-12 w-12 rounded-xl object-cover" /> :
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 font-display font-bold text-white">{(c.company || c.offer_name).charAt(0)}</div>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-bold text-slate-900">{c.offer_name}</span>
                <StatusBadge status={c.status} />
                {!c.offer_enabled && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">DISABLED</span>}
              </div>
              <div className="text-xs text-slate-400">{c.company} · {c.category} · ₹{c.payout_amount} {c.payout_type}</div>
            </div>

            {showArchived ? (
              <button onClick={() => restore(c)} data-testid={`restore-${c.slug}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                <button onClick={() => setStatus(c, "live")} disabled={!!statusBusy} data-testid={`status-live-${c.slug}`} title={c.status === "live" ? "Live (current)" : "Make Live — notifies customers in-app"} className={`rounded-lg p-2 disabled:opacity-50 ${c.status === "live" ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"}`}><Radio className="h-4 w-4" /></button>
                <button onClick={() => setStatus(c, "paused")} disabled={!!statusBusy} data-testid={`status-paused-${c.slug}`} title={c.status === "paused" ? "Paused — click again to Resume (Live)" : "Pause — notifies customers in-app"} className={`rounded-lg p-2 disabled:opacity-50 ${c.status === "paused" ? "bg-amber-100 text-amber-600 hover:bg-emerald-100 hover:text-emerald-600" : "text-slate-400 hover:bg-amber-50 hover:text-amber-600"}`}>{c.status === "paused" ? <Play className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}</button>
                <button onClick={() => setStatus(c, "closed")} disabled={!!statusBusy} data-testid={`status-closed-${c.slug}`} title={c.status === "closed" ? "Closed — click again to Reopen (Live)" : "Close — notifies customers in-app"} className={`rounded-lg p-2 disabled:opacity-50 ${c.status === "closed" ? "bg-rose-100 text-rose-600 hover:bg-emerald-100 hover:text-emerald-600" : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"}`}>{c.status === "closed" ? <RotateCcw className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</button>
                <button onClick={() => toggleOffer(c)} data-testid={`toggle-offer-${c.slug}`} title="Enable/Disable" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{c.offer_enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button onClick={() => openEdit(c)} data-testid={`edit-${c.slug}`} className="rounded-lg p-2 text-sky-600 hover:bg-sky-50"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => archive(c)} data-testid={`archive-${c.slug}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Archive className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      <CampaignForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} cats={cats} onSaved={load} />
    </DashboardLayout>
  );
}
