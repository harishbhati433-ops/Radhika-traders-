import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { SecuritySettings } from "../../components/SecuritySettings";
import { ShutdownControl } from "../../components/ShutdownControl";
import { useAuth } from "../../context/AuthContext";
import { ShieldAlert } from "lucide-react";

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
      <SecuritySettings showTxn={false} />
    </DashboardLayout>
  );
}
