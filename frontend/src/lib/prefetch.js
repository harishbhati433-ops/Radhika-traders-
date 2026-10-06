import { prefetchApi } from "./api";

const month = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);

// API calls each panel makes on mount (same url + params so the cache key matches).
const ROUTE_DATA = {
  "/admin": () => [["/admin/dashboard"], ["/settings/public"], ["/admin/attendance/dashboard"], ["/admin/signup-bonus/log"]],
  "/admin/customers": () => [["/admin/customers", { include_deleted: false, page: 1, limit: 50 }]],
  "/admin/kyc": () => [["/admin/kyc", { page: 1, limit: 25 }]],
  "/admin/withdrawals": () => [["/admin/withdrawals", { page: 1, limit: 50 }]],
  "/admin/leads": () => [["/campaigns", { admin_view: true }]],
  "/admin/wallets": () => [["/admin/wallets", { show: "holding" }]],
  "/admin/employees": () => [["/admin/employees"]],
  "/admin/attendance": () => [["/admin/attendance/dashboard"], ["/admin/attendance", { month: month() }]],
  "/admin/campaigns": () => [["/campaigns", { admin_view: true }]],
  "/admin/reports": () => [["/admin/reports"]],
  "/dashboard": () => [["/wallet"], ["/campaigns"], ["/settings/public"], ["/my-referrals"], ["/leaderboard"], ["/banners"]],
  "/wallet": () => [["/wallet"], ["/wallet/transactions"]],
  "/withdrawals": () => [["/wallet"], ["/withdrawals"], ["/settings/public"]],
  "/my-leads": () => [["/my-leads"]],
  "/my-campaigns": () => [["/campaigns"]],
  "/reports": () => [["/reports"]],
  "/welcome-letter": () => [["/me/welcome-letter"]],
  "/employee": () => [["/employee/my-activity"], ["/employee/attendance", { month: month() }]],
  "/employee/attendance": () => [["/employee/attendance", { month: month() }], ["/employee/salary"]],
  "/employee/kyc": () => [["/employee/kyc"]],
};

export const prefetchRoute = (path) => { const f = ROUTE_DATA[path]; return f ? prefetchApi(f()) : Promise.resolve(); };

const ROLE_ROUTES = {
  admin: ["/admin/customers", "/admin/kyc", "/admin/withdrawals", "/admin/wallets", "/admin/employees", "/admin/attendance", "/admin/campaigns"],
  employee: ["/employee/attendance", "/employee/kyc"],
  customer: ["/wallet", "/withdrawals", "/my-leads", "/my-campaigns", "/reports"],
};
// Background warm-up, one panel at a time so it never competes with what the user is looking at.
export const prefetchForRole = async (role) => { for (const r of ROLE_ROUTES[role] || []) await prefetchRoute(r); };
