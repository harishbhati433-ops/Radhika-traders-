import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import { SecuritySettings } from "../../components/SecuritySettings";
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
          <p className="mt-1 text-xs">Use a strong, unique password (min 8 chars, mix of letters, numbers & symbols). Never share it. If forgotten, use “Forgot Password” on the Admin Login page — an OTP will be sent to this email.</p>
        </div>
      </div>
      <SecuritySettings showTxn={false} />
    </DashboardLayout>
  );
}
