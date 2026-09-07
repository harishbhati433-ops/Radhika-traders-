import { LayoutDashboard, Megaphone, Wallet, ArrowDownToLine, FileText, User, ClipboardList, Award } from "lucide-react";

export const customerNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/my-leads", label: "My Leads", icon: ClipboardList },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { to: "/statements", label: "Statements", icon: FileText },
  { to: "/welcome-letter", label: "Welcome Letter", icon: Award },
  { to: "/profile", label: "Profile & KYC", icon: User },
];
