import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { PhoneLink, EmailLink } from "../../components/ContactLinks";
import { CampaignChip } from "../../components/CampaignChip";
import { LeadExport, DATE_PRESETS, presetRange } from "../../components/LeadExport";
import { CopyValue } from "../../components/CopyValue";
import { LeadFundDialog } from "../../components/LeadFundDialog";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { Search, Eye, X, CheckCircle, XCircle, Clock, Users, Building2, Wallet, CalendarDays, Copy, TrendingUp, AlertTriangle } from "lucide-react";
import { useCan } from "../../lib/perm";

const S_TONE = { pending: "bg-amber-50 text-amber-700 border-amber-200", approved: "bg-emerald-50 text-emerald-700 border-emerald-200", rejected: "bg-rose-50 text-rose-700 border-rose-200", duplicate: "bg-violet-50 text-violet-700 border-violet-200", account_opened: "bg-sky-50 text-sky-700 border-sky-200", trade_done: "bg-indigo-50 text-indigo-700 border-indigo-200" };
const S_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", duplicate: "Duplicate", account_opened: "Account Open", trade_done: "Trade Done" };
const A_LABEL = { pending: "Not Started", account_opened: "Account Open", trade_done: "Trade Done", rejected: "Rejected" };
const Badge = ({ s, testId, account }) => <span data-testid={testId} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${S_TONE[s] || "bg-slate-100 text-slate-600"}`}>{account ? (A_LABEL[s] || s) : (S_LABEL[s] || (s || "").replace("_", " "))}</span>;
const LABELS = { name: "Name", mobile: "Mobile", email: "Email", pan: "PAN", dob: "DOB", aadhaar: "Aadhaar", bank_account: "Bank A/C", ifsc: "IFSC", upi: "UPI", address: "Address" };

export default function AdminLeads() {
  const [summary, setSummary] = useState({});
  const [list, setList] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [flt, setFlt] = useState({ campaign_id: "", status: "", account_status: "", ref: "", search: "", date_from: "", date_to: "", preset: "" });
  const [view, setView] = useState(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const can = useCan("leads");
  const canPay = useCan("payments");
  const payoutFor = (cid) => campaigns.find((c) => c.id === cid)?.payout_amount || "";
  const pickPreset = (k) => {
    if (k === "custom") { setCustomOpen(true); setFlt({ ...flt, preset: "custom" }); return; }
    setCustomOpen(false); const [a, b] = presetRange(k); setFlt({ ...flt, date_from: a, date_to: b, preset: k });
  };

  const load = () => {
    const params = Object.fromEntries(Object.entries(flt).filter(([k, v]) => v && k !== "preset"));
    api.get("/admin/leads", { params }).then(({ data }) => setList(data));
    api.get("/admin/leads/summary").then(({ data }) => setSummary(data));
  };
  useEffect(() => {
    Promise.all([api.get("/campaigns", { params: { admin_view: true } }), api.get("/campaigns/archived").catch(() => ({ data: [] }))])
      .then(([a, b]) => setCampaigns([...a.data, ...b.data.map((c) => ({ ...c, archived: true }))]));
  }, []);
  const campaignLabel = (c) => `${c.offer_name}${c.archived ? " (Archived)" : c.status && c.status !== "live" ? ` (${c.status[0].toUpperCase()}${c.status.slice(1)})` : !c.offer_enabled ? " (Offer OFF)" : ""}`;
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [flt]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (l, patch) => {
    if (patch.status === "rejected" || patch.account_status === "rejected") patch.reject_reason = window.prompt("Reject reason (optional):") || "";
    try { const { data } = await api.patch(`/admin/leads/${l.id}`, patch); toast.success("Lead updated"); setView(view ? data : null); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const sel = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

  return (
    <DashboardLayout nav={adminNav} title="Leads / Customer Reports">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-testid="lead-summary">
        {[["total", "Total Leads", Users, "text-slate-700 bg-white"], ["approved", "Approved", CheckCircle, "text-emerald-700 bg-emerald-50"], ["pending", "Pending", Clock, "text-amber-700 bg-amber-50"], ["rejected", "Rejected", XCircle, "text-rose-700 bg-rose-50"], ["duplicate", "Duplicate", Copy, "text-violet-700 bg-violet-50"], ["account_opened", "Account Open", Building2, "text-sky-700 bg-sky-50"], ["trade_done", "Trade Done", TrendingUp, "text-indigo-700 bg-indigo-50"]].map(([k, l, I, cls]) => (
          <div key={k} className={`rounded-2xl border border-slate-200 p-4 ${cls}`} data-testid={`lead-summary-${k}`}><I className="h-4 w-4" /><div className="mt-1 font-mono text-2xl font-bold">{summary[k] ?? 0}</div><div className="text-xs font-semibold">{l}</div></div>
        ))}
      </div>

      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3 lg:grid-cols-7" data-testid="lead-filters">
        <div className="relative lg:col-span-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input data-testid="lead-search" placeholder="Search name / mobile / email / Lead ID" value={flt.search} onChange={(e) => setFlt({ ...flt, search: e.target.value })} className="pl-9" /></div>
        <select data-testid="lead-filter-campaign" value={flt.campaign_id} onChange={(e) => setFlt({ ...flt, campaign_id: e.target.value })} className={sel}>
          <option value="">All campaigns (incl. closed/archived)</option>
          {campaigns.filter((c) => !c.archived && c.status === "live").map((c) => <option key={c.id} value={c.id}>{campaignLabel(c)}</option>)}
          {campaigns.filter((c) => !c.archived && c.status !== "live").map((c) => <option key={c.id} value={c.id}>{campaignLabel(c)}</option>)}
          {campaigns.filter((c) => c.archived).map((c) => <option key={c.id} value={c.id}>{campaignLabel(c)}</option>)}
        </select>
        <select data-testid="lead-filter-status" value={flt.status || (flt.account_status ? `acc:${flt.account_status}` : "")} onChange={(e) => { const v = e.target.value; setFlt(v.startsWith("acc:") ? { ...flt, status: "", account_status: v.slice(4) } : { ...flt, status: v, account_status: v ? "" : flt.account_status }); }} className={sel}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option>
          <option value="acc:account_opened">Account Open</option><option value="acc:trade_done">Trade Done</option>
        </select>
        <select data-testid="lead-filter-account" value={flt.account_status} onChange={(e) => setFlt({ ...flt, account_status: e.target.value })} className={sel}><option value="">All account statuses</option><option value="pending">Not Started</option><option value="account_opened">Account Open</option><option value="trade_done">Trade Done</option><option value="rejected">Rejected</option></select>
        <Input data-testid="lead-filter-ref" placeholder="Publisher / Ref ID" value={flt.ref} onChange={(e) => setFlt({ ...flt, ref: e.target.value })} />
        <div className="flex gap-1"><Input data-testid="lead-filter-from" type="date" value={flt.date_from} onChange={(e) => setFlt({ ...flt, date_from: e.target.value, preset: "custom" })} /><Input data-testid="lead-filter-to" type="date" value={flt.date_to} onChange={(e) => setFlt({ ...flt, date_to: e.target.value, preset: "custom" })} /></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3" data-testid="lead-export-bar">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="lead-date-presets">
          <span className="mr-1 text-xs font-bold text-slate-600">Date:</span>
          <button onClick={() => { setCustomOpen(false); setFlt({ ...flt, date_from: "", date_to: "", preset: "" }); }} data-testid="lead-preset-all" className={`rounded-full px-3 py-1 text-xs font-bold ${!flt.preset && !flt.date_from ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>All time</button>
          {DATE_PRESETS.map(([k, l]) => (
            <button key={k} data-testid={`lead-preset-${k}`} onClick={() => pickPreset(k)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${flt.preset === k ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{k === "custom" ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {l}</span> : l}</button>
          ))}
          {flt.date_from && <span className="ml-1 text-xs text-slate-500" data-testid="lead-date-range-label">{flt.date_from} → {flt.date_to || "today"}</span>}
        </div>
        {(customOpen || flt.preset === "custom") && (
          <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3" data-testid="lead-custom-range">
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">From</div><Input data-testid="lead-custom-from" type="date" max={flt.date_to || undefined} value={flt.date_from} onChange={(e) => setFlt({ ...flt, date_from: e.target.value, preset: "custom" })} className="h-9 bg-white" /></div>
            <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">To</div><Input data-testid="lead-custom-to" type="date" min={flt.date_from || undefined} value={flt.date_to} onChange={(e) => setFlt({ ...flt, date_to: e.target.value, preset: "custom" })} className="h-9 bg-white" /></div>
            <div className="text-xs text-slate-500">{flt.date_from || flt.date_to ? `Showing ${list.length} leads` : "Pick a From and To date — list filters instantly."}</div>
            <button onClick={() => { setCustomOpen(false); setFlt({ ...flt, date_from: "", date_to: "", preset: "" }); }} data-testid="lead-custom-clear" className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Clear</button>
          </div>
        )}
        <LeadExport filters={{ campaign_id: flt.campaign_id, status: flt.status, account_status: flt.account_status, ref: flt.ref, search: flt.search, date_from: flt.date_from, date_to: flt.date_to }} count={list.length} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white rt-scroll">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Lead</th><th className="p-3">Customer</th><th className="p-3">Campaign</th><th className="p-3">Referred By</th><th className="p-3">Stage</th><th className="p-3">Dates</th><th className="p-3">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((l) => (
              <tr key={l.id} data-testid={`lead-row-${l.id}`}>
                <td className="p-3 font-mono text-xs font-bold text-slate-700"><span className="inline-flex items-center gap-0.5">{l.lead_id}<CopyValue value={l.lead_id} label="Lead ID" testId={`copy-leadid-${l.id}`} /></span></td>
                <td className="p-3"><div className="inline-flex items-center gap-0.5 font-semibold text-slate-900">{l.customer_name || "—"}<CopyValue value={l.customer_name} label="Name" testId={`copy-name-${l.id}`} /></div><div className="mt-1 flex flex-wrap items-center gap-1"><PhoneLink value={l.mobile} /><CopyValue value={l.mobile} label="Mobile" testId={`copy-mobile-${l.id}`} /><EmailLink value={l.email} /><CopyValue value={l.email} label="Email" testId={`copy-email-${l.id}`} /></div></td>
                <td className="p-3"><CampaignChip name={l.campaign_name} testId={`lead-campaign-${l.id}`} /></td>
                <td className="p-3"><div className="font-medium text-slate-800">{l.partner_name || "Direct"}</div><div className="font-mono text-[10px] text-slate-400">{l.ref_code}</div></td>
                <td className="p-3"><div className="flex flex-col gap-1"><Badge s={l.status} testId={`lead-status-${l.id}`} /><Badge s={l.account_status} account />{l.status === "duplicate" && l.duplicate_of && <span className="text-[10px] font-mono text-violet-600" data-testid={`lead-dup-of-${l.id}`}>of {l.duplicate_of}</span>}</div></td>
                <td className="p-3 text-xs text-slate-500">{(l.created_at || "").slice(0, 10)}<br /><span className="text-slate-400">upd {(l.updated_at || "").slice(0, 10)}</span></td>
                <td className="p-3"><button onClick={() => setView(l)} data-testid={`lead-view-${l.id}`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"><Eye className="h-3.5 w-3.5" /> View Details</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-slate-500" data-testid="lead-empty">No leads found.</td></tr>}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="lead-detail-modal">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl rt-scroll">
            <div className="flex items-start justify-between"><div><h3 className="inline-flex items-center gap-1 font-display text-lg font-bold">Lead {view.lead_id}<CopyValue value={view.lead_id} label="Lead ID" testId="lead-detail-copy-id" /></h3><div className="text-xs text-slate-500">Created {(view.created_at || "").slice(0, 16).replace("T", " ")} · Updated {(view.updated_at || "").slice(0, 16).replace("T", " ")}</div></div><button onClick={() => setView(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Customer Details <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">· tap icon to copy one field</span></div>
                <dl className="mt-2 space-y-1.5 text-sm">{Object.entries(view.data || {}).filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex items-center justify-between gap-2" data-testid={`lead-detail-field-${k}`}><dt className="text-slate-500">{LABELS[k] || k}</dt><dd className="flex items-center gap-0.5 text-right font-semibold text-slate-900 break-all">{v}<CopyValue value={v} label={LABELS[k] || k} testId={`lead-detail-copy-${k}`} /></dd></div>)}</dl>
                <div className="mt-2 flex flex-wrap gap-1"><PhoneLink value={view.mobile} /><EmailLink value={view.email} /></div></div>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Campaign</div><div className="mt-1"><CampaignChip name={view.campaign_name} /></div><div className="font-mono text-[10px] text-slate-400">ID {view.campaign_id}</div>{view.campaign_link && <a href={view.campaign_link} target="_blank" rel="noreferrer" className="block truncate text-xs text-sky-700 underline">{view.campaign_link}</a>}</div>
                <div className="rounded-xl border border-slate-200 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-red-600">Referral</div><div className="mt-1 font-semibold">{view.partner_name || "Direct (no referral)"}</div><div className="font-mono text-xs text-slate-500">{view.ref_code || "—"}</div></div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-red-600">Lead Status</span><Badge s={view.status} testId="lead-view-status" /><span className="ml-2 text-[11px] font-bold uppercase tracking-wider text-red-600">Account</span><Badge s={view.account_status} account testId="lead-view-account" /></div>
              {view.reject_reason && <div className="mt-2 text-xs text-rose-600">Reason: {view.reject_reason}</div>}
              {view.status === "duplicate" && (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900" data-testid="lead-duplicate-box">
                  <div className="flex items-center gap-1.5 font-bold"><AlertTriangle className="h-3.5 w-3.5" /> System-detected duplicate — same person already submitted in this campaign</div>
                  <div className="mt-1"><b>{view.duplicate_reason}</b></div>
                  <div className="mt-1">Original lead: <span className="font-mono font-bold">{view.duplicate_of}</span>{view.duplicate_original_partner && <> · referred by {view.duplicate_original_partner}</>}{view.duplicate_original_at && <> · {(view.duplicate_original_at || "").slice(0, 10)}</>}</div>
                  <div className="mt-1 text-violet-700">Duplicate status is controlled by the system — Approve / Reject are not available. Account Open / Trade Done can still be tracked.</div>
                </div>
              )}
              {can.edit && <div className="mt-3 flex flex-wrap gap-2">
                {view.status !== "duplicate" && <>
                  <button onClick={() => update(view, { status: "pending" })} data-testid="lead-set-pending" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Pending</button>
                  <button onClick={() => update(view, { status: "approved" })} data-testid="lead-approve" className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">Approve Lead</button>
                  <button onClick={() => update(view, { status: "rejected" })} data-testid="lead-reject" className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">Reject Lead</button>
                  <span className="mx-1 border-l border-slate-200" />
                </>}
                <button onClick={() => update(view, { account_status: "account_opened" })} data-testid="lead-account-opened" className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white">Account Open</button>
                <button onClick={() => update(view, { account_status: "trade_done" })} data-testid="lead-trade-done" className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white">Trade Done</button>
                <button onClick={() => update(view, { account_status: "pending" })} data-testid="lead-account-reset" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">Not Started</button>
                <button onClick={() => update(view, { account_status: "rejected" })} data-testid="lead-account-rejected" className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-white">Account Rejected</button>
              </div>}
            </div>
            {canPay.edit && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" data-testid="lead-fund-section">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Publisher Wallet Fund</div>
                  <div className="text-xs text-slate-600">Separate from approval. Credits <b>{view.partner_name || "—"}</b>'s wallet · Total added so far: <b className="font-mono" data-testid="lead-fund-total">₹{view.fund_total || 0}</b></div>
                </div>
                <button onClick={() => setFundOpen(true)} disabled={!view.partner_id} data-testid="lead-add-fund" title={view.partner_id ? "" : "No referring publisher on this lead"} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Wallet className="h-3.5 w-3.5" /> Add Fund</button>
              </div>
              {view.fund_history?.length > 0 && (
                <div className="mt-2 space-y-1" data-testid="lead-fund-history">
                  {[...view.fund_history].reverse().map((f, i) => <div key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-xs"><span><b className="font-mono text-emerald-700">+₹{f.amount}</b> {f.note && <span className="text-slate-500">· {f.note}</span>} <span className="font-mono text-slate-400">{f.ref_id}</span></span><span className="text-slate-400">{(f.at || "").slice(0, 16).replace("T", " ")} · {f.by}</span></div>)}
                </div>
              )}
            </div>}
          </div>
        </div>
      )}
      <LeadFundDialog lead={view} defaultAmount={view ? payoutFor(view.campaign_id) : ""} open={fundOpen && !!view} onClose={() => setFundOpen(false)} onDone={(data) => { setView(data.lead); load(); }} />
    </DashboardLayout>
  );
}
