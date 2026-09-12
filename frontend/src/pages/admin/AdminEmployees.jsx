import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { MODULES } from "../../lib/perm";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { PasswordInput } from "../../components/PasswordInput";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, KeyRound, X, UserCog } from "lucide-react";

const LEVELS = [{ v: "none", l: "No access" }, { v: "view", l: "View" }, { v: "edit", l: "View + Edit" }];
const emptyPerms = () => Object.fromEntries(MODULES.map((m) => [m.key, "none"]));

function PermMatrix({ value, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="perm-matrix">
      {MODULES.map((m) => (
        <div key={m.key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
          <span className="text-sm font-semibold text-slate-800">{m.label}</span>
          <select data-testid={`perm-${m.key}`} value={value[m.key] || "none"} onChange={(e) => onChange({ ...value, [m.key]: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold">
            {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function EmployeeDialog({ emp, onClose, onSaved }) {
  const isEdit = !!emp;
  const [f, setF] = useState({ name: emp?.name || "", username: emp?.username || "", mobile: emp?.mobile || "", password: "", permissions: emp?.permissions || emptyPerms() });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (isEdit) {
        const body = { name: f.name, mobile: f.mobile, permissions: f.permissions };
        if (f.password) body.password = f.password;
        await api.patch(`/admin/employees/${emp.id}`, body);
        toast.success("Employee updated");
      } else {
        await api.post("/admin/employees", f);
        toast.success("Employee created");
      }
      onSaved(); onClose();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" data-testid="employee-dialog">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold">{isEdit ? "Edit employee" : "New employee"}</h3><button type="button" onClick={onClose} data-testid="employee-dialog-close"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Full name</Label><Input data-testid="emp-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="mt-1" /></div>
          <div><Label>Username</Label><Input data-testid="emp-username" required disabled={isEdit} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "") })} className="mt-1" placeholder="lowercase, e.g. rahul.k" /></div>
          <div><Label>Mobile (optional)</Label><Input data-testid="emp-mobile" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} className="mt-1" /></div>
          <div><Label>{isEdit ? "New password (leave blank to keep)" : "Password"}</Label><PasswordInput data-testid="emp-password" required={!isEdit} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="mt-1" /></div>
        </div>
        <div className="mt-4 mb-2 text-xs font-bold uppercase tracking-wider text-red-600">Role & permissions</div>
        <PermMatrix value={f.permissions} onChange={(p) => setF({ ...f, permissions: p })} />
        <button disabled={busy} data-testid="emp-save" className="mt-5 w-full rounded-full bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{isEdit ? "Save changes" : "Create employee"}</button>
      </form>
    </div>
  );
}

export default function AdminEmployees() {
  const [list, setList] = useState([]);
  const [dlg, setDlg] = useState(null);
  const load = () => api.get("/admin/employees").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const toggle = async (e) => {
    const status = e.account_status === "active" ? "disabled" : "active";
    try { await api.patch(`/admin/employees/${e.id}`, { status }); toast.success(`Employee ${status}`); load(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const resetPw = async (e) => {
    const pw = window.prompt(`New password for ${e.username} (min 6 chars):`);
    if (!pw) return;
    try { await api.patch(`/admin/employees/${e.id}`, { password: pw }); toast.success("Password reset"); load(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const del = async (e) => {
    if (!window.confirm(`Delete employee ${e.name} (${e.username})? Their activity logs will be kept.`)) return;
    try { await api.delete(`/admin/employees/${e.id}`); toast.success("Employee deleted"); load(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return (
    <DashboardLayout nav={adminNav} title="Employees">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Create team logins with module-wise permissions. Employees sign in at <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/employee/login</code>.</p>
        <button onClick={() => setDlg({ mode: "new" })} data-testid="emp-new-btn" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"><Plus className="h-4 w-4" /> New Employee</button>
      </div>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500" data-testid="emp-empty"><UserCog className="mx-auto mb-2 h-8 w-8 text-slate-300" />No employees yet.</div>
      ) : (
        <div className="grid gap-3">
          {list.map((e) => (
            <div key={e.id} data-testid={`emp-row-${e.id}`} className={`rounded-2xl border bg-white p-4 ${e.account_status === "active" ? "border-slate-200" : "border-rose-200 bg-rose-50/40"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-slate-900">{e.name}</span>
                    <span className="font-mono text-xs text-slate-500">@{e.username}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">{e.employee_code}</span>
                    <span data-testid={`emp-status-${e.id}`} className={`rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${e.account_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{e.account_status}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{e.mobile && <>Mobile {e.mobile} · </>}Last login: {e.last_login_at ? new Date(e.last_login_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "never"} · {e.activity_count} actions</div>
                  <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`emp-perms-${e.id}`}>
                    {MODULES.map((m) => { const v = e.permissions?.[m.key] || "none"; if (v === "none") return null; return <span key={m.key} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${v === "edit" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>{m.label}: {v === "edit" ? "Edit" : "View"}</span>; })}
                    {MODULES.every((m) => (e.permissions?.[m.key] || "none") === "none") && <span className="text-[11px] text-slate-400">No modules assigned</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDlg({ mode: "edit", emp: e })} data-testid={`emp-edit-${e.id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button onClick={() => resetPw(e)} data-testid={`emp-reset-${e.id}`} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><KeyRound className="h-3.5 w-3.5" /> Reset password</button>
                  <button onClick={() => toggle(e)} data-testid={`emp-toggle-${e.id}`} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white ${e.account_status === "active" ? "bg-amber-500" : "bg-emerald-500"}`}><Power className="h-3.5 w-3.5" /> {e.account_status === "active" ? "Disable" : "Enable"}</button>
                  <button onClick={() => del(e)} data-testid={`emp-delete-${e.id}`} className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1.5 text-xs font-bold text-white"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {dlg && <EmployeeDialog emp={dlg.emp} onClose={() => setDlg(null)} onSaved={load} />}
    </DashboardLayout>
  );
}
