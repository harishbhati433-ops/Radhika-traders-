import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl } from "../lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function OfferBanners() {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => { api.get("/banners").then(({ data }) => setItems(data)).catch(() => {}); }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const b = items[i];
  const isInternal = b.link && b.link.startsWith("/");
  const Wrap = ({ children }) => isInternal ? <Link to={b.link} className="block">{children}</Link>
    : b.link ? <a href={b.link} target="_blank" rel="noreferrer" className="block">{children}</a> : <div>{children}</div>;

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl shadow-lg" data-testid="offer-banners">
      <Wrap>
        <div className="relative h-44 w-full sm:h-56">
          <img key={b.id} src={fileUrl(b.image_url)} alt={b.title} className="h-full w-full object-cover rt-fade-up" data-testid="offer-banner-image" />
          {(b.title || b.subtitle) && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white">
              {b.title && <div className="font-display text-xl font-extrabold sm:text-2xl" data-testid="offer-banner-title">{b.title}</div>}
              {b.subtitle && <div className="mt-0.5 inline-block rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-slate-950">{b.subtitle}</div>}
            </div>
          )}
        </div>
      </Wrap>
      {items.length > 1 && (
        <>
          <button onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Previous" data-testid="offer-banner-prev" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-900 hover:bg-white"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setI((i + 1) % items.length)} aria-label="Next" data-testid="offer-banner-next" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-900 hover:bg-white"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-2 right-4 flex gap-1">
            {items.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-amber-400" : "w-1.5 bg-white/60"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}
