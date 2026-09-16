import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { PasswordInput } from "../../components/PasswordInput";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password, portal: "admin" });
      if (data.user.role !== "admin") {
        toast.error("This login is for admins only.");
        setLoading(false);
        return;
      }
      loginWithToken(data.token, data.user);
      toast.success("Welcome, Admin!");
      nav("/admin");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Admin Access" subtitle="Restricted — Radhika Traders control panel">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-3 text-sm text-amber-300"><Lock className="h-4 w-4" /> Authorised personnel only</div>
        <div><Label>Admin Email</Label><Input data-testid="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" /></div>
        <div><Label>Password</Label><PasswordInput data-testid="admin-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" /></div>
        <button type="submit" data-testid="admin-submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white hover:brightness-125 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Login to Admin Panel
        </button>
      </form>
      <p className="mt-4 text-center text-sm"><Link to="/admin/forgot-password" className="font-semibold text-red-600 hover:underline" data-testid="admin-forgot-link">Forgot password?</Link></p>
      <p className="mt-3 text-center text-sm text-slate-500"><Link to="/login" className="font-semibold text-red-600 hover:underline">← Customer login</Link></p>
    </AuthShell>
  );
}
