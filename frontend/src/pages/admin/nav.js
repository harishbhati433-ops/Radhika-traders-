import { LayoutDashboard, Megaphone, Tag, Users, ArrowDownToLine, Image, ShieldCheck, Send, ClipboardList, Lock, FolderUp, Gift, UserCog, History, Wallet, Headphones } from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone, perm: "campaigns" },
  { to: "/admin/banners", label: "Offer Banners", icon: Image, perm: "campaigns" },
  { to: "/admin/categories", label: "Categories", icon: Tag, perm: "campaigns" },
  { to: "/admin/customers", label: "Customers", icon: Users, perm: "clients" },
  { to: "/admin/dedicated-referrals", label: "Dedicated Referral", icon: Gift, adminOnly: true },
  { to: "/admin/leads", label: "Leads / Reports", icon: ClipboardList, perm: "leads" },
  { to: "/admin/kyc", label: "KYC Management", icon: ShieldCheck, perm: "clients" },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine, perm: "withdrawals" },
  { to: "/admin/wallets", label: "Wallet Balances", icon: Wallet, perm: "payments" },
  { to: "/admin/broadcast", label: "Broadcast", icon: Send, perm: "reports" },
  { to: "/admin/reports", label: "Send Reports", icon: FolderUp, perm: "reports" },
  { to: "/admin/employees", label: "Employees", icon: UserCog, adminOnly: true },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: History, adminOnly: true },
  { to: "/admin/contact", label: "Contact & Support", icon: Headphones, adminOnly: true },
  { to: "/admin/security", label: "Security / Password", icon: Lock, adminOnly: true },
];

export const ROUTE_PERM = Object.fromEntries(adminNav.filter((n) => n.perm).map((n) => [n.to, n.perm]));
