import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthShell } from "../../components/AuthShell";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import { Loader2, BadgeCheck } from "lucide-react";
import { PasswordInput } from "../../components/PasswordInput";
import { RememberMeCheckbox } from "../../components/RememberMeCheckbox";
import { loadRemembered, saveRemembered, clearRemembered } from "../../lib/rememberLogin";

const saved = () => loadRemembered("employee");

export default function EmployeeLogin() {
  const [username, setUsername] = useState(() => saved()?.identifier || "");
  const [password, setPassword] = useState(() => saved()?.password || "");
  const [remember, setRemember] = useState(() => !!saved());
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/employee/login", { username, password });
      if (remember) saveRemembered("employee", username, password); else clearRemembered("employee");
      loginWithToken(data.token, data.user);
      toast.success(`Welcome, ${data.user.name}`);
      nav("/employee");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell showInstall={false} title="Employee Login" subtitle="Radhika Traders team workspace">
      <form onSubmit={submit} className="space-y-4" data-testid="employee-login-form">
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-3 text-sm text-amber-300"><BadgeCheck className="h-4 w-4" /> Use the username given by your Super Admin</div>
        <div><Label>Username</Label><Input data-testid="employee-username" autoCapitalize="none" required value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} className="mt-1.5" placeholder="e.g. rahul.k" /></div>
        <div><Label>Password</Label><PasswordInput data-testid="employee-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" /></div>
        <RememberMeCheckbox checked={remember} onChange={setRemember} testId="employee-remember" />
        <button type="submit" data-testid="employee-submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white hover:brightness-125 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Login to Workspace
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">Forgot password? Ask your Super Admin to reset it.</p>
      <p className="mt-2 text-center text-sm text-slate-500"><Link to="/login" className="font-semibold text-red-600 hover:underline">Customer login</Link></p>
    </AuthShell>
  );
}
