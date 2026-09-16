import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { MailCheck, Loader2, Timer } from "lucide-react";
import { PasswordInput } from "./PasswordInput";
import { useAuth } from "../context/AuthContext";
import { useCountdown } from "../pages/auth/ForgotPassword";

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function OtpPasswordReset() {
  const { user, loginWithToken } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  useCountdown(expiresIn, setExpiresIn);
  useCountdown(resendIn, setResendIn);

  const send = async () => {
    setBusy("otp");
    try {
      const { data } = await api.post("/security/reset-password/otp");
      toast.success(data.message); setSent(true); setCode(""); setExpiresIn(data.expires_in || 300); setResendIn(data.resend_in || 60);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };
  const reset = async (e) => {
    e.preventDefault(); setBusy("reset");
    try {
      const { data } = await api.post("/security/reset-password", { code, new_password: pwd });
      loginWithToken(data.token, data.user);
      toast.success(data.message, { duration: 8000 });
      setSent(false); setCode(""); setPwd(""); setExpiresIn(0);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
      if (err.response?.status === 429) { setSent(false); setCode(""); }
    } finally { setBusy(""); }
  };

  return (
    <form onSubmit={reset} className="rounded-2xl border border-sky-200 bg-sky-50/50 p-6" data-testid="otp-password-reset">
      <div className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><MailCheck className="h-5 w-5 text-sky-600" /> Forgot password? Reset via OTP</div>
      <p className="mt-1 text-xs text-slate-600">Don't remember the current password? We'll send a 6-digit OTP to <b>{user?.email}</b> (valid 5 minutes). After reset, every other logged-in device is signed out automatically.</p>
      {!sent ? (
        <button type="button" onClick={send} disabled={busy === "otp"} data-testid="otp-reset-send" className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{busy === "otp" && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP to my email</button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700"><Timer className="h-3.5 w-3.5" /> OTP valid <b className={`font-mono ${expiresIn < 60 ? "text-red-600" : "text-slate-900"}`} data-testid="otp-reset-countdown">{expiresIn > 0 ? mmss(expiresIn) : "expired"}</b></span>
            <button type="button" onClick={send} disabled={busy === "otp" || resendIn > 0} data-testid="otp-reset-resend" className="font-bold text-sky-700 disabled:text-slate-400">{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button>
          </div>
          <div><Label>Email OTP</Label><Input data-testid="otp-reset-code" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1.5 text-center font-mono text-lg tracking-[0.4em]" placeholder="______" /></div>
          <div><Label>New password (min 8 chars)</Label><PasswordInput data-testid="otp-reset-password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} className="mt-1.5" /></div>
          <button type="submit" disabled={busy === "reset" || code.length !== 6} data-testid="otp-reset-submit" className="inline-flex items-center gap-2 rounded-full bg-sky-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{busy === "reset" && <Loader2 className="h-4 w-4 animate-spin" />} Set New Password</button>
          <p className="text-[11px] text-slate-500">5 wrong OTPs lock this for 15 minutes.</p>
        </div>
      )}
    </form>
  );
}
