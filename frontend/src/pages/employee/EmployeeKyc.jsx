import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "../admin/nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle, Loader2, Lock } from "lucide-react";

const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/, IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/, MOB_RE = /^[6-9]\d{9}$/, EMAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const EMPTY = { mobile: "", father_name: "", email: "", dob: "", address: "", aadhaar: "", pan: "", ifsc: "", bank_account: "", bank_account_confirm: "" };

export function validateKyc(f) {
  const e = {};
  if (!MOB_RE.test(f.mobile.replace(/\D/g, ""))) e.mobile = "10-digit mobile starting with 6–9";
  if (!f.father_name.trim()) e.father_name = "Required";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Valid Gmail / email required";
  if (!f.dob) e.dob = "Required"; else { const a = (Date.now() - new Date(f.dob)) / 31557600000; if (a < 18 || a > 80) e.dob = "Age must be 18–80"; }
  if (f.address.trim().length < 10) e.address = "Full address (min 10 characters)";
  if (!/^[2-9]\d{11}$/.test(f.aadhaar.replace(/\s/g, ""))) e.aadhaar = "12 digits, cannot start with 0/1";
  if (!PAN_RE.test(f.pan.toUpperCase())) e.pan = "Format ABCPE1234F"; else if (f.pan.toUpperCase()[3] !== "P") e.pan = "4th letter must be P (individual PAN)";
  if (!IFSC_RE.test(f.ifsc.toUpperCase())) e.ifsc = "Format HDFC0001234";
  if (!/^\d{9,18}$/.test(f.bank_account.replace(/\s/g, ""))) e.bank_account = "9–18 digits";
  if (f.bank_account_confirm.replace(/\s/g, "") !== f.bank_account.replace(/\s/g, "")) e.bank_account_confirm = "Does not match";
  return e;
}

export function KycField({ id, label, error, children, hint }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">{label}{children}
      {error ? <span className="mt-0.5 block text-[11px] font-semibold text-rose-600" data-testid={`${id}-error`}>{error}</span> : hint ? <span className="mt-0.5 block text-[10px] font-normal text-slate-400" data-testid={`${id}-hint`}>{hint}</span> : null}
    </label>
  );
}

export function KycForm({ init, prefill, onSubmit, submitLabel = "Submit KYC", testPrefix = "kyc" }) {
  const [f, setF] = useState({ ...EMPTY, ...init, mobile: init?.mobile || prefill?.mobile || "", email: init?.email || prefill?.email || "", bank_account_confirm: init?.bank_account || "" });
  const [touched, setTouched] = useState({});
  const [ifscInfo, setIfscInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const errs = validateKyc(f);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const blur = (k) => () => setTouched({ ...touched, [k]: true });
  useEffect(() => {
    const code = f.ifsc.toUpperCase();
    if (!IFSC_RE.test(code)) return setIfscInfo(null);
    const t = setTimeout(() => api.get(`/ifsc/${code}`).then(({ data }) => setIfscInfo(data)).catch(() => setIfscInfo(null)), 400);
    return () => clearTimeout(t);
  }, [f.ifsc]);
  const cls = (k) => `mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 ${touched[k] && errs[k] ? "border-rose-400 bg-rose-50" : "border-slate-300 bg-white"}`;
  const submit = async (e) => {
    e.preventDefault(); setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])));
    if (Object.keys(errs).length) return toast.error("Please fix the highlighted fields");
    if (ifscInfo && ifscInfo.available === false && ["invalid_format", "not_found"].includes(ifscInfo.reason)) return toast.error("IFSC code not found — check your passbook");
    setBusy(true);
    try { await onSubmit({ ...f, pan: f.pan.toUpperCase(), ifsc: f.ifsc.toUpperCase() }); } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); } finally { setBusy(false); }
  };
  const E = (k) => (touched[k] ? errs[k] : "");
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid={`${testPrefix}-form`}>
      <KycField id={`${testPrefix}-name`} label="Full Name (auto)"><input value={prefill?.full_name || init?.full_name || ""} readOnly data-testid={`${testPrefix}-name`} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700" /></KycField>
      <KycField id={`${testPrefix}-code`} label="Employee Code (auto)"><input value={prefill?.employee_code || init?.employee_code || ""} readOnly data-testid={`${testPrefix}-code`} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-sm font-semibold text-slate-700" /></KycField>
      <KycField id={`${testPrefix}-mobile`} label="Mobile Number" error={E("mobile")}><input inputMode="numeric" maxLength={10} value={f.mobile} onChange={set("mobile")} onBlur={blur("mobile")} data-testid={`${testPrefix}-mobile`} className={cls("mobile")} placeholder="9876543210" /></KycField>
      <KycField id={`${testPrefix}-father`} label="Father's Name" error={E("father_name")}><input value={f.father_name} onChange={set("father_name")} onBlur={blur("father_name")} data-testid={`${testPrefix}-father`} className={cls("father_name")} /></KycField>
      <KycField id={`${testPrefix}-email`} label="Gmail ID" error={E("email")}><input type="email" value={f.email} onChange={set("email")} onBlur={blur("email")} data-testid={`${testPrefix}-email`} className={cls("email")} placeholder="name@gmail.com" /></KycField>
      <KycField id={`${testPrefix}-dob`} label="Date of Birth" error={E("dob")}><input type="date" value={f.dob} onChange={set("dob")} onBlur={blur("dob")} data-testid={`${testPrefix}-dob`} className={cls("dob")} max={new Date().toISOString().slice(0, 10)} /></KycField>
      <div className="sm:col-span-2"><KycField id={`${testPrefix}-address`} label="Full Address" error={E("address")}><textarea rows={2} value={f.address} onChange={set("address")} onBlur={blur("address")} data-testid={`${testPrefix}-address`} className={cls("address")} /></KycField></div>
      <KycField id={`${testPrefix}-aadhaar`} label="Aadhaar Number" error={E("aadhaar")} hint="12 digits — checksum verified on submit"><input inputMode="numeric" maxLength={14} value={f.aadhaar} onChange={set("aadhaar")} onBlur={blur("aadhaar")} data-testid={`${testPrefix}-aadhaar`} className={`${cls("aadhaar")} font-mono`} placeholder="2345 6789 0123" /></KycField>
      <KycField id={`${testPrefix}-pan`} label="PAN Number" error={E("pan")}><input maxLength={10} value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} onBlur={blur("pan")} data-testid={`${testPrefix}-pan`} className={`${cls("pan")} font-mono uppercase`} placeholder="ABCPE1234F" /></KycField>
      <KycField id={`${testPrefix}-ifsc`} label="IFSC Code" error={E("ifsc")} hint={ifscInfo?.available ? `✓ ${ifscInfo.bank} — ${ifscInfo.branch}` : ifscInfo && ifscInfo.available === false && ifscInfo.reason === "not_found" ? "✗ IFSC not found" : "Bank & branch will be auto-detected"}><input maxLength={11} value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} onBlur={blur("ifsc")} data-testid={`${testPrefix}-ifsc`} className={`${cls("ifsc")} font-mono uppercase`} placeholder="HDFC0001234" /></KycField>
      <div />
      <KycField id={`${testPrefix}-account`} label="Bank Account Number" error={E("bank_account")}><input inputMode="numeric" maxLength={18} value={f.bank_account} onChange={set("bank_account")} onBlur={blur("bank_account")} data-testid={`${testPrefix}-account`} className={`${cls("bank_account")} font-mono`} /></KycField>
      <KycField id={`${testPrefix}-account2`} label="Confirm Account Number" error={E("bank_account_confirm")}><input inputMode="numeric" maxLength={18} value={f.bank_account_confirm} onChange={set("bank_account_confirm")} onBlur={blur("bank_account_confirm")} onPaste={(e) => e.preventDefault()} data-testid={`${testPrefix}-account2`} className={`${cls("bank_account_confirm")} font-mono`} /></KycField>
      <div className="sm:col-span-2"><button type="submit" disabled={busy} data-testid={`${testPrefix}-submit`} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}</button></div>
    </form>
  );
}

