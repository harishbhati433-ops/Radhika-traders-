import { useEffect, useState } from "react";
import { PublicLayout } from "../components/PublicLayout";
import { CheckCircle2, Target, Telescope, Mail } from "lucide-react";
import api, { fileUrl } from "../lib/api";

const FOUNDER_ID = "founder-harish-bhati";

const EmailLink = ({ email, testId, light = false }) => email ? (
  <a href={`mailto:${email}`} data-testid={testId} className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold hover:underline sm:text-sm ${light ? "text-amber-200" : "text-red-600"}`}><Mail className="h-4 w-4" /> {email}</a>
) : null;

function FounderHero({ p }) {
  return (
    <>
      <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-500/5 p-5" data-testid="about-owner-card">
        <div className="flex items-center gap-4">
          <img src={fileUrl(p.photo_url) || "/images/harish-bhati-face.jpeg"} alt={p.name} className="h-20 w-20 shrink-0 rounded-full border-2 border-amber-400 object-cover" style={{ objectPosition: p.photo_pos || "center" }} data-testid="about-owner-avatar" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">{p.title}</div>
            <div className="mt-1 font-display text-xl font-bold text-slate-900">{p.name}</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">{p.bio}</p>
        <EmailLink email={p.email} testId="about-owner-email" />
        {p.highlight && (
          <div className="mt-4 flex items-center gap-3">
            <div className="rounded-xl bg-red-600 px-3 py-2 text-center text-white">
              <div className="font-display text-2xl font-extrabold leading-none">{p.highlight}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider">Years</div>
            </div>
            <div className="text-xs text-slate-500">Market experience in financial services & affiliate marketing</div>
          </div>
        )}
      </div>
    </>
  );
}

function FounderPhotos({ p }) {
  const pos = p.photo_pos || "center";
  return (
    <div className="grid grid-cols-5 gap-4 rt-fade-up" data-testid="about-owner-photos">
      <div className={`relative overflow-hidden rounded-3xl shadow-xl h-[420px] sm:h-[560px] ${p.photo2_url ? "col-span-3" : "col-span-5"}`}>
        <img src={fileUrl(p.photo_url) || "/images/harish-bhati.jpeg"} alt={`${p.name} — ${p.title}, Radhika Traders`} className="h-full w-full object-cover" style={{ objectPosition: pos }} data-testid="about-owner-photo-main" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">{p.title}</div>
          <div className="font-display text-xl font-bold">{p.name}</div>
        </div>
      </div>
      {p.photo2_url && (
        <div className="col-span-2 flex flex-col gap-4">
          <div className="relative flex-1 overflow-hidden rounded-3xl shadow-xl">
            <img src={fileUrl(p.photo2_url)} alt={p.name} className="h-full w-full object-cover object-top" data-testid="about-owner-photo-2" />
          </div>
          {p.highlight && (
            <div className="rounded-3xl bg-gradient-to-br from-red-700 to-[#0B0F17] p-5 text-white">
              <div className="font-display text-4xl font-extrabold text-amber-300">{p.highlight}</div>
              <div className="text-xs font-semibold uppercase tracking-wider">{p.highlight_label}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderCard({ p, i }) {
  return (
    <article className="group grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-xl sm:grid-cols-[260px_1fr]" data-testid={`about-leader-${i}`}>
      <div className="relative h-72 sm:h-full">
        {p.photo_url ? <img src={fileUrl(p.photo_url)} alt={`${p.name} — ${p.title}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" style={{ objectPosition: p.photo_pos || "center" }} /> : <div className="flex h-full items-center justify-center bg-slate-100 font-display text-5xl font-extrabold text-slate-300">{p.name[0]}</div>}
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <div className="text-xs font-bold uppercase tracking-wider text-red-600">{p.title}</div>
        <h3 className="mt-2 font-display text-2xl font-extrabold text-slate-950">{p.name}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{p.bio}</p>
        <EmailLink email={p.email} testId={`about-leader-${i}-email`} />
        {p.highlight && (
          <div className="mt-5 inline-flex w-fit items-center gap-3 rounded-2xl bg-slate-950 px-4 py-2.5 text-white">
            <span className="font-display text-2xl font-extrabold text-amber-300">{p.highlight}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider">{p.highlight_label}</span>
          </div>
        )}
      </div>
    </article>
  );
}

function MissionVision({ mission, vision }) {
  if (!mission && !vision) return null;
  const blocks = [mission && { ...mission, icon: Target, k: "mission", tone: "from-red-700 to-[#0B0F17] text-white", iconTone: "bg-white/15 text-amber-300" },
                  vision && { ...vision, icon: Telescope, k: "vision", tone: "from-amber-50 to-white text-slate-900 border border-amber-200", iconTone: "bg-red-600 text-white" }].filter(Boolean);
  return (
    <section className="mt-16 rt-fade-up" data-testid="about-mission-vision">
      <span className="text-xs font-bold uppercase tracking-wider text-red-600">What drives us</span>
      <h2 className="mt-2 font-display text-2xl font-bold text-slate-950 sm:text-3xl">Mission & Vision</h2>
      <div className={`mt-6 grid gap-5 ${blocks.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {blocks.map((b) => (
          <div key={b.k} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-7 sm:p-9 ${b.tone}`} data-testid={`about-${b.k}`}>
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${b.iconTone}`}><b.icon className="h-6 w-6" /></div>
            <h3 className="mt-5 font-display text-xl font-extrabold sm:text-2xl">{b.title}</h3>
            <p className={`mt-3 text-sm leading-relaxed sm:text-base ${b.k === "mission" ? "text-white/85" : "text-slate-600"}`}>{b.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function About() {
  const areas = ["Demat Accounts", "Savings A/C", "Credit Cards", "Insurance", "Loan Assistance", "Financial Products", "Affiliate Campaigns", "Digital Marketing"];
  const [a, setA] = useState(null);
  useEffect(() => { api.get("/about/public").then(({ data }) => setA(data)).catch(() => setA({ profiles: [], mission: null, vision: null })); }, []);
  const profiles = a?.profiles || [];
  const founder = profiles.find((p) => p.id === FOUNDER_ID);
  const others = profiles.filter((p) => p.id !== FOUNDER_ID);

  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="rt-fade-up">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">About Us</span>
            <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Radhika Traders</h1>
            <p className="mt-5 text-base text-slate-600 sm:text-lg">
              Founded on <strong>15 June 2023</strong>, Radhika Traders is a growing affiliate marketing & financial services company. We help individuals access the right financial products while empowering partners to earn through genuine campaigns.
            </p>
            <p className="mt-4 text-base text-slate-600">
              Our team brings <strong>3+ years of individual experience</strong> and <strong>6+ years of combined expertise</strong> in the financial and digital marketing space.
            </p>
            {founder && <FounderHero p={founder} />}
          </div>
          {founder && <FounderPhotos p={founder} />}
        </div>

        {others.length > 0 && (
          <div className="mt-16 rt-fade-up" data-testid="about-leadership">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600">Leadership</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-slate-950 sm:text-3xl">The people who run Radhika Traders</h2>
            <div className="mt-6 grid gap-6">{others.map((p, i) => <LeaderCard key={p.id} p={p} i={i} />)}</div>
          </div>
        )}

        <MissionVision mission={a?.mission} vision={a?.vision} />

        <div className="mt-16">
          <h2 className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">What we work with</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map((ar) => (
              <div key={ar} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-800">{ar}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
