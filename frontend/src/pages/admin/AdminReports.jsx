import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { FileUp, Loader2, Send, Trash2, Users, Clock, Download } from "lucide-react";

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

export default function AdminReports() {
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [f, setF] = useState({ title: "", note: "", audience: "all", user_ids: [], send_email: true });
  const [file, setFile] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/reports").then(({ data }) => setList(data));
  useEffect(() => { load(); api.get("/admin/customers").then(({ data }) => setCustomers(data)); }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please choose a file to send");
    if (f.audience === "selected" && f.user_ids.length === 0) return toast.error("Select at least one publisher");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("title", f.title); fd.append("note", f.note); fd.append("audience", f.audience);
      fd.append("user_ids", f.user_ids.join(",")); fd.append("send_email", f.send_email ? "true" : "false");
      const { data } = await api.post("/admin/reports", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(data.message); setF({ title: "", note: "", audience: "all", user_ids: [], send_email: true }); setFile(null); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const del = async (r) => { if (!window.confirm(`Delete "${r.title}" for everyone?`)) return; await api.delete(`/admin/reports/${r.id}`); toast.success("Deleted"); load(); };
  const toggle = (id) => setF({ ...f, user_ids: f.user_ids.includes(id) ? f.user_ids.filter((x) => x !== id) : [...f.user_ids, id] });
  const shown = customers.filter((c) => !q || `${c.name} ${c.email} ${c.mobile} ${c.referral_code}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <DashboardLayout nav={adminNav} title="Send Reports to Publishers">
      <p className="mb-4 text-sm text-slate-500">Upload any file (Excel, CSV, PDF, statement, photo…) and send it to all publishers or selected ones. It appears in their <b>Reports</b> page and is emailed. Files auto-delete after <b>7 days</b>.</p>
      <form onSubmit={send} className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-2" data-testid="report-form">
        <div><Label>Report title *</Label><Input data-testid="report-title" required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Weekly Payout Statement – 1 to 7 June" className="mt-1.5" /></div>
        <div>
          <Label>File * (any type, max 25 MB)</Label>
          <label className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-50">
            <FileUp className="h-4 w-4 text-red-600" /><span className="truncate text-slate-700" data-testid="report-file-name">{file ? `${file.name} (${fmtSize(file.size)})` : "Choose file…"}</span>
            <input type="file" hidden data-testid="report-file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="lg:col-span-2"><Label>Message / note (optional)</Label><textarea data-testid="report-note" rows={2} maxLength={1000} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Short note shown with the file and in the email" /></div>
        <div className="lg:col-span-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" data-testid="report-audience-all" checked={f.audience === "all"} onChange={() => setF({ ...f, audience: "all" })} /> All publishers ({customers.length})</label>
          <label className="flex items-center gap-2"><input type="radio" data-testid="report-audience-selected" checked={f.audience === "selected"} onChange={() => setF({ ...f, audience: "selected" })} /> Selected publishers {f.user_ids.length > 0 && <b>({f.user_ids.length})</b>}</label>
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" data-testid="report-send-email" checked={f.send_email} onChange={(e) => setF({ ...f, send_email: e.target.checked })} /> Also send by email</label>
        </div>
        {f.audience === "selected" && (
          <div className="lg:col-span-2 rounded-xl border border-slate-200 p-3" data-testid="report-recipients">
            <Input placeholder="Search publisher by name / email / mobile / code" value={q} onChange={(e) => setQ(e.target.value)} data-testid="report-recipient-search" className="mb-2" />
            <div className="max-h-48 space-y-1 overflow-y-auto rt-scroll">
              {shown.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                  <input type="checkbox" data-testid={`report-recipient-${c.id}`} checked={f.user_ids.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span className="font-semibold text-slate-800">{c.name}</span><span className="text-xs text-slate-500">{c.email} · {c.referral_code}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={busy} data-testid="report-send" className="rt-gradient-btn inline-flex w-fit items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send report
        </button>
      </form>

      <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Sent reports <span className="text-sm font-normal text-slate-500">(auto-delete after 7 days)</span></h2>
      <div className="space-y-2" data-testid="report-list">
        {list.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" data-testid="report-empty">No reports sent yet.</div>}
        {list.map((r) => (
          <div key={r.id} data-testid={`report-row-${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">{r.title}</div>
              <div className="text-xs text-slate-500">{r.file_name} · {fmtSize(r.size)} · {(r.created_at || "").slice(0, 10)}</div>
              {r.note && <div className="mt-1 text-xs text-slate-600">{r.note}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold text-slate-700"><Users className="h-3 w-3" /> {r.audience === "all" ? "All publishers" : `${r.recipient_count} selected`}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700"><Download className="h-3 w-3" /> {r.download_count} downloads</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${daysLeft(r.expires_at) <= 1 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`} data-testid={`report-expiry-${r.id}`}><Clock className="h-3 w-3" /> {daysLeft(r.expires_at)} day{daysLeft(r.expires_at) === 1 ? "" : "s"} left</span>
              <button onClick={() => del(r)} data-testid={`report-delete-${r.id}`} className="rounded-full border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
