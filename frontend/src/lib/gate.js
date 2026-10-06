// Hidden entry links for staff panels. /admin/* and /employee/* show "Page not found" on a device until its secret link is opened once.
export const GATES = { admin: "rt-control-hb27", employee: "rt-team-9k4e" };
export const gateUrl = (portal) => `/${GATES[portal]}`;
export const gateLink = (portal) => `${window.location.origin}${gateUrl(portal)}`;
const key = (portal) => `rt_gate_${portal}`;
export const hasGate = (portal) => { try { return localStorage.getItem(key(portal)) === "1"; } catch { return false; } };
export const grantGate = (portal) => { try { localStorage.setItem(key(portal), "1"); } catch {} };
