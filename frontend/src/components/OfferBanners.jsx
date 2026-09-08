import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";

const SLIDE_MS = 2000;

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
  const hrefFor = (b) => {
    if (b.campaign_slug) return `${origin}/api/go/${b.campaign_slug}${user?.referral_code ? `?ref=${user.referral_code}` : ""}`;
    return b.link || "";
  };

  const Slide = ({ b, active }) => {
    const href = hrefFor(b);
    const inner = (
      <div className="relative aspect-[3/1] w-full bg-[#0B0F17]">
        {b.image_url ? (
          <img src={fileUrl(b.image_url)} alt={b.title} className="h-full w-full object-contain" data-testid={active ? "offer-banner-image" : undefined} />
        ) : (
          <div className="flex h-full w-full items-center gap-5 bg-[radial-gradient(ellipse_at_top_left,#1e293b,#0B0F17_60%)] px-6 sm:px-10" data-testid={active ? "offer-banner-generated" : undefined}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/20 sm:h-24 sm:w-24">
              {b.logo_url ? <img src={fileUrl(b.logo_url)} alt="" className="h-full w-full object-cover" /> : <span className="font-display text-2xl font-extrabold text-amber-400 sm:text-4xl">{(b.title || "?").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 pb-14 sm:pb-16">
              <span className="inline-block rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-400/40">New · Live</span>
              {b.company && <div className="mt-2 truncate text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm">{b.company}</div>}
            </div>
          </div>
        )}
        {(b.title || b.subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white">
            {b.title && <div className="font-display text-xl font-extrabold sm:text-2xl" data-testid={active ? "offer-banner-title" : undefined}>{b.title}</div>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {b.subtitle && <span className="inline-block rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-950">{b.subtitle}</span>}
              {b.campaign_slug && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold backdrop-blur"><MousePointerClick className="h-3 w-3" /> {b.campaign_live ? "Tap to apply" : "Offer inactive"}</span>}
            </div>
          </div>
        )}
      </div>
    );
    const cls = "block h-full w-full";
    if (b.campaign_slug) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined} data-auto={b.auto ? "1" : undefined}>{inner}</a>;
    if (href.startsWith("/")) return <Link to={href} className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</Link>;
    if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</a>;
    return <div className={cls}>{inner}</div>;
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl shadow-lg" data-testid="offer-banners"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
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
