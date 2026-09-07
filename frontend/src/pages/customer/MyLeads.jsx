import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api from "../../lib/api";
import { ClipboardList, Search, X } from "lucide-react";
import { Input } from "../../components/ui/input";
import { CampaignChip } from "../../components/CampaignChip";

const TONE = { pending: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-rose-50 text-rose-700", account_opened: "bg-sky-50 text-sky-700" };

export default function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [camp, setCamp] = useState("");
  useEffect(() => { api.get("/my-leads").then(({ data }) => setLeads(data)); }, []);
  const count = (k, v) => leads.filter((l) => l[k] === v).length;
  const campaigns = [...new Set(leads.map((l) => l.campaign_name).filter(Boolean))];
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  const nq = norm(q);
  const shown = leads.filter((l) => {
    if (status && l.status !== status && l.account_status !== status) return false;
    if (camp && l.campaign_name !== camp) return false;
    if (!nq) return true;
    const hay = [l.customer_name, l.mobile, l.email, l.lead_id, l.campaign_name, ...(l.details || []).map((d) => d.value)].map(norm).join("|");
    return hay.includes(nq);
  });
  const sel = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <DashboardLayout nav={customerNav} title="My Leads">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Total", leads.length, "bg-white text-slate-800"], ["Pending", count("status", "pending"), "bg-amber-50 text-amber-700"], ["Approved", count("status", "approved"), "bg-emerald-50 text-emerald-700"], ["Account Opened", count("account_status", "account_opened"), "bg-sky-50 text-sky-700"]].map(([l, v, cls]) => (
          <div key={l} className={`rounded-2xl border border-slate-200 p-4 ${cls}`}><div className="font-mono text-2xl font-bold">{v}</div><div className="text-xs font-semibold">{l}</div></div>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-500">Customers who submitted their details through your referral links. Status is updated by Radhika Traders after verification with the partner.</p>
      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="my-leads-filters">
        <div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input data-testid="my-leads-search" placeholder="Search by name, mobile, email or Lead ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />{q && <button onClick={() => setQ("")} data-testid="my-leads-search-clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>}</div>
        <select data-testid="my-leads-filter-campaign" value={camp} onChange={(e) => setCamp(e.target.value)} className={sel}><option value="">All campaigns</option>{campaigns.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select data-testid="my-leads-filter-status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="account_opened">Account Opened</option></select>
      </div>
      {(q || status || camp) && <div className="mb-3 text-xs font-semibold text-slate-500" data-testid="my-leads-result-count">Showing {shown.length} of {leads.length} leads</div>}
      <div className="space-y-2" data-testid="my-leads-list">
        {leads.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" data-testid="my-leads-empty"><ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300" /> No leads yet. Share your campaign links to get started.</div>}
        {leads.length > 0 && shown.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" data-testid="my-leads-no-match"><Search className="mx-auto mb-2 h-8 w-8 text-slate-300" /> No leads match your search.</div>}
        {shown.map((l) => (
          <div key={l.id} data-testid={`my-lead-${l.id}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="font-semibold text-slate-900">{l.customer_name || "Customer"} <span className="ml-1 font-mono text-[10px] text-slate-400">{l.lead_id}</span></div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><CampaignChip name={l.campaign_name} testId={`my-lead-campaign-${l.id}`} /><span>{(l.created_at || "").slice(0, 10)}</span></div>{l.reject_reason && <div className="text-xs text-rose-600">Reason: {l.reject_reason}</div>}</div>
              <div className="flex gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${TONE[l.status]}`}>{l.status}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${TONE[l.account_status]}`}>{l.account_status.replace("_", " ")}</span></div>
            </div>
            {l.details?.length > 0 && (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-3" data-testid={`my-lead-details-${l.id}`}>
                {l.details.map((d) => (
                  <div key={d.key} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{d.label}</div>
                    <div className="break-all text-sm font-semibold text-slate-800">{d.key === "mobile" ? <a href={`tel:${d.value}`} className="text-red-600">{d.value}</a> : d.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
