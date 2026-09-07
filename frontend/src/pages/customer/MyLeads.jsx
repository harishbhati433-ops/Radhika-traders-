import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api from "../../lib/api";
import { ClipboardList } from "lucide-react";
import { CampaignChip } from "../../components/CampaignChip";

const TONE = { pending: "bg-amber-50 text-amber-700", approved: "bg-emerald-50 text-emerald-700", rejected: "bg-rose-50 text-rose-700", account_opened: "bg-sky-50 text-sky-700" };

export default function MyLeads() {
  const [leads, setLeads] = useState([]);
  useEffect(() => { api.get("/my-leads").then(({ data }) => setLeads(data)); }, []);
  const count = (k, v) => leads.filter((l) => l[k] === v).length;

  return (
    <DashboardLayout nav={customerNav} title="My Leads">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Total", leads.length, "bg-white text-slate-800"], ["Pending", count("status", "pending"), "bg-amber-50 text-amber-700"], ["Approved", count("status", "approved"), "bg-emerald-50 text-emerald-700"], ["Account Opened", count("account_status", "account_opened"), "bg-sky-50 text-sky-700"]].map(([l, v, cls]) => (
          <div key={l} className={`rounded-2xl border border-slate-200 p-4 ${cls}`}><div className="font-mono text-2xl font-bold">{v}</div><div className="text-xs font-semibold">{l}</div></div>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-500">Customers who submitted their details through your referral links. Status is updated by Radhika Traders after verification with the partner.</p>
      <div className="space-y-2" data-testid="my-leads-list">
        {leads.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" data-testid="my-leads-empty"><ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300" /> No leads yet. Share your campaign links to get started.</div>}
        {leads.map((l) => (
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
