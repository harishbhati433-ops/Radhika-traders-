// One browser, three independent sessions: customer (/), employee (/employee/*), admin (/admin/*).
export const portalFromPath = (p = window.location.pathname) => (p.startsWith("/admin") ? "admin" : p.startsWith("/employee") ? "employee" : "customer");
export const currentPortal = () => portalFromPath();
export const tokenKey = (portal) => `rt_token_${portal}`;
export const userKey = (portal) => `rt_user_${portal}`;

// Staff may use either staff panel (employees with permissions open /admin/* pages), so admin and employee fall back to each other.
const FALLBACK = { admin: ["admin", "employee"], employee: ["employee", "admin"], customer: ["customer"] };

export const resolveBucket = (portal = currentPortal()) => {
  for (const b of FALLBACK[portal]) if (localStorage.getItem(tokenKey(b))) return b;
  return portal;
};
export const getToken = (portal = currentPortal()) => localStorage.getItem(tokenKey(resolveBucket(portal)));
export const getCachedUser = (portal = currentPortal()) => {
  try { const b = resolveBucket(portal); return localStorage.getItem(tokenKey(b)) ? JSON.parse(localStorage.getItem(userKey(b)) || "null") : null; } catch { return null; }
};
export const saveSession = (portal, token, user) => { localStorage.setItem(tokenKey(portal), token); localStorage.setItem(userKey(portal), JSON.stringify(user)); };
export const saveUser = (portal, user) => { const b = resolveBucket(portal); if (user) localStorage.setItem(userKey(b), JSON.stringify(user)); else localStorage.removeItem(userKey(b)); };
export const clearSession = (portal = currentPortal()) => { const b = resolveBucket(portal); localStorage.removeItem(tokenKey(b)); localStorage.removeItem(userKey(b)); };

// Migrate the old single shared session into the bucket of its role (one-time).
(() => {
  try {
    const t = localStorage.getItem("rt_token");
    if (!t) return;
    const u = JSON.parse(localStorage.getItem("rt_user") || "null");
    const b = u?.role === "admin" ? "admin" : u?.role === "employee" ? "employee" : "customer";
    if (!localStorage.getItem(tokenKey(b))) { localStorage.setItem(tokenKey(b), t); if (u) localStorage.setItem(userKey(b), JSON.stringify(u)); }
    localStorage.removeItem("rt_token"); localStorage.removeItem("rt_user");
  } catch {}
})();
