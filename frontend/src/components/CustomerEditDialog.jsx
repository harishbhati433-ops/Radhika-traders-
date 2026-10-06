import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import api, { formatApiErrorDetail } from "../lib/api";
import { formatPan, formatAadhaar, formatIfsc, panError, aadhaarError, ifscError, upiError } from "../lib/validators";
import { toast } from "sonner";
import { UserCog, Loader2, History, Mail, AlertTriangle } from "lucide-react";
import { IfscBankInfo } from "./IfscBankInfo";
import { useAuth } from "../context/AuthContext";

// Admin-only: change a customer's login email; the customer must verify the new email by OTP at next login.
function EmailField({ d, customerId, isAdmin, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pend = d.pending_email_verification;
  const save = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email");
    if (!window.confirm(`Change login email for ${d.name}?\n\n${d.email} → ${email.toLowerCase()}\n\nCustomer will be logged out and must verify the new email with an OTP at next login.`)) return;
    setBusy(true);
    try { const { data } = await api.put(`/admin/customers/${customerId}/email`, { new_email: email.trim(), reason }); toast.success(data.message); setEdit(false); setEmail(""); setReason(""); await onChanged(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <div className="flex items-center justify-between"><Label>Email (login)</Label>{isAdmin && !edit && <button type="button" onClick={() => setEdit(true)} data-testid="cust-edit-email-change" className="text-xs font-bold text-red-600 hover:underline">Change email</button>}</div>
      <Input value={d.email} disabled data-testid="cust-edit-email" className="mt-1.5 bg-slate-50" />
      {pend && <div className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800" data-testid="cust-edit-email-pending"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><b>Verification pending</b> — changed from {pend.old_email} on {fmt(pend.changed_at)} by {pend.changed_by}. Customer must enter the OTP sent to the new email at next login.</span></div>}
      {edit && (
        <div className="mt-2 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-3" data-testid="cust-edit-email-form">
          <div><Label className="text-xs">New email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="cust-edit-email-new" placeholder="new.email@gmail.com" className="mt-1 bg-white" autoFocus /></div>
          <div><Label className="text-xs">Reason (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cust-edit-email-reason" placeholder="Old Gmail blocked / password forgotten" className="mt-1 bg-white" /></div>
          <p className="text-[11px] text-slate-600">Customer is logged out everywhere; at next login an OTP goes to the new email and must be verified before continuing. A notice is sent to the old email.</p>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} data-testid="cust-edit-email-save" className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Update email</button>
            <button type="button" onClick={() => setEdit(false)} data-testid="cust-edit-email-cancel" className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [["profile", "Profile"], ["kyc", "KYC & Bank"], ["history", "Change Log"]];
const fmt = (iso) => (iso || "").slice(0, 16).replace("T", " ");
const KYC_LABELS = { pan: "PAN", aadhaar: "Aadhaar", bank_account: "Bank A/C", ifsc: "IFSC", upi: "UPI", account_holder: "Holder" };

export function CustomerEditDialog({ customerId, open, onClose, onDone, initialTab = "profile" }) {
  const { user: me } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [d, setD] = useState(null);
  const [p, setP] = useState({});
  const [k, setK] = useState({});
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/admin/customers/${customerId}/detail`).then(({ data }) => {
    setD(data);
    setP({ name: data.name || "", mobile: data.mobile || "", address: data.address || "", dob: data.dob || "" });
    setK({ account_holder: data.bank?.account_holder || data.name || "", pan: data.kyc?.pan || "", aadhaar: data.kyc?.aadhaar || "", bank_account: data.bank?.bank_account || "", ifsc: data.bank?.ifsc || "", upi: data.bank?.upi || "", upi_qr_url: data.bank?.upi_qr_url || "" });
  });
  useEffect(() => { if (open && customerId) { setTab(initialTab); load(); } }, [open, customerId, initialTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Save profile changes for ${d?.name}?`)) return;
    setBusy(true);
    try { await api.put(`/admin/customers/${customerId}/profile`, p); toast.success("Profile updated"); await load(); onDone?.(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const saveKyc = async (e) => {
    e.preventDefault();
    if (panError(k.pan)) return toast.error(panError(k.pan));
    if (aadhaarError(k.aadhaar)) return toast.error(aadhaarError(k.aadhaar));
    if (ifscError(k.ifsc) || !k.ifsc) return toast.error(ifscError(k.ifsc) || "IFSC code is required");
    if (upiError(k.upi)) return toast.error(upiError(k.upi));
    if (!window.confirm(`Save KYC / bank changes for ${d?.name}? Status stays Verified.`)) return;
    setBusy(true);
    try { await api.put(`/admin/customers/${customerId}/kyc`, k); toast.success("KYC updated"); await load(); onDone?.(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const inp = (obj, set, key, extra = {}) => <Input value={obj[key] || ""} onChange={(e) => set({ ...obj, [key]: e.target.value })} className="mt-1.5" {...extra} />;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="customer-edit-modal" className="max-h-[90vh] max-w-lg overflow-y-auto rt-scroll">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-red-600" /> Edit Customer — {d?.name || "…"}</DialogTitle></DialogHeader>
        <div className="flex gap-1.5">{TABS.map(([t, l]) => <button key={t} type="button" onClick={() => setTab(t)} data-testid={`cust-edit-tab-${t}`} className={`rounded-full px-3 py-1.5 text-xs font-bold ${tab === t ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>{l}</button>)}</div>
        {!d && <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>}
        {d && tab === "profile" && (
          <form onSubmit={saveProfile} className="space-y-3">
            <div><Label>Full Name</Label>{inp(p, setP, "name", { "data-testid": "cust-edit-name", required: true })}</div>
            <EmailField d={d} customerId={customerId} isAdmin={me?.role === "admin"} onChanged={async () => { await load(); onDone?.(); }} />
            <div><Label>Mobile</Label>{inp(p, setP, "mobile", { "data-testid": "cust-edit-mobile", inputMode: "numeric" })}</div>
            <div><Label>Address</Label>{inp(p, setP, "address", { "data-testid": "cust-edit-address" })}</div>
            <div><Label>Date of Birth</Label>{inp(p, setP, "dob", { "data-testid": "cust-edit-dob", type: "date" })}</div>
            <button type="submit" disabled={busy} data-testid="cust-edit-profile-save" className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save Profile</button>
          </form>
        )}
        {d && tab === "kyc" && (
          <form onSubmit={saveKyc} className="space-y-3">
            <div className="text-xs text-slate-500">Current KYC status: <b className="capitalize">{(d.kyc?.status || "not_submitted").replace("_", " ")}</b>. Saving keeps the customer <b>Verified</b>.</div>
            <div><Label>Account Holder</Label>{inp(k, setK, "account_holder", { "data-testid": "cust-edit-holder", required: true })}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PAN</Label><Input data-testid="cust-edit-pan" required maxLength={10} value={k.pan || ""} onChange={(e) => setK({ ...k, pan: formatPan(e.target.value) })} className={`mt-1.5 uppercase ${panError(k.pan) ? "border-rose-400" : ""}`} /></div>
              <div><Label>Aadhaar</Label><Input data-testid="cust-edit-aadhaar" inputMode="numeric" maxLength={12} value={k.aadhaar || ""} onChange={(e) => setK({ ...k, aadhaar: formatAadhaar(e.target.value) })} className={`mt-1.5 ${aadhaarError(k.aadhaar) ? "border-rose-400" : ""}`} /></div>
            </div>
            <div><Label>Bank Account Number</Label>{inp(k, setK, "bank_account", { "data-testid": "cust-edit-account", required: true })}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>IFSC</Label><Input data-testid="cust-edit-ifsc" required maxLength={11} value={k.ifsc || ""} onChange={(e) => setK({ ...k, ifsc: formatIfsc(e.target.value) })} className={`mt-1.5 uppercase ${ifscError(k.ifsc) ? "border-rose-400" : ""}`} placeholder="HDFC0001234" />{ifscError(k.ifsc) && <div className="mt-1 text-xs font-semibold text-rose-600" data-testid="cust-edit-ifsc-error">{ifscError(k.ifsc)}</div>}<IfscBankInfo ifsc={k.ifsc} testId="cust-edit-ifsc-bank" /></div>
              <div><Label>UPI ID</Label>{inp(k, setK, "upi", { "data-testid": "cust-edit-upi", placeholder: "name@upi" })}{upiError(k.upi) && <div className="mt-1 text-xs font-semibold text-rose-600">{upiError(k.upi)}</div>}</div>
            </div>
            <button type="submit" disabled={busy} data-testid="cust-edit-kyc-save" className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save KYC</button>
          </form>
        )}
        {d && tab === "history" && (
          <div className="space-y-4 text-sm" data-testid="cust-edit-history">
            <Section title="Login email changes" items={d.email_history} render={(h) => <div><span className="text-slate-500 line-through">{h.old_email}</span> → <b>{h.new_email}</b>{h.reason ? ` · ${h.reason}` : ""} · verified {fmt(h.verified_at)}</div>} byKey="changed_by" atKey="changed_at" />
            <Section title="Profile changes" items={d.profile_history} render={(h) => Object.entries(h.changes || {}).map(([f, c]) => <div key={f}><b className="capitalize">{f}</b>: <span className="text-slate-500 line-through">{c.from || "—"}</span> → <b>{c.to}</b></div>)} />
            <Section title="KYC changes" items={d.kyc_history} render={(h) => Object.keys(h.changes || {}).length ? Object.entries(h.changes).map(([f, c]) => <div key={f}><b>{KYC_LABELS[f] || f}</b>: <span className="text-slate-500 line-through">{c.from || "—"}</span> → <b>{c.to}</b></div>) : <div>KYC submitted · status {h.status}</div>} />
            <Section title="Wallet adjustments" items={d.wallet_adjustments} render={(a) => <div><b className="capitalize">{a.mode}</b> ₹{a.amount} · ₹{a.balance_before} → ₹{a.balance_after} · {a.reason}</div>} byKey="admin_email" atKey="created_at" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, items = [], render, byKey = "by", atKey = "at" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-600"><History className="h-3.5 w-3.5" /> {title}</div>
      {items.length === 0 ? <div className="text-xs text-slate-400">No changes yet.</div> : (
        <div className="space-y-1.5">{items.map((h, i) => <div key={i} className="rounded-lg bg-slate-50 p-2.5 text-xs"><div className="text-slate-800">{render(h)}</div><div className="mt-1 text-[11px] text-slate-400">{fmt(h[atKey])} · by {h[byKey] === "self" ? "customer" : h[byKey]}</div></div>)}</div>
      )}
    </div>
  );
}
