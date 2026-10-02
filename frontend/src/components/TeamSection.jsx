import { useEffect, useState } from "react";
import api, { fileUrl } from "../lib/api";

const DEFAULT_TEAM = {
  visible: true, eyebrow: "Our People", heading: "Radhika Traders Team",
  description: "The team behind every campaign, payout and celebration at our Agar (M.P.) office.",
  photos: [1, 2, 3, 4].map((i) => ({ url: `/images/team-${i}.jpeg`, caption: "" })),
};

const Photo = ({ p, cls, pos }) => (
  <figure className={`relative overflow-hidden rounded-3xl shadow-lg ${cls}`}>
    <img src={fileUrl(p.url)} alt={p.caption || "Radhika Traders team"} loading="lazy" decoding="async" className="h-full w-full object-cover" style={{ objectPosition: pos }} />
    {p.caption && <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-xs font-semibold text-white">{p.caption}</figcaption>}
  </figure>
);

export function TeamSection() {
  const [t, setT] = useState(DEFAULT_TEAM);
  useEffect(() => { api.get("/team/public").then(({ data }) => setT(data)).catch(() => {}); }, []);
  if (!t.visible || !t.photos?.length) return null;
  const [main, ...rest] = t.photos;
  return (
    <section id="team" className="mx-auto max-w-7xl px-6 py-16" data-testid="team-section">
      <div className="mb-8">
        {t.eyebrow && <span className="text-xs font-bold uppercase tracking-wider text-red-600">{t.eyebrow}</span>}
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl" data-testid="team-heading">{t.heading}</h2>
        {t.description && <p className="mt-2 max-w-xl text-sm text-slate-600">{t.description}</p>}
      </div>
      <div className={`grid gap-4 ${rest.length ? "md:grid-cols-3" : ""}`}>
        <Photo p={main} cls={rest.length ? "h-64 md:col-span-2 md:h-[34rem]" : "h-72 sm:h-96"} pos="50% 30%" />
        {rest.length > 0 && (
          <div className={`grid gap-4 ${rest.length === 1 ? "" : "grid-cols-2 md:grid-cols-1"} ${rest.length > 2 ? "md:grid-cols-2" : ""}`}>
            {rest.map((p, i) => <Photo key={`${p.url}-${i}`} p={p} cls="h-64 md:h-full md:min-h-[10rem]" pos="50% 35%" />)}
          </div>
        )}
      </div>
    </section>
  );
}
