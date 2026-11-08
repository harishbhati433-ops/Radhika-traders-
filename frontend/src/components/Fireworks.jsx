import { useEffect, useRef } from "react";
import { playBurst, playLaunch } from "../lib/fireworksSound";

const COLORS = ["#fde68a", "#f97316", "#f472b6", "#22d3ee", "#4ade80", "#a78bfa", "#ffffff", "#fb7185"];
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// One canvas, GPU-light: capped DPR, particle cap, pauses when hidden / off-screen.
export function Fireworks({ fixed = false, intensity = 1, zone = "hero" }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced()) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let W = 0, H = 0, raf = 0, running = true, visible = true, last = 0, nextLaunch = 600;
    const rockets = [], parts = [];
    const mobile = () => W < 640;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      W = fixed ? window.innerWidth : r.width; H = fixed ? window.innerHeight : r.height;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spot = () => {
      if (zone === "any") return { x: W * (0.12 + Math.random() * 0.76), ty: H * (0.12 + Math.random() * 0.4) };
      if (W >= 1024) return { x: W * (0.55 + Math.random() * 0.4), ty: H * (0.1 + Math.random() * 0.45) };
      return { x: W * (0.08 + Math.random() * 0.84), ty: H * (0.04 + Math.random() * 0.2) };
    };
    const launch = (x) => {
      if (rockets.length > 3) return;
      const s = spot();
      rockets.push({ x: x ?? s.x, y: H, ty: s.ty, vy: -(6 + Math.random() * 3), color: COLORS[(Math.random() * COLORS.length) | 0], trail: [] });
      playLaunch();
    };

    const explode = (r) => {
      const cap = 420, n = Math.min((mobile() ? 26 : 46) + ((Math.random() * 16) | 0), cap - parts.length);
      const ring = Math.random() < 0.3, twoTone = Math.random() < 0.4, c2 = COLORS[(Math.random() * COLORS.length) | 0];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, sp = ring ? 3.2 : 1.2 + Math.random() * 3;
        parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.012 + Math.random() * 0.012, color: twoTone && i % 2 ? c2 : r.color, size: 1.4 + Math.random() * 1.4, sparkle: Math.random() < 0.25 });
      }
      playBurst(n > 50);
      window.dispatchEvent(new CustomEvent("rt-fireworks-explode"));
    };

    const step = (t) => {
      if (!running) return;
      raf = requestAnimationFrame(step);
      if (!visible || document.hidden) { last = t; return; }
      const dt = Math.min(2, (t - last) / 16.7 || 1); last = t;
      ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      nextLaunch -= dt * 16.7;
      if (nextLaunch <= 0) { launch(); nextLaunch = (mobile() ? 1500 : 1000) / intensity + Math.random() * 900; }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.y += r.vy * dt; r.vy += 0.03 * dt;
        ctx.fillStyle = r.color; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(r.x, r.y, 1.6, 0, Math.PI * 2); ctx.fill();
        if (r.y <= r.ty || r.vy >= 0) { rockets.splice(i, 1); explode(r); }
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.045 * dt; p.vx *= 0.985; p.vy *= 0.985; p.life -= p.decay * dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.globalAlpha = p.sparkle && Math.random() < 0.3 ? p.life * 0.3 : p.life;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 0.6), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const onBurst = (e) => { const n = e.detail?.count || 3; for (let i = 0; i < n; i++) setTimeout(() => launch(), i * 180); };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.05 });
    io.observe(canvas);
    resize(); window.addEventListener("resize", resize); window.addEventListener("rt-fireworks-burst", onBurst);
    raf = requestAnimationFrame(step);
    return () => { running = false; cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("rt-fireworks-burst", onBurst); };
  }, [fixed, intensity, zone]);
  return <canvas ref={ref} aria-hidden="true" data-testid="festival-fireworks" className={`${fixed ? "fixed" : "absolute"} inset-0 z-0 pointer-events-none`} />;
}

export const FIREWORK_FESTIVALS = new Set(["diwali", "newyear"]); // informational; runtime uses fest.fireworks from API
