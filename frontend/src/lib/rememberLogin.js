const KEY = (portal) => `rt_remember_${portal}`;

const enc = (s) => btoa(unescape(encodeURIComponent(s)));
const dec = (s) => decodeURIComponent(escape(atob(s)));

export function loadRemembered(portal) {
  try {
    const raw = localStorage.getItem(KEY(portal));
    if (!raw) return null;
    const { i, p } = JSON.parse(dec(raw));
    return { identifier: i || "", password: p || "" };
  } catch {
    return null;
  }
}

export function saveRemembered(portal, identifier, password) {
  try { localStorage.setItem(KEY(portal), enc(JSON.stringify({ i: identifier, p: password }))); } catch {}
}

export function clearRemembered(portal) {
  localStorage.removeItem(KEY(portal));
}
