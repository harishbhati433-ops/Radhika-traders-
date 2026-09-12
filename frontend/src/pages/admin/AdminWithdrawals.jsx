import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { PayoutDetails } from "../../components/PayoutDetails";
import { MarkPaidDialog } from "../../components/MarkPaidDialog";
import { celebrate } from "../../components/Celebration";
import { toast } from "sonner";
import { Check, X, IndianRupee, Receipt } from "lucide-react";
import { useCan } from "../../lib/perm";

const TABS = ["all", "pending", "approved", "paid", "rejected"];
const STATUS = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-sky-50 text-sky-700 border-sky-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function AdminWithdrawals() {
  const [tab, setTab] = useState("all");
  const [list, setList] = useState([]);
  const [paying, setPaying] = useState(null);
  const can = useCan("withdrawals");
  const [params] = useSearchParams();
  const highlight = params.get("highlight");

  const load = () => api.get("/admin/withdrawals", { params: tab === "all" ? {} : { status: tab } }).then(({ data }) => setList(data));
  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    if (!highlight || !list.length) return;
    const el = document.querySelector(`[data-testid="wd-row-${highlight}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlight, list]);

  const update = async (w, status, extra = {}) => {
    let note = "";
    if (status === "rejected") { note = window.prompt("Reason for rejection (optional):") || ""; }
    try { await api.patch(`/admin/withdrawals/${w.id}`, { status, admin_note: note, ...extra }); toast.success(`Marked ${status}`); setPaying(null); load(); if (["approved", "paid"].includes(status)) celebrate(`admin:${w.id}:${status}`); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <DashboardLayout nav={adminNav} title="Withdrawal Requests">
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`wd-tab-${t}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${tab === t ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 ? <p className="py-12 text-center text-slate-500" data-testid="wd-empty">No requests.</p> : list.map((w) => (
          <div key={w.id} data-testid={`wd-row-${w.id}`} className={`flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-white p-5 ${highlight === w.id ? "border-amber-400 ring-2 ring-amber-300 shadow-lg" : "border-slate-200"}`}>
            <div className="min-w-0 flex-1">
              {highlight === w.id && <div className="mb-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800" data-testid="wd-highlighted">From email alert</div>}
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-slate-900 flex items-center"><IndianRupee className="h-4 w-4" />{w.amount}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${STATUS[w.status]}`}>{w.status}</span>
              </div>
              <div className="text-sm font-semibold text-slate-700">{w.user_name} <span className="font-normal text-slate-400">· {w.user_email}</span></div>
              <div className="text-xs text-slate-500">Requested {(w.created_at || "").slice(0, 10)}</div>
              {w.admin_note && <div className="text-xs text-rose-500">Note: {w.admin_note}</div>}
              {w.status === "paid" && (w.proof_url || w.utr) && (
                <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
                  <Receipt className="h-3.5 w-3.5" /> {w.utr && <span>UTR {w.utr}</span>}
                  {w.proof_url && <a href={fileUrl(w.proof_url)} target="_blank" rel="noreferrer" className="font-semibold underline" data-testid={`wd-proof-link-${w.id}`}>View proof</a>}
                </div>
              )}
              <PayoutDetails w={w} />
            </div>
            {can.edit && <div className="flex flex-wrap gap-2">
              {w.status === "pending" && <button onClick={() => update(w, "approved")} data-testid={`wd-approve-${w.id}`} className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> Approve</button>}
              {(w.status === "pending" || w.status === "approved") && <button onClick={() => setPaying(w)} data-testid={`wd-paid-${w.id}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white"><Check className="h-3.5 w-3.5" /> Mark Paid</button>}
              {w.status !== "paid" && w.status !== "rejected" && <button onClick={() => update(w, "rejected")} data-testid={`wd-reject-${w.id}`} className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"><X className="h-3.5 w-3.5" /> Reject</button>}
            </div>}
          </div>
        ))}
      </div>
      {paying && <MarkPaidDialog w={paying} onClose={() => setPaying(null)} onConfirm={(extra) => update(paying, "paid", extra)} />}
    </DashboardLayout>
  );
}
