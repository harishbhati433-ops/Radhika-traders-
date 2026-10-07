import { LayoutDashboard, Megaphone, Tag, Users, ArrowDownToLine, Image, ShieldCheck, ShieldAlert, Send, ClipboardList, Lock, FolderUp, Gift, UserCog, History, Wallet, Headphones, CalendarCheck, Camera, MailCheck } from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone, group: "Campaigns", perm: "campaigns" },
  { to: "/admin/banners", label: "Offer Banners", icon: Image, group: "Campaigns", perm: "campaigns" },
  { to: "/admin/categories", label: "Categories", icon: Tag, group: "Campaigns", perm: "campaigns" },
  { to: "/admin/customers", label: "Customers", icon: Users, group: "Customers", perm: "clients" },
  { to: "/admin/dedicated-referrals", label: "Dedicated Referral", icon: Gift, group: "Customers", adminOnly: true },
  { to: "/admin/leads", label: "Leads / Reports", icon: ClipboardList, group: "Customers", perm: "leads" },
  { to: "/admin/kyc", label: "KYC Management", icon: ShieldCheck, group: "Customers", perm: "clients" },
  { to: "/admin/suspicious-signups", label: "Suspicious Signups", icon: ShieldAlert, group: "Customers", adminOnly: true },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine, group: "Payments", perm: "withdrawals" },
  { to: "/admin/wallets", label: "Wallet Balances", icon: Wallet, group: "Payments", perm: "payments" },
  { to: "/admin/broadcast", label: "Broadcast", icon: Send, group: "Communication", perm: "reports" },
  { to: "/admin/reports", label: "Send Reports", icon: FolderUp, group: "Communication", perm: "reports" },
  { to: "/admin/email-log", label: "Email Log", icon: MailCheck, group: "Communication", adminOnly: true },
  { to: "/admin/employees", label: "Employees", icon: UserCog, group: "Team & HR", adminOnly: true },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: History, group: "Team & HR", adminOnly: true },
  { to: "/admin/contact", label: "Contact & Support", icon: Headphones, group: "Website & Settings", adminOnly: true },
  { to: "/admin/team", label: "Team Photos", icon: Camera, group: "Website & Settings", adminOnly: true },
  { to: "/admin/attendance", label: "Attendance & Salary", icon: CalendarCheck, group: "Team & HR", adminOnly: true },
  { to: "/admin/employee-kyc", label: "Employee KYC", icon: ShieldCheck, group: "Team & HR", adminOnly: true },
  { to: "/employee/attendance", label: "My Attendance", icon: CalendarCheck, employeeOnly: true },
  { to: "/employee/kyc", label: "My KYC", icon: ShieldCheck, employeeOnly: true },
  { to: "/admin/security", label: "Security / Password", icon: Lock, group: "Website & Settings", adminOnly: true },
];

export const ROUTE_PERM = Object.fromEntries(adminNav.filter((n) => n.perm).map((n) => [n.to, n.perm]));
