import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { Send, Loader2, Mail, Bell, Search } from "lucide-react";

export default function AdminBroadcast() {
  const [customers, setCustomers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [history, setHistory] = useState([]);
  const [f, setF] = useState({ subject: "", message: "", audience: "all", user_ids: [], campaign_id: "", channels: ["email", "in_app"] });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const loadHistory = () => api.get("/admin/broadcasts").then(({ data }) => setHistory(data));
  useEffect(() => {
    api.get("/admin/customers").then(({ data }) => setCustomers(data));
    api.get("/campaigns", { params: { admin_view: true } }).then(({ data }) => setCampaigns(data));
    loadHistory();
  }, []);

  const pickCampaign = (id) => {
    const c = campaigns.find((x) => x.id === id);
    setF({ ...f, campaign_id: id, ...(c && !f.subject ? { subject: `🎉 New Campaign LIVE – ${c.offer_name}`, message: `${c.offer_name} is now LIVE!\nPayout: ₹${c.payout_amount}\nGrab the campaign and complete maximum eligible account openings.` } : {}) });
  };
  const toggleUser = (id) => setF({ ...f, user_ids: f.user_ids.includes(id) ? f.user_ids.filter((x) => x !== id) : [...f.user_ids, id] });
  const toggleChannel = (c) => setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] });

  const send = async (e) => {
    e.preventDefault();
    if (!f.channels.length) return toast.error("Select at least one channel");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/broadcast", f);
      toast.success(data.message);
      setF({ ...f, subject: "", message: "", user_ids: [] });
      setTimeout(loadHistory, 1500); setTimeout(loadHistory, 6000);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const filtered = customers.filter((c) => (c.name + c.email + c.mobile).toLowerCase().includes(q.toLowerCase()));

  return (
    <DashboardLayout nav={adminNav} title="Email & Notification Broadcast">
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={send} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-3" data-testid="broadcast-form">
          <div className="flex flex-wrap gap-2">
            {[["email", "Email", Mail], ["in_app", "Website 🔔", Bell]].map(([k, l, I]) => (
              <button type="button" key={k} onClick={() => toggleChannel(k)} data-testid={`broadcast-channel-${k}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${f.channels.includes(k) ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}><I className="h-3.5 w-3.5" /> {l}</button>
            ))}
          </div>
          <div>
            <Label>Attach campaign (auto-adds campaign card + link)</Label>
            <select data-testid="broadcast-campaign" value={f.campaign_id} onChange={(e) => pickCampaign(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">— No campaign —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.offer_name} · ₹{c.payout_amount} · {c.status}</option>)}
            </select>
          </div>
          <div><Label>Subject</Label><Input data-testid="broadcast-subject" required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className="mt-1.5" placeholder="🎉 Good News! New Campaign is LIVE" /></div>
          <div><Label>Message</Label><textarea data-testid="broadcast-message" required rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Write your message for customers..." /></div>
          <div>
            <Label>Audience</Label>
            <div className="mt-1.5 flex gap-2">
              {[["all", `All customers (${customers.length})`], ["selected", `Selected (${f.user_ids.length})`]].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, audience: k })} data-testid={`broadcast-audience-${k}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${f.audience === k ? "bg-red-600 text-white" : "border border-slate-200 text-slate-600"}`}>{l}</button>
              ))}
            </div>
          </div>
          {f.audience === "selected" && (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="relative mb-2"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input data-testid="broadcast-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer..." className="pl-8" /></div>
              <div className="max-h-48 space-y-1 overflow-y-auto rt-scroll">
                {filtered.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" data-testid={`broadcast-user-${c.id}`} checked={f.user_ids.includes(c.id)} onChange={() => toggleUser(c.id)} />
                    <span className="font-medium text-slate-800">{c.name}</span><span className="text-xs text-slate-400">{c.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button type="submit" disabled={busy} data-testid="broadcast-send" className="rt-gradient-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Now
          </button>
        </form>

        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-bold text-slate-900">Sent History</h2>
          <div className="space-y-2" data-testid="broadcast-history">
            {history.length === 0 && <p className="text-sm text-slate-500">Nothing sent yet.</p>}
            {history.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm" data-testid={`broadcast-item-${b.id}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-slate-900">{b.subject}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.status === "sending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{b.status || "done"}</span></div>
                <div className="mt-1 text-xs text-slate-500">{b.kind === "campaign_live" ? "Auto · campaign live" : `Manual · ${b.audience}`} · {(b.created_at || "").slice(0, 16).replace("T", " ")}</div>
                <div className="mt-1 text-xs"><span className="text-slate-500">To {b.recipients}</span> · <span className="font-semibold text-emerald-600">{b.sent} sent</span>{b.failed > 0 && <> · <span className="font-semibold text-rose-600">{b.failed} failed</span></>}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
