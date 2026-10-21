const KEY = "rt-nav-stack";
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch { return []; } };
const write = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s.slice(-50))); } catch {} };

export const homeFor = (role) => (role === "admin" ? "/admin" : role === "employee" ? "/employee" : "/app/dashboard");

// Record each in-app page once (redirects / replace-navigations collapse into a single entry).
export function trackPage(path) {
  const s = read();
  if (s[s.length - 1] !== path) { s.push(path); write(s); }
}

// Pop exactly one previous page; fall back to the panel dashboard when none is available.
export function popPrevious(current, role) {
  const s = read();
  while (s.length && s[s.length - 1] === current) s.pop();
  const prev = s.length ? s[s.length - 1] : null;
  write(s);
  return prev || homeFor(role);
}
