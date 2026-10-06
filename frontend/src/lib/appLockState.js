// Session-level unlock state: a fresh app open (new tab / PWA launch) or 5 min in background re-locks.
const IDLE_MS = 5 * 60 * 1000;
const key = (uid) => `rt_unlocked_${uid}`;

export const isUnlocked = (uid) => {
  try {
    const at = Number(sessionStorage.getItem(key(uid)) || 0);
    if (!at) return false;
    const hidden = Number(sessionStorage.getItem("rt_hidden_at") || 0);
    if (hidden && Date.now() - hidden > IDLE_MS && hidden > at) { sessionStorage.removeItem(key(uid)); return false; }
    return true;
  } catch { return false; }
};
export const markUnlocked = (uid) => { try { sessionStorage.setItem(key(uid), String(Date.now())); sessionStorage.removeItem("rt_hidden_at"); } catch {} };
export const relock = () => { try { Object.keys(sessionStorage).filter((k) => k.startsWith("rt_unlocked_")).forEach((k) => sessionStorage.removeItem(k)); } catch {} window.dispatchEvent(new Event("rt:lock")); };

let wired = false;
export const wireIdleLock = () => {
  if (wired) return; wired = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { try { sessionStorage.setItem("rt_hidden_at", String(Date.now())); } catch {} return; }
    const hidden = Number(sessionStorage.getItem("rt_hidden_at") || 0);
    if (hidden && Date.now() - hidden > IDLE_MS) relock(); else try { sessionStorage.removeItem("rt_hidden_at"); } catch {}
  });
};
