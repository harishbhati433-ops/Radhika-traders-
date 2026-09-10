import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, MousePointerClick, Radio, Wallet, Landmark, ListChecks, Gift, BadgeCheck, ShieldCheck } from "lucide-react";

const SLIDE_MS = 3500;

const Chip = ({ icon: I, children, tone = "bg-white/10 text-white ring-white/20", testId }) => (
  <span data-testid={testId} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 sm:text-[11px] ${tone}`}><I className="h-3 w-3 shrink-0" /><span className="truncate">{children}</span></span>
);

function GeneratedSlide({ b, active }) {
  const facts = [
    b.payout_amount ? [Wallet, `Payout ₹${b.payout_amount}${b.payout_type && b.payout_type !== "Fixed" ? ` · ${b.payout_type}` : ""}`, "bg-amber-400 text-slate-950 ring-amber-300"] : null,
    b.investment ? [Landmark, `Fund: ${b.investment}`] : null,
    b.requirement ? [ListChecks, b.requirement] : null,
  ].filter(Boolean);
  const benefit = b.customer_benefit || b.benefits;
  return (
    <div className="relative flex h-full w-full flex-col justify-between bg-[radial-gradient(ellipse_at_top_left,#1e293b,#0B0F17_60%)] p-4 text-white sm:p-6" data-testid={active ? "offer-banner-generated" : undefined}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20 sm:h-16 sm:w-16">
          {b.logo_url ? <img src={fileUrl(b.logo_url)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="font-display text-xl font-extrabold text-amber-400 sm:text-3xl">{(b.title || "?").slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-400/40" data-testid={active ? "offer-banner-live" : undefined}><Radio className="h-3 w-3 animate-pulse" /> Live Campaign</span>
            {b.campaign_type && <Chip icon={BadgeCheck} tone="bg-sky-500/20 text-sky-200 ring-sky-400/40" testId={active ? "offer-banner-type" : undefined}>{b.campaign_type}</Chip>}
          </div>
          <div className="mt-1 truncate font-display text-lg font-extrabold leading-tight sm:text-2xl" data-testid={active ? "offer-banner-title" : undefined}>{b.title}</div>
          {b.company && <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:text-xs">{b.company}</div>}
        </div>
      </div>
      {(b.description || benefit) && (
        <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-300 sm:text-sm">{benefit ? <><span className="font-bold text-amber-300">Customer benefit:</span> {benefit}</> : b.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid={active ? "offer-banner-facts" : undefined}>
        {facts.map(([I, t, tone], i) => <Chip key={i} icon={I} tone={tone}>{t}</Chip>)}
        <Chip icon={ShieldCheck} tone="bg-white/10 text-slate-200 ring-white/20">Easy account opening</Chip>
        {b.company && <Chip icon={Gift} tone="bg-white/10 text-slate-200 ring-white/20">Approved {b.company} partner</Chip>}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-slate-950"><MousePointerClick className="h-3 w-3" /> Tap to apply</span>
      </div>
    </div>
  );
}

function ImageSlide({ b, active }) {
  return (
    <div className="relative h-full w-full bg-[#0B0F17]">
      <img src={fileUrl(b.image_url)} alt={b.title} className="h-full w-full object-contain" loading={active ? "eager" : "lazy"} data-testid={active ? "offer-banner-image" : undefined} />
      {b.auto && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white" data-testid={active ? "offer-banner-live" : undefined}><Radio className="h-3 w-3" /> Live</span>}
      {(b.title || b.subtitle) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white sm:p-5">
          {b.title && <div className="font-display text-lg font-extrabold sm:text-2xl" data-testid={active ? "offer-banner-title" : undefined}>{b.title}</div>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {b.subtitle && <span className="inline-block rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-950">{b.subtitle}</span>}
            {b.campaign_type && <span className="rounded-full bg-sky-500/30 px-2.5 py-0.5 text-[11px] font-bold text-sky-100 ring-1 ring-sky-300/40">{b.campaign_type}</span>}
            {b.campaign_slug && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold backdrop-blur"><MousePointerClick className="h-3 w-3" /> {b.campaign_live ? "Tap to apply" : "Offer inactive"}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function OfferBanners() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => { api.get("/banners").then(({ data }) => setItems(data)).catch(() => {}); }, []);
  useEffect(() => {
    if (items.length < 2 || paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (!items.length) return null;
  const origin = window.location.origin;
  const hrefFor = (b) => (b.campaign_slug ? `${origin}/api/go/${b.campaign_slug}${user?.referral_code ? `?ref=${user.referral_code}` : ""}` : b.link || "");

  const Slide = ({ b, active }) => {
    const href = hrefFor(b);
    const inner = <div className="aspect-[16/9] w-full sm:aspect-[3/1]">{b.image_url ? <ImageSlide b={b} active={active} /> : <GeneratedSlide b={b} active={active} />}</div>;
    const cls = "block h-full w-full";
    if (b.campaign_slug) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined} data-auto={b.auto ? "1" : undefined}>{inner}</a>;
    if (href.startsWith("/")) return <Link to={href} className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</Link>;
    if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</a>;
    return <div className={cls}>{inner}</div>;
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl shadow-lg" data-testid="offer-banners"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((b, k) => <div key={b.id} className="w-full shrink-0"><Slide b={b} active={k === i} /></div>)}
      </div>
      {items.length > 1 && (
        <>
          <button onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous" data-testid="offer-banner-prev" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-900 hover:bg-white"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setI((i + 1) % items.length)} aria-label="Next" data-testid="offer-banner-next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-900 hover:bg-white"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 right-4 flex gap-1">
            {items.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-amber-400" : "w-1.5 bg-white/60"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
