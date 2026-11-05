import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";

const SLIDE_MS = 3500;

function GeneratedSlide({ b, active }) {
  return (
    <div className="relative flex h-full w-full items-center gap-4 bg-[radial-gradient(ellipse_at_top_left,#1e293b,#0B0F17_60%)] p-5 text-white sm:gap-6 sm:p-8" data-testid={active ? "offer-banner-generated" : undefined}>
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-white/20 sm:h-20 sm:w-20">
        {b.logo_url ? <img src={fileUrl(b.logo_url)} alt="" className="h-full w-full object-contain p-1.5" loading="lazy" /> : <span className="font-display text-2xl font-extrabold text-red-700 sm:text-4xl">{(b.title || "?").slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-xl font-extrabold leading-tight sm:text-3xl" data-testid={active ? "offer-banner-title" : undefined}>{b.title}</div>
        {b.company && <div className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm">{b.company}</div>}
        {b.payout_amount && <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 sm:text-sm"><Wallet className="h-3.5 w-3.5" /> Earn ₹{b.payout_amount}</div>}
      </div>
    </div>
  );
}

function ImageSlide({ b, active }) {
  const src = fileUrl(b.image_url);
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0B0F17]">
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" loading="lazy" />
      <img src={src} alt={b.title || "Banner"} className="relative h-full w-full object-contain" loading={active ? "eager" : "lazy"} data-testid={active ? "offer-banner-image" : undefined} />
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
  const hrefFor = (b) => (b.campaign_slug ? `${origin}/${b.has_lead_form ? "join" : "api/go"}/${b.campaign_slug}${user?.referral_code ? `?ref=${user.referral_code}` : ""}` : b.link || "");

  const Slide = ({ b, active }) => {
    const href = hrefFor(b);
    const inner = <div className="aspect-[16/9] w-full sm:aspect-[21/9] lg:aspect-[3/1]">{b.image_url ? <ImageSlide b={b} active={active} /> : <GeneratedSlide b={b} active={active} />}</div>;
    const cls = "block h-full w-full";
    if (b.campaign_slug) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined} data-auto={b.auto ? "1" : undefined}>{inner}</a>;
    if (href.startsWith("/")) return <Link to={href} className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</Link>;
    if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls} data-testid={active ? "offer-banner-link" : undefined}>{inner}</a>;
    return <div className={cls}>{inner}</div>;
  };

  return (
    <div className="group relative mb-6 overflow-hidden rounded-2xl shadow-lg" data-testid="offer-banners"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {items.map((b, k) => <div key={b.id} className="w-full shrink-0"><Slide b={b} active={k === i} /></div>)}
      </div>
      {items.length > 1 && (
        <>
          <button onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous" data-testid="offer-banner-prev" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setI((i + 1) % items.length)} aria-label="Next" data-testid="offer-banner-next" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-1.5 text-white backdrop-blur-sm transition-opacity hover:bg-black/60 sm:opacity-0 sm:group-hover:opacity-100"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" data-testid="offer-banner-dots">
            {items.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
