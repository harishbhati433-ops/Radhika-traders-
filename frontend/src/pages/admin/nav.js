import { LayoutDashboard, Megaphone, Tag, Users, ArrowDownToLine, Image } from "lucide-react";

export const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/admin/banners", label: "Offer Banners", icon: Image },
  { to: "/admin/categories", label: "Categories", icon: Tag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
];
