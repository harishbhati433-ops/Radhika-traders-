import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { SecuritySettings } from "../../components/SecuritySettings";
import { AppLockSettings } from "../../components/applock/AppLockSettings";
import { ShutdownControl } from "../../components/ShutdownControl";
import { useAuth } from "../../context/AuthContext";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { gateLink } from "../../lib/gate";

export default function AdminSecurity() {
  const { user } = useAuth();
  return (
    <DashboardLayout nav={adminNav} title="Admin Security">
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" data-testid="admin-security-notice">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <div className="font-bold">Admin account: {user?.email}</div>
          <p className="mt-1 text-xs">Use a strong, unique password (min 8 chars, mix of letters, numbers & symbols). Never share it. Forgot it? Use “Reset via OTP” below, or “Forgot password?” on the Admin Login page — a 5-minute OTP is sent to this Gmail and all other devices are logged out after reset.</p>
        </div>
      </div>
      <div className="mb-6"><ShutdownControl /></div>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5" data-testid="hidden-links-card">
        <div className="font-display text-base font-bold text-slate-900">Hidden panel links</div>
        <p className="mt-1 text-xs text-slate-500">/admin and /employee show "Page not found" until a device opens its secret link once. Share these links only with your team — never post them publicly.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[["Admin panel", gateLink("admin"), "hidden-link-admin"], ["Employee panel", gateLink("employee"), "hidden-link-employee"]].map(([l, url, tid]) => (
            <div key={tid} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{l}</div><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800" data-testid={tid}>{url}</code><button type="button" onClick={() => { navigator.clipboard?.writeText(url); toast.success("Link copied"); }} data-testid={`${tid}-copy`} className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:brightness-125">Copy</button></div></div>
          ))}
        </div>
      </div>
      <div className="mb-6"><AppLockSettings /></div>
      <SecuritySettings showTxn={false} />
    </DashboardLayout>
  );
}
