import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      nav(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Login to your Radhika Traders account">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-semibold text-red-600 hover:underline" data-testid="login-forgot-link">Forgot?</Link>
          </div>
          <Input id="password" data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" placeholder="••••••••" />
        </div>
        <button type="submit" data-testid="login-submit" disabled={loading} className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Login
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        New here? <Link to="/signup" className="font-semibold text-red-600 hover:underline" data-testid="login-to-signup">Create an account</Link>
      </p>
    </AuthShell>
  );
}
