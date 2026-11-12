// Hidden entry for staff panels. The secret slugs live only on the server; opening a valid one unlocks /admin or /employee on this device.
export const gateUrl = (portal) => (portal === "admin" ? "/admin/login" : "/employee/login");
const key = (portal) => `rt_gate_${portal}`;
export const hasGate = (portal) => { try { return localStorage.getItem(key(portal)) === "1"; } catch { return false; } };
export const grantGate = (portal) => { try { localStorage.setItem(key(portal), "1"); } catch {} };
export const isBot = () => /bot|crawl|spider|slurp|headlesschrome|lighthouse|googlebot|google-inspectiontool|adsbot|mediapartners|apis-google|feedfetcher|storebot|bingpreview|yandex|duckduck|baidu|facebookexternalhit|whatsapp|telegram|twitter|linkedin|discord/i.test(navigator.userAgent || "");
export const GATE_SLUG_RE = /^[A-Za-z0-9_-]{6,40}$/;
