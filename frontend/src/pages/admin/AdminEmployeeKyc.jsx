import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Eye, Pencil, ShieldCheck, XCircle, Trash2, Power, X } from "lucide-react";
import { KycForm } from "../employee/EmployeeKyc";

const PILL = { pending: "bg-amber-100 text-amber-800", verified: "bg-emerald-100 text-emerald-800", rejected: "bg-rose-100 text-rose-800" };
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-10" data-testid="ekyc-modal">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-xl"} rounded-2xl bg-white p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold text-slate-900">{title}</h3><button onClick={onClose} data-testid="ekyc-modal-close" className="rounded-full p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}

function ViewKyc({ k }) {
  const rows = [["Name", `${k.full_name} (${k.employee_code})`], ["Mobile", k.mobile], ["Email", k.email], ["Father's Name", k.father_name], ["Date of Birth", k.dob], ["Address", k.address], ["Aadhaar", k.aadhaar], ["PAN", k.pan], ["Bank", `${k.bank_name || ""} ${k.branch ? "— " + k.branch : ""}`], ["IFSC", k.ifsc], ["Account No.", k.bank_account], ["Status", k.status + (k.rejection_reason ? ` — ${k.rejection_reason}` : "")], ["Submitted", fmt(k.submitted_at)], ["Verified", k.verified_at ? `${fmt(k.verified_at)} by ${k.verified_by}` : "—"]];
  return (
    <div>
      <dl className="grid grid-cols-3 gap-y-1.5 text-sm" data-testid="ekyc-view">{rows.map(([a, b]) => <div key={a} className="contents"><dt className="text-slate-500">{a}</dt><dd className="col-span-2 font-mono text-slate-900 break-all">{b || "—"}</dd></div>)}</dl>
      {k.history?.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs"><div className="mb-1 font-bold text-slate-700">Record history</div>{k.history.slice().reverse().map((h, i) => <div key={i} className="text-slate-600">{fmt(h.at)} · <b>{h.action}</b> by {h.by}{h.note ? ` — ${h.note}` : ""}</div>)}</div>}
    </div>
  );
}

export default function AdminEmployeeKyc() {
  const [tab, setTab] = useState("");
  const [d, setD] = useState({ items: [], counts: {}, not_submitted: [] });
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api.get("/admin/employee-kyc", { params: tab ? { status: tab } : {}, noCache: true }).then(({ data }) => setD(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const verify = (k) => window.confirm(`Verify KYC of ${k.full_name}?`) && act(() => api.put(`/admin/employee-kyc/${k.employee_id}/verify`), "KYC verified — employee notified");
  const reject = (k) => { const reason = window.prompt(`Reason for rejecting ${k.full_name}'s KYC:`); if (reason && reason.trim()) act(() => api.put(`/admin/employee-kyc/${k.employee_id}/reject`, { reason }), "KYC rejected — employee notified"); };
  const toggle = (k) => act(() => api.put(`/admin/employee-kyc/${k.employee_id}/enable`, { enabled: k.enabled === false }), k.enabled === false ? "KYC enabled" : "KYC disabled");
  const del = (k) => window.confirm(`Delete KYC record of ${k.full_name}? An archived copy is kept.`) && act(() => api.delete(`/admin/employee-kyc/${k.employee_id}`), "KYC record deleted");
  const c = d.counts || {};
  return (
    <DashboardLayout nav={adminNav} title="Employee KYC">
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", `All (${(c.pending || 0) + (c.verified || 0) + (c.rejected || 0)})`], ["pending", `Pending (${c.pending || 0})`], ["verified", `Verified (${c.verified || 0})`], ["rejected", `Rejected (${c.rejected || 0})`]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} data-testid={`ekyc-tab-${k || "all"}`} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>)}
      </div>
      {d.not_submitted?.length > 0 && !tab && <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-600" data-testid="ekyc-not-submitted">Not submitted yet: {d.not_submitted.map((e) => `${e.name} (${e.employee_code})`).join(", ")}</div>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Employee", "Mobile / Email", "PAN / Aadhaar", "Bank", "Status", "Submitted", "Actions"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {d.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400" data-testid="ekyc-empty">No KYC records</td></tr>}
            {d.items.map((k) => (
              <tr key={k.id} className={`border-t border-slate-100 ${k.enabled === false ? "opacity-60" : ""}`} data-testid={`ekyc-row-${k.employee_id}`}>
                <td className="p-3"><div className="font-semibold text-slate-900">{k.full_name}</div><div className="font-mono text-[10px] text-slate-400">{k.employee_code}</div></td>
                <td className="p-3 text-xs"><div>{k.mobile}</div><div className="text-slate-500">{k.email}</div></td>
                <td className="p-3 font-mono text-xs"><div>{k.pan}</div><div className="text-slate-500">{k.aadhaar_masked}</div></td>
                <td className="p-3 text-xs"><div>{k.bank_name || "—"}</div><div className="font-mono text-slate-500">{k.ifsc} · {k.account_masked}</div></td>
                <td className="p-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PILL[k.status]}`} data-testid={`ekyc-status-${k.employee_id}`}>{k.status}</span>{k.enabled === false && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700" data-testid={`ekyc-disabled-${k.employee_id}`}>disabled</span>}</td>
                <td className="p-3 text-xs text-slate-500">{fmt(k.submitted_at)}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">
                  <button onClick={() => setView(k)} data-testid={`ekyc-view-${k.employee_id}`} title="View" className="rounded-full border border-slate-200 p-1.5 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEdit(k)} data-testid={`ekyc-edit-${k.employee_id}`} title="Edit" className="rounded-full border border-slate-200 p-1.5 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>
                  {k.status !== "verified" && <button onClick={() => verify(k)} data-testid={`ekyc-verify-${k.employee_id}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"><ShieldCheck className="h-3 w-3" /> Verify</button>}
                  {k.status !== "rejected" && <button onClick={() => reject(k)} data-testid={`ekyc-reject-${k.employee_id}`} className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700"><XCircle className="h-3 w-3" /> Reject</button>}
                  <button onClick={() => toggle(k)} data-testid={`ekyc-toggle-${k.employee_id}`} title={k.enabled === false ? "Enable" : "Disable"} className={`rounded-full border p-1.5 ${k.enabled === false ? "border-emerald-300 text-emerald-700" : "border-slate-200 text-slate-600"} hover:bg-slate-50`}><Power className="h-3.5 w-3.5" /></button>
                  <button onClick={() => del(k)} data-testid={`ekyc-delete-${k.employee_id}`} title="Delete" className="rounded-full border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {view && <Modal title={`KYC — ${view.full_name}`} onClose={() => setView(null)}><ViewKyc k={view} /></Modal>}
      {edit && <Modal title={`Edit KYC — ${edit.full_name}`} onClose={() => setEdit(null)} wide><KycForm init={edit} prefill={{ full_name: edit.full_name, employee_code: edit.employee_code }} testPrefix="ekyc-form" submitLabel="Save changes" onSubmit={async (f) => { await api.put(`/admin/employee-kyc/${edit.employee_id}`, f); toast.success("KYC updated"); setEdit(null); load(); }} /></Modal>}
    </DashboardLayout>
  );
}