const STATUS = { pending: ["Pending verification", "bg-amber-100 text-amber-800", Clock], verified: ["Verified", "bg-emerald-100 text-emerald-800", ShieldCheck], rejected: ["Rejected — please correct & resubmit", "bg-rose-100 text-rose-800", XCircle] };

export default function EmployeeKyc() {
  const [d, setD] = useState(null);
  const [editing, setEditing] = useState(false);
  const load = () => api.get("/employee/kyc", { noCache: true }).then(({ data }) => { setD(data); setEditing(false); }).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); }, []);
  if (!d) return <DashboardLayout nav={adminNav} title="My KYC"><div className="p-6 text-sm text-slate-500">Loading…</div></DashboardLayout>;
  const k = d.kyc;
  const [label, color, Icon] = STATUS[k?.status] || [];
  const showForm = !k || editing || k.status === "rejected";
  return (
    <DashboardLayout nav={adminNav} title="My KYC">
      {k && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5" data-testid="kyc-status-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${color}`} data-testid="kyc-status"><Icon className="h-4 w-4" /> {label}</div>
            {k.status === "pending" && k.enabled !== false && !editing && <button onClick={() => setEditing(true)} data-testid="kyc-edit-btn" className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit details</button>}
            {k.status === "verified" && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="h-3 w-3" /> Locked — contact admin to change</span>}
          </div>
          {k.status === "rejected" && k.rejection_reason && <p className="mt-2 text-sm text-rose-700" data-testid="kyc-reject-reason">Reason: {k.rejection_reason}</p>}
          {k.enabled === false && <p className="mt-2 text-sm text-rose-700" data-testid="kyc-disabled-note">KYC is disabled for your account by the admin.</p>}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
            <dt>Name</dt><dd className="font-semibold text-slate-900 sm:col-span-2">{k.full_name} · <span className="font-mono">{k.employee_code}</span></dd>
            <dt>Mobile / Email</dt><dd className="sm:col-span-2">{k.mobile} · {k.email}</dd>
            <dt>Father / DOB</dt><dd className="sm:col-span-2">{k.father_name} · {k.dob}</dd>
            <dt>Aadhaar / PAN</dt><dd className="font-mono sm:col-span-2">{k.aadhaar_masked} · {k.pan}</dd>
            <dt>Bank</dt><dd className="sm:col-span-2">{k.bank_name} {k.branch && `— ${k.branch}`} · <span className="font-mono">{k.ifsc}</span> · A/c <span className="font-mono">{k.account_masked}</span></dd>
            <dt>Address</dt><dd className="sm:col-span-2">{k.address}</dd>
          </dl>
        </div>
      )}
      {showForm && k?.enabled !== false && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-1 font-display text-lg font-bold text-slate-900">{k ? "Update KYC details" : "Complete your KYC"}</h3>
          <p className="mb-4 text-xs text-slate-500">Name and Employee Code are filled automatically. Aadhaar, PAN and IFSC are validated — invalid numbers cannot be submitted. Admin will verify your details.</p>
          <KycForm init={k || {}} prefill={d.prefill} onSubmit={async (f) => { await api.post("/employee/kyc", f); toast.success("KYC submitted — waiting for admin verification"); load(); }} submitLabel={k ? "Resubmit KYC" : "Submit KYC"} />
        </div>
      )}
    </DashboardLayout>
  );
}
