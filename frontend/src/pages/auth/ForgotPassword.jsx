import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Timer } from "lucide-react";
import { PasswordInput } from "../../components/PasswordInput";

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function useCountdown(seconds, setSeconds) {
  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds > 0, setSeconds]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function ForgotPassword({ portal = "customer" }) {
  const isAdmin = portal === "admin";
  const loginPath = isAdmin ? "/admin/login" : "/login";
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const nav = useNavigate();
  useCountdown(expiresIn, setExpiresIn);
  useCountdown(resendIn, setResendIn);

  const requestOtp = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email, portal });
      toast.success(data.message);
      setExpiresIn(data.expires_in || 300); setResendIn(data.resend_in || 60); setCode("");
      setStep(2);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { email, code, new_password: newPassword, portal });
      toast.success(data.message, { duration: 8000 });
      nav(loginPath);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Reset failed");
      if (err.response?.status === 429) { setStep(1); setCode(""); }
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title={isAdmin ? "Admin — Reset password" : "Reset password"} subtitle={step === 1 ? `We'll email a 6-digit OTP to your ${isAdmin ? "admin Gmail" : "registered email"} (valid 5 minutes)` : `Enter the OTP sent to ${email}`}>
      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-4">
          {isAdmin && <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-3 text-xs text-amber-300" data-testid="admin-forgot-notice"><ShieldCheck className="h-4 w-4" /> Owner / Super Admin account only. After reset, every logged-in device is signed out.</div>}
          <div><Label>{isAdmin ? "Admin Email" : "Email"}</Label><Input data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="you@gmail.com" /></div>
          <button type="submit" data-testid="forgot-submit" disabled={loading} className={`${isAdmin ? "bg-slate-900 text-white hover:brightness-125" : "rt-gradient-btn"} flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700"><Timer className="h-3.5 w-3.5" /> OTP valid for <b className={`font-mono ${expiresIn < 60 ? "text-red-600" : "text-slate-900"}`} data-testid="otp-countdown">{expiresIn > 0 ? mmss(expiresIn) : "expired"}</b></span>
            <button type="button" onClick={requestOtp} disabled={loading || resendIn > 0} data-testid="forgot-resend" className="font-bold text-red-600 disabled:text-slate-400">{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button>
          </div>
          <div><Label>OTP Code</Label><Input data-testid="reset-otp" required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="mt-1.5 text-center text-xl font-bold tracking-[0.4em]" placeholder="______" /></div>
          <div><Label>New Password (min 8 chars)</Label><PasswordInput data-testid="reset-password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5" placeholder="New password" /></div>
          <button type="submit" data-testid="reset-submit" disabled={loading || code.length !== 6} className={`${isAdmin ? "bg-slate-900 text-white hover:brightness-125" : "rt-gradient-btn"} flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Reset Password
          </button>
          <p className="text-center text-[11px] text-slate-500">5 wrong OTPs lock this for 15 minutes. All other devices will be logged out after reset.</p>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500"><Link to={loginPath} className="font-semibold text-red-600 hover:underline" data-testid="forgot-back-login">← Back to {isAdmin ? "admin " : ""}login</Link></p>
    </AuthShell>
  );
}
