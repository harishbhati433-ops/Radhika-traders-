// Synthesised firecracker sounds (Web Audio, no assets). Only ever starts from a user gesture.
let ctx = null, enabled = false, lastAt = 0, noiseBuf = null;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(enabled));
export const onSoundChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const isSoundOn = () => enabled;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(t, dur, gain, freq, q = 0.7) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.3), t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination); src.start(t); src.stop(t + dur + 0.05);
}

function thump(t) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.35);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.45);
}

export function playBurst(big = false) {
  if (!enabled || !ensureCtx()) return;
  const now = ctx.currentTime;
  if (now - lastAt < 0.18) return;
  lastAt = now;
  thump(now);
  noise(now, big ? 0.7 : 0.45, big ? 0.9 : 0.6, 1800, 0.5);
  const pops = big ? 7 : 4;
  for (let i = 0; i < pops; i++) noise(now + 0.08 + Math.random() * 0.5, 0.06, 0.35, 2500 + Math.random() * 2500, 3);
}

export function playLaunch() {
  if (!enabled || !ensureCtx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(500, t); o.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.6);
}

export function enableSound() { if (!ensureCtx()) return false; enabled = true; notify(); return true; }
export function disableSound() { enabled = false; notify(); }
export function toggleSound() { return enabled ? (disableSound(), false) : enableSound(); }
