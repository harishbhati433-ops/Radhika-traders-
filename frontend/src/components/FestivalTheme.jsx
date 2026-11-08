import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Logo } from "./Logo";
import { palette } from "../lib/festival";
import { FestivalMotif } from "./FestivalMotif";
import { Fireworks } from "./Fireworks";
import { enableSound, toggleSound, isSoundOn, onSoundChange, playBurst } from "../lib/fireworksSound";
import "../styles/festival.css";

const LIGHTS = Array.from({ length: 18 }, (_, i) => ({ left: `${(i * 53) % 100}%`, top: `${20 + ((i * 37) % 70)}%`, delay: `${(i * 0.7) % 9}s`, dx: `${((i % 5) - 2) * 14}px`, dur: `${7 + (i % 4) * 1.5}s` }));
const BULBS = Array.from({ length: 24 }, (_, i) => ({ left: `${(i + 0.5) * (100 / 24)}%`, delay: `${(i % 6) * 0.4}s` }));

export function Diya({ fest, compact }) {
  const key = `rt-diya-${fest.key}-${new Date().getFullYear()}`;
  const [lit, setLit] = useState(() => localStorage.getItem(key) === "1");
  const [sound, setSound] = useState(isSoundOn());
  useEffect(() => onSoundChange(setSound), []);
  const light = () => {
    if (!lit) { setLit(true); localStorage.setItem(key, "1"); }
    enableSound();
    playBurst(true);
    window.dispatchEvent(new CustomEvent("rt-fireworks-burst", { detail: { count: 3 } }));
  };
  const toggle = (e) => { e.stopPropagation(); toggleSound(); };
  return (
    <div className="flex flex-col items-center gap-3" data-testid="festival-diya-wrap">
      <button type="button" onClick={light} aria-pressed={lit} aria-label={lit ? "Diya lit — tap for fireworks" : "Tap to light the diya"} data-testid="festival-diya" className={`diya ${lit ? "lit" : ""} ${compact ? "scale-75" : ""}`}>
        <span className="diya-glow" /><span className="diya-body" /><span className="diya-rim" /><span className="diya-oil" /><span className="diya-wick" /><span className="diya-flame" />
      </button>
      {lit ? (
        <div className="fest-wish max-w-xs text-center" data-testid="festival-wish">
          <div className="font-display text-lg font-extrabold" style={{ color: "var(--fest-accent2)" }}>{fest.emoji} {fest.wish || fest.name}!</div>
          {!compact && <p className="mt-1 text-sm leading-snug opacity-90">{fest.greeting}</p>}
          <button type="button" onClick={toggle} data-testid="festival-sound-toggle" aria-pressed={sound} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition-colors" style={{ background: "color-mix(in srgb, var(--fest-accent) 20%, transparent)", color: "var(--fest-accent2)", borderColor: "var(--fest-accent)" }}>
            {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {sound ? "पटाखों की आवाज़ चालू" : "आवाज़ बंद — चालू करें"}
          </button>
        </div>
      ) : (
        <div className="diya-hint inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "color-mix(in srgb, var(--fest-accent) 20%, transparent)", color: "var(--fest-accent2)" }} data-testid="festival-diya-hint"><Sparkles className="h-3.5 w-3.5" /> दीया जलाएँ — पटाखे चलाएँ</div>
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
      {fest.fireworks && <Fireworks />}
      <div className="relative z-[1] mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 lg:grid-cols-5 lg:py-24">
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
        <div className="flex justify-center lg:col-span-2"><FestivalMotif fest={fest} /></div>
      </div>
    </section>
  );
}

const DASH_LIGHTS = LIGHTS.slice(0, 10);

export function FestivalDashHero({ fest, name }) {
  return (
    <section className="fest-dash-hero fest-grain mb-6" style={festVars(fest)} data-testid="festival-dash-hero" data-festival={fest.key}>
      <div className="fest-string" aria-hidden="true">{BULBS.map((b, i) => <span key={i} className="fest-bulb" style={{ left: b.left, animationDelay: b.delay }} />)}</div>
      <div className="fest-lights" aria-hidden="true">{DASH_LIGHTS.map((l, i) => <span key={i} className="fest-light" style={{ left: l.left, top: l.top, animationDelay: l.delay, animationDuration: l.dur, "--dx": l.dx }} />)}</div>
      <span className="fest-corner" aria-hidden="true" /><span className="fest-corner br" aria-hidden="true" />
      {fest.fireworks && <Fireworks intensity={0.8} />}
      <div className="relative z-[1] grid grid-cols-5 items-center gap-2 px-4 pb-4 pt-7 sm:gap-4 sm:px-8 sm:pb-7 sm:pt-9">
        <div className="col-span-3">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ring-1" style={{ background: "color-mix(in srgb, var(--fest-accent) 18%, transparent)", color: "var(--fest-accent2)", borderColor: "var(--fest-accent)" }} data-testid="festival-dash-badge"><span>{fest.emoji}</span> {fest.name} Special</div>
          <h2 className="fest-wish-title mt-3 font-display text-2xl font-extrabold leading-tight sm:text-4xl" data-testid="festival-dash-wish">{fest.wish || fest.name}{name ? `, ${name}` : ""}!</h2>
          <div className="fest-rule mt-3" />
          <p className="mt-3 max-w-md text-xs leading-relaxed opacity-90 sm:text-base" data-testid="festival-dash-greeting">{fest.greeting}</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider opacity-70 sm:text-[11px]">— Radhika Traders · {fest.tagline}</p>
        </div>
        <div className="col-span-2 flex origin-center scale-[.62] justify-center sm:scale-100"><FestivalMotif fest={fest} compact /></div>
      </div>
    </section>
  );
}

export function FestivalCampaigns({ fest, campaigns, fileUrl }) {
  return (
    <div style={festVars(fest)} data-testid="festival-campaigns">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold" style={{ color: "var(--fest-accent2)" }} data-testid="festival-campaigns-title">{fest.emoji} {fest.name} Special Campaigns</h2>
        <Link to="/app/my-campaigns" data-testid="festival-campaigns-view-all" className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--fest-accent2)" }}>View All <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {campaigns.map((c) => (
          <Link key={c.id} to={`/campaign/${c.slug}`} data-testid={`festival-campaign-${c.slug}`} className="fest-camp-card flex flex-col rounded-2xl p-3.5 text-white">
            <div className="flex items-center gap-2.5">
              {c.logo_url ? <img src={fileUrl(c.logo_url)} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain p-1" loading="lazy" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white font-display text-lg font-extrabold text-red-700">{(c.company || c.offer_name || "R").charAt(0)}</span>}
              <div className="min-w-0"><div className="line-clamp-2 font-display text-sm font-bold leading-tight">{c.offer_name}</div><div className="truncate text-[11px] opacity-70">{c.company}</div></div>
            </div>
            <div className="mt-2 line-clamp-1 text-xs opacity-80">{c.category}{c.campaign_type ? ` · ${c.campaign_type}` : ""}</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="fest-payout inline-flex rounded-full px-3 py-1.5 font-mono text-sm font-extrabold">Payout: ₹{c.payout_amount}</span>
              <span className="fest-live inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"><Sparkles className="h-2.5 w-2.5" /> Live</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
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
