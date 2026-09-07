import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PasswordInput } from "../../components/PasswordInput";

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("If the email exists, an OTP was sent");
      setStep(2);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, code, new_password: newPassword });
      toast.success("Password reset! Please login.");
      nav("/login");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Reset failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle={step === 1 ? "We'll email you a verification code" : `Enter the code sent to ${email}`}>
      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <div><Label>Email</Label><Input data-testid="forgot-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="you@example.com" /></div>
          <button type="submit" data-testid="forgot-submit" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <div><Label>OTP Code</Label><Input data-testid="reset-otp" required value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} className="mt-1.5 text-center text-xl font-bold tracking-[0.4em]" placeholder="______" /></div>
          <div><Label>New Password</Label><PasswordInput data-testid="reset-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1.5" placeholder="New password" /></div>
          <button type="submit" data-testid="reset-submit" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Reset Password
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500"><Link to="/login" className="font-semibold text-red-600 hover:underline">← Back to login</Link></p>
    </AuthShell>
  );
}
