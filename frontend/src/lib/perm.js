import { useAuth } from "../context/AuthContext";

export const MODULES = [
  { key: "leads", label: "Leads" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "campaigns", label: "Campaigns" },
  { key: "reports", label: "Reports" },
  { key: "clients", label: "Clients" },
  { key: "payments", label: "Payments" },
];

export function canUser(user, module, level = "view") {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "employee") return false;
  const have = user.permissions?.[module] || "none";
  return have === "edit" || (level === "view" && have === "view");
}

export function useCan(module) {
  const { user } = useAuth();
  return { view: canUser(user, module, "view"), edit: canUser(user, module, "edit"), isEmployee: user?.role === "employee", isAdmin: user?.role === "admin" };
}
