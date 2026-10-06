import { LayoutDashboard, Megaphone, Wallet, ArrowDownToLine, FileText, User, ClipboardList, Award, FolderDown } from "lucide-react";

export const customerNav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/my-campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/app/my-leads", label: "My Leads", icon: ClipboardList },
  { to: "/app/wallet", label: "Wallet", icon: Wallet },
  { to: "/app/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/app/statements", label: "Statements", icon: FileText },
  { to: "/app/reports", label: "Reports & Files", icon: FolderDown },
  { to: "/app/welcome-letter", label: "Welcome Letter", icon: Award },
  { to: "/app/profile", label: "Profile & KYC", icon: User },
];
