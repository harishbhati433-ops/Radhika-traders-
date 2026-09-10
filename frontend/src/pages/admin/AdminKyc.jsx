import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { PhoneLink, EmailLink } from "../../components/ContactLinks";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, ShieldOff, Clock, Eye, X, Pencil } from "lucide-react";
import { CustomerEditDialog } from "../../components/CustomerEditDialog";
import { CopyValue } from "../../components/CopyValue";

const TABS = [["", "All"], ["pending", "Pending"], ["verified", "Verified"], ["rejected", "Rejected"], ["deactivated", "Deactivated"]];
const TONE = { pending: "bg-amber-50 text-amber-700 border-amber-200", verified: "bg-emerald-50 text-emerald-700 border-emerald-200", rejected: "bg-rose-50 text-rose-700 border-rose-200", deactivated: "bg-slate-100 text-slate-600 border-slate-200" };

export default function AdminKyc() {
  const [tab, setTab] = useState("");
  const [list, setList] = useState([]);
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = () => api.get("/admin/kyc", { params: tab ? { status: tab } : {} }).then(({ data }) => setList(data));
  useEffect(() => { load(); }, [tab]);

  const setStatus = async (u, status) => {
    let note = "";
    if (status === "rejected" || status === "deactivated") note = window.prompt(`Reason for ${status} (optional):`) || "";
    try { await api.patch(`/admin/kyc/${u.id}`, { status, note }); toast.success(`KYC ${status}`); setView(null); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const counts = list.reduce((m, u) => ({ ...m, [u.kyc.status]: (m[u.kyc.status] || 0) + 1 }), {});

  return (
    <DashboardLayout nav={adminNav} title="KYC Management">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["pending", "Pending", Clock], ["verified", "Verified", ShieldCheck], ["rejected", "Rejected", ShieldX], ["deactivated", "Deactivated", ShieldOff]].map(([k, l, I]) => (
          <div key={k} className={`rounded-2xl border p-4 ${TONE[k]}`} data-testid={`kyc-count-${k}`}><I className="h-4 w-4" /><div className="mt-1 font-mono text-2xl font-bold">{tab ? (tab === k ? list.length : "–") : counts[k] || 0}</div><div className="text-xs font-semibold">{l}</div></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`kyc-tab-${k || "all"}`} className={`rounded-full px-4 py-1.5 text-xs font-bold ${tab === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{l}</button>)}
      </div>
      <div className="space-y-3">
        {list.length === 0 && <p className="py-12 text-center text-sm text-slate-500" data-testid="kyc-empty">No KYC submissions here.</p>}
        {list.map((u) => (
          <div key={u.id} data-testid={`kyc-row-${u.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{u.name}</span><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${TONE[u.kyc.status]}`}>{u.kyc.status}</span></div>
              <div className="mt-1.5 flex flex-wrap gap-1.5"><PhoneLink value={u.mobile} testId={`kyc-phone-${u.id}`} /><EmailLink value={u.email} testId={`kyc-email-${u.id}`} /></div>
              <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-slate-500" data-testid={`kyc-bank-${u.id}`}>
                <span>PAN <b className="font-mono">{u.kyc.pan}</b></span><CopyValue value={u.kyc.pan} label="PAN" testId={`kyc-copy-pan-${u.id}`} />
                <span>· A/C <b className="font-mono">{u.bank?.bank_account}</b></span><CopyValue value={u.bank?.bank_account} label="Account number" testId={`kyc-copy-account-${u.id}`} />
                <span>· IFSC <b className="font-mono">{u.bank?.ifsc}</b></span><CopyValue value={u.bank?.ifsc} label="IFSC" testId={`kyc-copy-ifsc-${u.id}`} />
                {u.bank?.bank_name && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700" data-testid={`kyc-bank-name-${u.id}`}>{u.bank.bank_name}{u.bank.branch ? ` · ${u.bank.branch}` : ""}</span>}
                {u.bank?.upi && <><span>· UPI <b>{u.bank.upi}</b></span><CopyValue value={u.bank.upi} label="UPI ID" testId={`kyc-copy-upi-${u.id}`} /></>}
              </div>
              {u.kyc.admin_note && <div className="text-xs text-rose-500">Note: {u.kyc.admin_note}</div>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setView(u)} data-testid={`kyc-view-${u.id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"><Eye className="h-3.5 w-3.5" /> View</button>
              <button onClick={() => setEdit(u)} data-testid={`kyc-edit-${u.id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
              {u.kyc.status !== "verified" && <button onClick={() => setStatus(u, "verified")} data-testid={`kyc-verify-${u.id}`} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">Verify</button>}
              {u.kyc.status === "pending" && <button onClick={() => setStatus(u, "rejected")} data-testid={`kyc-reject-${u.id}`} className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">Reject</button>}
              {u.kyc.status === "verified" && <button onClick={() => setStatus(u, "deactivated")} data-testid={`kyc-deactivate-${u.id}`} className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-bold text-white">Deactivate</button>}
              {u.kyc.status === "deactivated" && <button onClick={() => setStatus(u, "verified")} data-testid={`kyc-activate-${u.id}`} className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white">Activate</button>}
            </div>
          </div>
        ))}
      </div>

      {view && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="kyc-detail-modal">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><h3 className="font-display text-lg font-bold">{view.name} — KYC Details</h3><button onClick={() => setView(null)} className="rounded-lg p-1 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[["Status", view.kyc.status], ["PAN", view.kyc.pan, "pan"], ["Aadhaar", view.kyc.aadhaar || "—", "aadhaar"], ["Account Holder", view.bank?.account_holder, "holder"], ["Bank A/C", view.bank?.bank_account, "account"], ["IFSC", view.bank?.ifsc, "ifsc"], ["Bank", view.bank?.bank_name ? `${view.bank.bank_name}${view.bank.branch ? ` · ${view.bank.branch}` : ""}` : "—"], ["UPI", view.bank?.upi || "—", "upi"], ["Submitted", (view.kyc.submitted_at || "").slice(0, 10)], ["Referral Code", view.referral_code, "ref"], ["Address", view.address || "—"]].map(([k, v, copyKey]) => (
                <div key={k}><dt className="text-[11px] uppercase tracking-wider text-slate-400">{k}</dt><dd className={`flex items-center gap-0.5 font-semibold text-slate-900 break-all ${k === "Status" ? "capitalize" : ""}`}>{v}{copyKey && v !== "—" && <CopyValue value={v} label={k} testId={`kyc-detail-copy-${copyKey}`} />}</dd></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5"><PhoneLink value={view.mobile} /><EmailLink value={view.email} /></div>
            {view.bank?.upi_qr_url && <img src={fileUrl(view.bank.upi_qr_url)} alt="UPI QR" className="mt-3 h-28 w-28 rounded-lg border object-contain" />}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => { setEdit(view); setView(null); }} data-testid="kyc-detail-edit" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"><Pencil className="h-3.5 w-3.5" /> Edit Details</button>
              {view.kyc.status !== "verified" && <button onClick={() => setStatus(view, "verified")} className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white">Verify</button>}
              {view.kyc.status !== "rejected" && <button onClick={() => setStatus(view, "rejected")} className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white">Reject</button>}
              {view.kyc.status === "verified" ? <button onClick={() => setStatus(view, "deactivated")} className="rounded-full bg-slate-700 px-4 py-2 text-xs font-bold text-white">Deactivate</button>
                : view.kyc.status === "deactivated" && <button onClick={() => setStatus(view, "verified")} className="rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white">Activate</button>}
            </div>
          </div>
        </div>
      )}
      <CustomerEditDialog customerId={edit?.id} open={!!edit} onClose={() => setEdit(null)} onDone={load} initialTab="kyc" />
    </DashboardLayout>
  );
}
