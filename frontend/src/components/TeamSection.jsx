import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api, { fileUrl } from "../lib/api";

// Leadership strip under the team photos — same profiles the admin manages on the About page.
function LeadershipStrip() {
  const [people, setPeople] = useState([]);
  useEffect(() => { api.get("/about/public").then(({ data }) => setPeople(data.profiles || [])).catch(() => {}); }, []);
  if (!people.length) return null;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2" data-testid="home-leadership">
      {people.map((p, i) => (
        <Link to="/about" key={p.id} className="group flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-lg sm:p-5" data-testid={`home-leader-${i}`}>
          <img src={fileUrl(p.photo_url) || "/images/harish-bhati-face.jpeg"} alt={`${p.name} — ${p.title}`} loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-2xl border-2 border-amber-400 object-cover object-top sm:h-24 sm:w-24" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold uppercase tracking-wider text-red-600">{p.title}</div>
            <div className="mt-1 font-display text-lg font-extrabold text-slate-950 sm:text-xl">{p.name}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-red-600">Read profile <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
          </div>
        </Link>
      ))}
    </div>
  );
}

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
        {t.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-slate-600" data-testid="team-description-text">{t.description}</p>}
      </div>
      <div className={`grid gap-4 ${rest.length ? "md:grid-cols-3" : ""}`}>
        <Photo p={main} cls={rest.length ? "h-64 md:col-span-2 md:h-full md:min-h-[28rem]" : "h-72 sm:h-96"} pos="50% 30%" />
        {rest.length > 0 && (
          <div className="grid grid-cols-2 content-start gap-4">
            {rest.map((p, i) => <Photo key={`${p.url}-${i}`} p={p} cls={`h-64 ${i === 0 || (rest.length % 2 === 0 && i === rest.length - 1) ? "col-span-2" : ""}`} pos="50% 35%" />)}
          </div>
        )}
      </div>
      <LeadershipStrip />
    </section>
  );
}
