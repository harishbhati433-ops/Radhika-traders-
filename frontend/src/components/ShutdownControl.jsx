import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { Power, Loader2, AlertTriangle, Clock } from "lucide-react";
import { fmtIST } from "../pages/MaintenancePage";

const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function ShutdownControl() {
  const [s, setS] = useState(null);
  const [message, setMessage] = useState("");
  const [reopen, setReopen] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/admin/shutdown").then(({ data }) => { setS(data); setMessage(data.message || ""); setReopen(toLocalInput(data.reopen_at)); });
  useEffect(() => { load(); }, []);

  const target = !s?.active;
  const submit = async () => {
    if (!password) return toast.error("Enter your admin password to confirm");
    setBusy(true);
    try {
      const { data } = await api.put("/admin/shutdown", { enabled: target, message, reopen_at: reopen ? new Date(reopen).toISOString() : "", password });
      toast.success(data.message); setConfirm(false); setPassword(""); await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!s) return null;
  return (
    <section className={`rounded-2xl border p-5 ${s.active ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`} data-testid="shutdown-control">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Power className={`h-5 w-5 ${s.active ? "text-rose-600" : "text-emerald-600"}`} /> Website Shutdown Switch</h2>
          <p className="mt-0.5 text-xs text-slate-600">Closes the whole customer website (login, dashboard, campaign links, signup). Admin panel keeps working. <b>No data is deleted</b> — turning it back ON restores everything instantly.</p>
        </div>
        <span data-testid="shutdown-status" className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${s.active ? "bg-rose-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>{s.active ? "Customers: CLOSED" : "Customers: OPEN"}</span>
      </div>
      {s.active && (
        <div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-700 ring-1 ring-rose-200" data-testid="shutdown-active-info">
          Closed since {fmtIST(s.since)} by {s.by}.{s.reopen_at ? <> Auto-reopens at <b>{fmtIST(s.reopen_at)}</b> (customers see this time + countdown).</> : " No reopen time set — stays closed until you switch it ON."}
        </div>
      )}
      {!confirm ? (
        <div className="mt-4 space-y-3">
          <div><Label>Message shown to customers</Label><Textarea data-testid="shutdown-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="mt-1.5" maxLength={400} /></div>
          <div><Label className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Website will open again at (optional — auto-reopens)</Label><Input data-testid="shutdown-reopen" type="datetime-local" value={reopen} onChange={(e) => setReopen(e.target.value)} className="mt-1.5 max-w-xs" />{reopen && <div className="mt-1 text-xs text-slate-500">Customers will see: "Website opens again at {fmtIST(new Date(reopen).toISOString())}"</div>}</div>
          <button onClick={() => setConfirm(true)} data-testid="shutdown-toggle" className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white ${target ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}><Power className="h-4 w-4" /> {target ? "Shut down customer website" : "Open website for customers"}</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="shutdown-confirm-box">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{target ? <>All customers will be logged out and the website will show "temporarily closed"{reopen ? <> with reopen time <b>{fmtIST(new Date(reopen).toISOString())}</b></> : ""}. Admin panel stays open. No data is deleted.</> : <>Website will open for all customers immediately.</>}</div>
          </div>
          <div><Label>Confirm with your admin password</Label><Input data-testid="shutdown-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 max-w-xs" autoFocus /></div>
          <div className="flex gap-2">
            <button onClick={() => { setConfirm(false); setPassword(""); }} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700">Cancel</button>
            <button onClick={submit} disabled={busy} data-testid="shutdown-confirm" className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${target ? "bg-rose-600" : "bg-emerald-600"}`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Yes, {target ? "shut down now" : "open now"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
