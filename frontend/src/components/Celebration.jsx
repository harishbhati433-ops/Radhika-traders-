import { useEffect, useRef, useState } from "react";

const COLORS = ["#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#FCD34D", "#F97316"];
const DURATION_MS = 4200;
const SEEN_KEY = "rt_celebrated_wd";

export const celebrate = (key) => {
  if (key) {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    if (seen.includes(key)) return false;
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.slice(-200), key]));
  }
  window.dispatchEvent(new CustomEvent("rt:celebrate", { detail: { key } }));
  return true;
};

function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const t = now + i * 0.11;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.75);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1800);
  } catch {}
}

function drawFlower(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, -p.size * 0.55, p.size * 0.32, p.size * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate((Math.PI * 2) / 5); }
  ctx.fillStyle = "#FFF7ED"; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawConfetti(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
  ctx.fillRect(-p.size / 2, -p.size / 5, p.size, p.size / 2.5);
  ctx.restore();
}

export function CelebrationLayer() {
  const canvasRef = useRef(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const onCelebrate = () => { playChime(); setRun(Date.now()); };
    window.addEventListener("rt:celebrate", onCelebrate);
    return () => window.removeEventListener("rt:celebrate", onCelebrate);
  }, []);

  useEffect(() => {
    if (!run) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    const n = W < 640 ? 110 : 190;
    const parts = Array.from({ length: n }, (_, i) => ({
      x: W * (0.2 + Math.random() * 0.6), y: H * 0.45, vx: (Math.random() - 0.5) * 16, vy: -(9 + Math.random() * 11),
      size: 7 + Math.random() * 11, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.25, alpha: 1,
      color: COLORS[i % COLORS.length], flower: i % 3 === 0,
    }));
    let alive = true;
    const start = performance.now();
    const tick = (t) => {
      if (!alive) return;
      const el = t - start;
      ctx.clearRect(0, 0, W, H);
      const fade = el > DURATION_MS - 900 ? Math.max(0, (DURATION_MS - el) / 900) : 1;
      parts.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.alpha = fade;
        (p.flower ? drawFlower : drawConfetti)(ctx, p);
      });
      if (el < DURATION_MS) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const end = setTimeout(() => { alive = false; setRun(0); }, DURATION_MS + 150);
    return () => { alive = false; clearTimeout(end); };
  }, [run]);

  if (!run) return null;
  return <canvas ref={canvasRef} data-testid="celebration-canvas" className="pointer-events-none fixed inset-0 z-[200]" aria-hidden="true" />;
}

// Fires once when a withdrawal we previously saw as non-final becomes approved/paid. First visit only records, never celebrates retroactively.
export function useWithdrawalCelebration(list, userId) {
  useEffect(() => {
    if (!userId || !Array.isArray(list) || list.length === 0) return;
    const key = `rt_wd_status:${userId}`;
    const prev = JSON.parse(localStorage.getItem(key) || "null");
    const next = Object.fromEntries(list.map((w) => [w.id, w.status]));
    if (prev) {
      const hit = list.find((w) => ["approved", "paid"].includes(w.status) && prev[w.id] && !["approved", "paid"].includes(prev[w.id]));
      if (hit) celebrate(`${userId}:${hit.id}`);
    }
    localStorage.setItem(key, JSON.stringify(next));
  }, [list, userId]);
}
