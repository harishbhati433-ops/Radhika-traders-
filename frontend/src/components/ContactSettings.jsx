import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { refreshContact } from "../lib/contact";
import { toast } from "sonner";
import { Phone, MessageCircle, Mail, Crown, Headphones, Loader2, Save, History, ShieldCheck } from "lucide-react";

const ICONS = { owner_mobile: Crown, support_mobile: Headphones, whatsapp_number: MessageCircle, support_email: Mail, owner_email: Crown };
const HINTS = {
  owner_mobile: "Shown as “Call Now” on the Contact page (Owner & Founder card).",
  support_mobile: "Main customer-care number — Footer, Contact page, customer panel support box.",
  whatsapp_number: "Website WhatsApp chat button, WhatsApp share messages, emails, posters, welcome letter.",
  support_email: "Everywhere the support email is shown — Footer, Contact page, login/signup help, emails.",
  owner_email: "Owner / Admin Gmail — receives withdrawal request alerts. Not shown publicly.",
};
const dt = (iso) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ContactSettings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  const load = () => Promise.all([api.get("/admin/contact"), api.get("/admin/contact/history")]).then(([{ data: d }, { data: h }]) => {
    setData(d); setForm(Object.fromEntries(d.fields.map((f) => [f.key, d[f.key]]))); setHistory(h.items);
  }).catch((err) => toast.error(formatApiErrorDetail(err.response?.data?.detail)));
  useEffect(() => { load(); }, []);

  const dirty = data && data.fields.some((f) => (form[f.key] || "").trim() !== data[f.key]);

  const save = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.put("/admin/contact", form);
      toast.success(`Updated ${res.changed.length} detail${res.changed.length === 1 ? "" : "s"} — live on the whole website now`);
      await refreshContact();
      await load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>;

  return (
    <div className="space-y-6" data-testid="contact-settings">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900" data-testid="contact-settings-notice">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div><b>Owner / Super Admin only.</b> Employees cannot view or change these details. Any change is applied instantly across the website, customer panel, WhatsApp button, share messages, emails and posters — and is recorded in the change log below.</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.fields.map((f) => {
          const Icon = ICONS[f.key];
          const changed = (form[f.key] || "").trim() !== data[f.key];
          return (
            <label key={f.key} className={`block rounded-2xl border bg-white p-4 transition-colors ${changed ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"}`} data-testid={`contact-field-${f.key}`}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5 text-red-600" /> {f.label}</div>
              <input type={f.kind === "email" ? "email" : "tel"} inputMode={f.kind === "email" ? "email" : "numeric"} maxLength={f.kind === "email" ? 120 : 10}
                value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: f.kind === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value })}
                data-testid={`contact-input-${f.key}`} placeholder={f.kind === "email" ? "name@gmail.com" : "10-digit mobile"}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm font-semibold text-slate-900 focus:border-red-500 focus:outline-none" />
              <div className="mt-1.5 text-[11px] text-slate-500">{HINTS[f.key]}</div>
              {changed && <div className="mt-1 text-[11px] font-bold text-amber-700" data-testid={`contact-changed-${f.key}`}>Was: {data[f.key]}</div>}
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-xs text-slate-500" data-testid="contact-last-updated">{data.updated_at ? <>Last updated {dt(data.updated_at)} by <b>{data.updated_by || "Admin"}</b></> : "Using default contact details — not changed yet."}</div>
        <button type="button" onClick={save} disabled={busy || !dirty} data-testid="contact-update-all"
          className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Update All Contact Details
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="contact-history">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800"><History className="h-4 w-4 text-red-600" /> Change history <span className="text-xs font-semibold text-slate-400">({history.length})</span></div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Date &amp; Time (IST)</th><th className="p-3">Changed By</th><th className="p-3">Field</th><th className="p-3">Previous</th><th className="p-3">New</th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400" data-testid="contact-history-empty">No changes yet.</td></tr>}
            {history.map((h, i) => (
              <tr key={`${h.created_at}-${h.field}-${i}`} className="border-t border-slate-100" data-testid={`contact-history-row-${i}`}>
                <td className="whitespace-nowrap p-3 font-mono text-slate-600">{dt(h.created_at)}</td>
                <td className="p-3 font-semibold text-slate-900">{h.changed_by || "Admin"}</td>
                <td className="p-3 text-slate-700">{h.label}</td>
                <td className="p-3 font-mono text-rose-700 line-through">{h.old}</td>
                <td className="p-3 font-mono font-bold text-emerald-700">{h.new}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
