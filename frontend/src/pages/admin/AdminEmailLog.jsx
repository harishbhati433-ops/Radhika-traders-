import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Mail, RefreshCw, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

const FILTERS = [["", "All"], ["sent", "Sent"], ["queued", "Queued (auto-retry)"], ["failed", "Failed"]];
const PILL = {
  sent: ["bg-emerald-50 text-emerald-700", CheckCircle2, "Sent"],
  queued: ["bg-amber-50 text-amber-800", Clock, "Queued · auto-retry"],
  failed: ["bg-rose-50 text-rose-700", XCircle, "Failed"],
};

export default function AdminEmailLog() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const load = () => api.get("/admin/email-log", { params: { status: status || undefined, q: q || undefined }, noCache: true }).then(({ data }) => setData(data)).catch(() => setData({ items: [], sent_24h: 0, failed_24h: 0 }));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [status, q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardLayout nav={adminNav} title="Email Delivery Log">
      <div className="mb-5 grid gap-3 sm:grid-cols-3" data-testid="email-log-stats">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Last 24 h</div><div className="mt-1 font-mono text-2xl font-bold text-slate-900">{data ? data.sent_24h + data.failed_24h : "—"}</div><div className="text-[11px] text-slate-500">emails attempted</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Delivered</div><div className="mt-1 font-mono text-2xl font-bold text-emerald-800" data-testid="email-log-sent24">{data?.sent_24h ?? "—"}</div></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-rose-700">Failed</div><div className="mt-1 font-mono text-2xl font-bold text-rose-800" data-testid="email-log-failed24">{data?.failed_24h ?? "—"}</div><div className="text-[11px] text-rose-700">bad address / rejected — not retried</div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-amber-800">Waiting to retry</div><div className="mt-1 font-mono text-2xl font-bold text-amber-900" data-testid="email-log-queued">{data?.queued ?? "—"}</div><div className="text-[11px] text-amber-800">provider down/limit · auto re-send 5→10→15→30→60→120 min · campaign mails drip 6 per 5 min</div></div>
      </div>
      {data?.items?.[0]?.error?.includes("429") && data?.queued > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" data-testid="email-log-quota-banner">
          <b>Email provider limit reached (HTTP 429).</b> The shared email service has a daily sending quota. Nothing is lost — every email is waiting in the queue and will be delivered automatically as soon as the quota resets (checked every 5 minutes). One-to-one emails (OTP, payouts, attendance, leave) go first; campaign announcements drip slowly afterwards.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setStatus(k)} data-testid={`email-log-filter-${k || "all"}`} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === k ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{l}</button>)}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or subject…" data-testid="email-log-search" className="h-9 w-64" />
        <button onClick={load} data-testid="email-log-refresh" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </div>
      <p className="mb-3 text-xs text-slate-500">Every email the system sends (attendance, reminders, leave, salary, campaign status, OTP…) is recorded here with the exact provider response. Reminders that fail are retried automatically on the next 15-minute run.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {!data ? <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div> : data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500" data-testid="email-log-empty"><Mail className="mx-auto mb-2 h-6 w-6 text-slate-300" /> No emails match.</div>
        ) : (
          <table className="w-full text-left text-sm" data-testid="email-log-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time (IST)</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tries</th><th className="px-4 py-3">Error</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((e) => (
                <tr key={e.id} data-testid={`email-log-row-${e.id}`}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-800">{e.to}</td>
                  <td className="max-w-md truncate px-4 py-2.5 text-xs text-slate-700" title={e.subject}>{e.subject}</td>
                  <td className="px-4 py-2.5">{(() => { const [cls, Icon, label] = PILL[e.status] || PILL.failed; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}><Icon className="h-3 w-3" /> {label}</span>; })()}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{e.attempts}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 font-mono text-[11px] text-rose-700" title={e.error}>{e.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
