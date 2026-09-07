import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";

export default function ForgotEmail() {
  const [f, setF] = useState({ mobile: "", pan: "", dob: "" });
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.pan && !f.dob) return toast.error("Enter your PAN number or Date of Birth");
    setBusy(true);
    try { const { data } = await api.post("/auth/recover-email", f); setResult(data.masked_email); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell title="Forgot Gmail / Email?" subtitle="Verify with your registered mobile number and PAN or Date of Birth">
      {result ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" data-testid="forgot-email-result">
          <Mail className="mx-auto h-8 w-8 text-emerald-600" />
          <div className="mt-2 text-sm text-emerald-800">Your registered email is</div>
          <div className="mt-1 font-mono text-xl font-bold text-slate-900" data-testid="forgot-email-masked">{result}</div>
          <p className="mt-3 text-xs text-slate-500">For your security only a masked email is shown. Use it to log in or reset your password.</p>
          <Link to="/login" data-testid="forgot-email-login" className="rt-gradient-btn mt-5 inline-flex rounded-full px-6 py-2.5 text-sm font-bold">Go to Login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" data-testid="forgot-email-form">
          <div><Label>Registered mobile number</Label><Input data-testid="forgot-email-mobile" required inputMode="numeric" maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "") })} className="mt-1.5" placeholder="10-digit mobile" /></div>
          <div><Label>PAN number</Label><Input data-testid="forgot-email-pan" value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} className="mt-1.5" placeholder="ABCDE1234F" /></div>
          <div className="text-center text-xs text-slate-400">— or —</div>
          <div><Label>Date of Birth</Label><Input data-testid="forgot-email-dob" type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} className="mt-1.5" /></div>
          <button type="submit" disabled={busy} data-testid="forgot-email-submit" className="rt-gradient-btn inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Recover Email</button>
          <p className="text-center text-xs text-slate-500">Remembered it? <Link to="/login" className="font-semibold text-red-600">Login</Link> · <Link to="/forgot-password" className="font-semibold text-red-600">Forgot Password</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
