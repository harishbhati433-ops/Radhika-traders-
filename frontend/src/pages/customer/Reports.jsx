import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import api from "../../lib/api";
import { toast } from "sonner";
import { FolderDown, Download, Clock, FileSpreadsheet, FileText, Image as ImageIcon, File, CheckCircle2, Loader2 } from "lucide-react";

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));
const icon = (ct = "", name = "") => {
  const n = name.toLowerCase();
  if (ct.includes("sheet") || ct.includes("csv") || /\.(xlsx?|csv)$/.test(n)) return [FileSpreadsheet, "bg-emerald-50 text-emerald-600"];
  if (ct.includes("pdf") || n.endsWith(".pdf")) return [FileText, "bg-rose-50 text-rose-600"];
  if (ct.startsWith("image/")) return [ImageIcon, "bg-sky-50 text-sky-600"];
  return [File, "bg-slate-100 text-slate-600"];
};

export default function Reports() {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api.get("/reports").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const download = async (r) => {
    setBusy(r.id);
    try {
      const res = await api.get(`/reports/${r.id}/download`, { responseType: "blob" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(res.data); a.download = r.file_name; a.click(); URL.revokeObjectURL(a.href);
      toast.success("Download started"); load();
    } catch { toast.error("File not available (it may have expired)"); }
    finally { setBusy(""); }
  };

  return (
    <DashboardLayout nav={customerNav} title="Reports & Files">
      <p className="mb-4 text-sm text-slate-500">Files shared with you by Radhika Traders — statements, reports, payout sheets. Each file is available for <b>7 days</b> from the date it is shared, then removed automatically.</p>
      <div className="space-y-2" data-testid="reports-list">
        {list && list.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500" data-testid="reports-empty"><FolderDown className="mx-auto mb-2 h-8 w-8 text-slate-300" /> No files shared with you right now.</div>}
        {(list || []).map((r) => { const [I, cls] = icon(r.content_type, r.file_name); const d = daysLeft(r.expires_at); return (
          <div key={r.id} data-testid={`report-item-${r.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className={`rounded-xl p-3 ${cls}`}><I className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">{r.title} {r.downloaded && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Downloaded</span>}</div>
              <div className="text-xs text-slate-500">{r.file_name} · {fmtSize(r.size)} · Shared {(r.created_at || "").slice(0, 10)}</div>
              {r.note && <div className="mt-1 text-xs text-slate-600">{r.note}</div>}
              <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-bold ${d <= 1 ? "text-rose-600" : "text-amber-700"}`} data-testid={`report-days-${r.id}`}><Clock className="h-3 w-3" /> {d <= 0 ? "Expires today" : `Available for ${d} more day${d === 1 ? "" : "s"}`}</div>
            </div>
            <button onClick={() => download(r)} disabled={busy === r.id} data-testid={`report-download-${r.id}`} className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60">
              {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
            </button>
          </div>); })}
      </div>
    </DashboardLayout>
  );
}
