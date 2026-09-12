import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "../admin/nav";
import { useAuth } from "../../context/AuthContext";
import api, { formatApiErrorDetail } from "../../lib/api";
import { PasswordInput } from "../../components/PasswordInput";
import { toast } from "sonner";
import { Eye, Pencil, KeyRound, History } from "lucide-react";

function ChangePassword() {
  const [f, setF] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.new_password !== f.confirm) return toast.error("New passwords do not match");
    setBusy(true);
    try {
      await api.post("/employee/change-password", { current_password: f.current_password, new_password: f.new_password });
      toast.success("Password changed"); setF({ current_password: "", new_password: "", confirm: "" });
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="emp-change-password">
      <div className="mb-3 flex items-center gap-2 font-display font-bold text-slate-900"><KeyRound className="h-4 w-4 text-red-600" /> Change my password</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <PasswordInput data-testid="emp-pw-current" placeholder="Current password" required value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
        <PasswordInput data-testid="emp-pw-new" placeholder="New password (min 6)" required value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} />
        <PasswordInput data-testid="emp-pw-confirm" placeholder="Confirm new password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      </div>
      <button disabled={busy} data-testid="emp-pw-save" className="mt-3 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">Update password</button>
    </form>
  );
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [acts, setActs] = useState([]);
  useEffect(() => { api.get("/employee/my-activity").then(({ data }) => setActs(data)).catch(() => {}); }, []);
  const perms = user?.permissions || {};
  const tiles = adminNav.filter((n) => n.perm && perms[n.perm] && perms[n.perm] !== "none");

  return (
    <DashboardLayout nav={adminNav} title={`Hello, ${user?.name?.split(" ")[0] || "Team"}`}>
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white" data-testid="emp-welcome">
        <div className="text-xs uppercase tracking-wider text-amber-300">Employee workspace · {user?.employee_code || user?.username}</div>
        <div className="mt-1 text-sm text-slate-200">You can access only the modules assigned by the Super Admin. Every action you take is recorded in the activity log.</div>
      </div>
      {tiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500" data-testid="emp-no-modules">No modules assigned yet. Please contact the Super Admin.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="emp-modules">
          {tiles.map((t) => {
            const Icon = t.icon; const lvl = perms[t.perm];
            return (
              <Link key={t.to} to={t.to} data-testid={`emp-tile-${t.perm}-${t.to.replace(/\//g, "-")}`} className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md">
                <div className="mb-3 inline-flex rounded-xl bg-red-600 p-2.5 text-white"><Icon className="h-5 w-5" /></div>
                <div className="font-display font-bold text-slate-900">{t.label}</div>
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${lvl === "edit" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                  {lvl === "edit" ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {lvl === "edit" ? "View & Edit" : "View only"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChangePassword />
        <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="emp-recent-activity">
          <div className="mb-3 flex items-center gap-2 font-display font-bold text-slate-900"><History className="h-4 w-4 text-red-600" /> My recent activity</div>
          {acts.length === 0 ? <div className="text-sm text-slate-500">No activity yet.</div> : (
            <div className="max-h-72 space-y-1 overflow-auto">
              {acts.map((a) => <div key={a.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs"><span><b>{a.action.replace(/_/g, " ")}</b> {a.entity_label || a.entity_id} {a.status && <span className="text-slate-500">· {a.status}</span>}</span><span className="shrink-0 font-mono text-slate-400">{new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" })}</span></div>)}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
