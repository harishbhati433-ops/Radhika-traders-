import api from "./api";

const SOUND_KEY = "rt_push_sound";
export const SOUNDS = [["chime", "Chime"], ["bell", "Bell"], ["pop", "Pop"]];

export const isPushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const isIosBrowser = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches && !navigator.standalone;

const toKey = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export async function getPushState() {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? "on" : "off";
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error("This browser does not support push alerts");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission was not granted. Allow notifications in browser settings.");
  const reg = await navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
  const { data } = await api.get("/push/vapid-public-key");
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.key) }));
  await api.post("/push/subscribe", { subscription: sub.toJSON(), device: navigator.userAgent.slice(0, 180) });
  return sub;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return;
  await api.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}

export const getSound = () => localStorage.getItem(SOUND_KEY) || "chime";
export const setSound = (s) => localStorage.setItem(SOUND_KEY, s);

let ctx;
const tone = (c, f, t0, dur, type = "sine", gain = 0.5) => {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
};

export function playSound(name = getSound()) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + 0.02;
    if (name === "bell") { tone(ctx, 880, t, 1.2, "triangle", 0.6); tone(ctx, 1760, t, 0.9, "sine", 0.25); tone(ctx, 2637, t + 0.02, 0.5, "sine", 0.12); }
    else if (name === "pop") { tone(ctx, 620, t, 0.14, "square", 0.25); tone(ctx, 930, t + 0.11, 0.18, "sine", 0.45); }
    else { tone(ctx, 1046.5, t, 0.5, "sine", 0.55); tone(ctx, 1318.5, t + 0.16, 0.55, "sine", 0.5); tone(ctx, 1568, t + 0.32, 0.8, "sine", 0.45); }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } catch (_) { /* audio blocked until first tap */ }
}

// Pre-warm the AudioContext on first user tap so later pushes can sound even without a fresh gesture.
export function warmAudio() {
  const once = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); } catch (_) {} document.removeEventListener("pointerdown", once); };
  document.addEventListener("pointerdown", once, { once: true });
}

export function onPushMessage(cb) {
  if (!("serviceWorker" in navigator)) return () => {};
  const h = (e) => { if (e.data && e.data.type === "PUSH") { playSound(); cb && cb(e.data); } };
  navigator.serviceWorker.addEventListener("message", h);
  return () => navigator.serviceWorker.removeEventListener("message", h);
}
