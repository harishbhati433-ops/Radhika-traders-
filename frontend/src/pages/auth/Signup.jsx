import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export default function Signup() {
  const [step, setStep] = useState(1);
  const [params] = useSearchParams();
  const referredBy = (params.get("ref") || localStorage.getItem("rt_ref") || "").toUpperCase();
  if (params.get("ref")) localStorage.setItem("rt_ref", params.get("ref").toUpperCase());
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", address: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/register", { ...form, referred_by: referredBy });
      toast.success("OTP sent to your email");
      setStep(2);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Signup failed");
    } finally { setLoading(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", { email: form.email, code: otp });
      loginWithToken(data.token, data.user);
      toast.success("Account verified! Welcome 🎉");
      nav("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Verification failed");
    } finally { setLoading(false); }
  };

  const resend = async () => {
    try { await api.post("/auth/resend-otp", { email: form.email, purpose: "signup" }); toast.success("OTP resent"); }
    catch { toast.error("Could not resend"); }
  };

  return (
    <AuthShell title={step === 1 ? "Create your account" : "Verify your email"}
      subtitle={step === 1 ? (referredBy ? `Invited by partner ${referredBy} · Zero investment, free to join` : "Start earning with Radhika Traders — zero investment") : `Enter the 6-digit code sent to ${form.email}`}>
      {step === 1 ? (
        <form onSubmit={requestOtp} className="space-y-3.5">
          <div><Label>Full Name</Label><Input data-testid="signup-name" required value={form.name} onChange={set("name")} className="mt-1.5" placeholder="Your name" /></div>
          <div><Label>Email</Label><Input data-testid="signup-email" type="email" required value={form.email} onChange={set("email")} className="mt-1.5" placeholder="you@example.com" /></div>
          <div><Label>Mobile</Label><Input data-testid="signup-mobile" required value={form.mobile} onChange={set("mobile")} className="mt-1.5" placeholder="10-digit mobile" /></div>
          <div><Label>Password</Label><Input data-testid="signup-password" type="password" required value={form.password} onChange={set("password")} className="mt-1.5" placeholder="Create a password" /></div>
          <button type="submit" data-testid="signup-submit" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><ShieldCheck className="h-4 w-4" /> Check your inbox for the code.</div>
          <Input data-testid="signup-otp" required value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6}
            className="text-center text-2xl font-bold tracking-[0.5em]" placeholder="______" />
          <button type="submit" data-testid="signup-verify" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify & Continue
          </button>
          <div className="flex justify-between text-xs">
            <button type="button" onClick={() => setStep(1)} className="font-semibold text-slate-500 hover:underline">← Edit details</button>
            <button type="button" onClick={resend} data-testid="signup-resend" className="font-semibold text-red-600 hover:underline">Resend OTP</button>
          </div>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account? <Link to="/login" className="font-semibold text-red-600 hover:underline">Login</Link>
      </p>
    </AuthShell>
  );
}
