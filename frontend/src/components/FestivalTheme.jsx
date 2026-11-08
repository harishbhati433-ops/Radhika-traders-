import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "./Logo";
import { palette } from "../lib/festival";
import "../styles/festival.css";

const LIGHTS = Array.from({ length: 18 }, (_, i) => ({ left: `${(i * 53) % 100}%`, top: `${20 + ((i * 37) % 70)}%`, delay: `${(i * 0.7) % 9}s`, dx: `${((i % 5) - 2) * 14}px`, dur: `${7 + (i % 4) * 1.5}s` }));
const BULBS = Array.from({ length: 24 }, (_, i) => ({ left: `${(i + 0.5) * (100 / 24)}%`, delay: `${(i % 6) * 0.4}s` }));

export function Diya({ fest, compact }) {
  const key = `rt-diya-${fest.key}-${new Date().getFullYear()}`;
  const [lit, setLit] = useState(() => localStorage.getItem(key) === "1");
  const light = () => { if (!lit) { setLit(true); localStorage.setItem(key, "1"); } };
  return (
    <div className="flex flex-col items-center gap-3" data-testid="festival-diya-wrap">
      <button type="button" onClick={light} aria-pressed={lit} aria-label={lit ? "Diya lit" : "Tap to light the diya"} data-testid="festival-diya" className={`diya ${lit ? "lit" : ""} ${compact ? "scale-75" : ""}`}>
        <span className="diya-glow" /><span className="diya-body" /><span className="diya-rim" /><span className="diya-oil" /><span className="diya-wick" /><span className="diya-flame" />
      </button>
      {lit ? (
        <div className="fest-wish max-w-xs text-center" data-testid="festival-wish">
          <div className="font-display text-lg font-extrabold" style={{ color: "var(--fest-accent2)" }}>{fest.emoji} {fest.name === "Diwali" ? "शुभ दीपावली!" : fest.name}</div>
          <p className="mt-1 text-sm leading-snug opacity-90">{fest.greeting}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider opacity-70">— Radhika Traders</p>
        </div>
      ) : (
        <div className="diya-hint inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "color-mix(in srgb, var(--fest-accent) 20%, transparent)", color: "var(--fest-accent2)" }} data-testid="festival-diya-hint"><Sparkles className="h-3.5 w-3.5" /> दीया जलाने के लिए tap करें</div>
      )}
    </div>
  );
}

export function festVars(fest) {
  const p = palette(fest);
  return { "--fest-bg": p.bg, "--fest-accent": p.accent, "--fest-accent2": p.accent2, "--fest-glow": p.glow, "--fest-text": p.text };
}

export function FestivalHero({ fest }) {
  return (
    <section className="fest-hero fest-grain" style={festVars(fest)} data-testid="festival-hero" data-festival={fest.key}>
      <div className="fest-string" aria-hidden="true">{BULBS.map((b, i) => <span key={i} className="fest-bulb" style={{ left: b.left, animationDelay: b.delay }} />)}</div>
      <div className="fest-lights" aria-hidden="true">{LIGHTS.map((l, i) => <span key={i} className="fest-light" style={{ left: l.left, top: l.top, animationDelay: l.delay, animationDuration: l.dur, "--dx": l.dx }} />)}</div>
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-5 lg:py-24">
        <div className="rt-fade-up lg:col-span-3">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1" style={{ background: "color-mix(in srgb, var(--fest-accent) 18%, transparent)", color: "var(--fest-accent2)", borderColor: "var(--fest-accent)" }} data-testid="festival-badge">
            <span>{fest.emoji}</span> {fest.name} Special
          </div>
          <h1 className="fest-headline mt-5 font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl" data-testid="festival-headline">{fest.headline_hi}</h1>
          <p className="mt-3 text-base font-semibold sm:text-lg" style={{ color: "var(--fest-accent2)" }} data-testid="festival-headline-en">{fest.headline_en}</p>
          <p className="mt-5 max-w-xl text-base opacity-80 sm:text-lg" data-testid="festival-tagline">{fest.tagline} · Demat · Credit Cards · Loans · Insurance · SIP — Zero investment, real earnings.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/campaigns" data-testid="festival-cta-campaigns" className="fest-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-transform hover:scale-[1.03]">Live Campaigns देखें <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/signup" data-testid="festival-cta-signup" className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold transition-colors hover:bg-white/10" style={{ borderColor: "color-mix(in srgb, var(--fest-accent2) 50%, transparent)" }}>Free Partner बनें</Link>
          </div>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-2 shadow-lg"><Logo size="sm" /></div>
        </div>
        <div className="flex justify-center lg:col-span-2"><Diya fest={fest} /></div>
      </div>
    </section>
  );
}

export function FestiveStrip({ fest }) {
  if (!fest) return null;
  return (
    <div className="fest-strip flex items-center justify-center gap-2 px-3 py-1.5 text-center text-xs font-bold" style={festVars(fest)} data-testid="festival-strip">
      <span>{fest.emoji}</span><span className="truncate">{fest.headline_hi}</span><span className="hidden opacity-70 sm:inline">· {fest.tagline}</span>
    </div>
  );
}
