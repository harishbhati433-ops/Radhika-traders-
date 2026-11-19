import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, ExternalLink, Gift, Loader2, Sparkles, Volume2, VolumeX } from "lucide-react";
import axios from "axios";
import { Logo } from "../components/Logo";
import { fileUrl } from "../lib/api";
import { fontCss } from "../lib/storyFonts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tries to autoplay WITH sound; if the browser blocks it, plays muted and shows a one-tap "Sound on" button.
function StoryVideo({ s }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    v.play().then(() => setMuted(false)).catch(() => { v.muted = true; setMuted(true); setBlocked(true); v.play().catch(() => {}); });
  }, [s.media_url]);
  const unmute = () => { const v = ref.current; if (!v) return; v.muted = false; setMuted(false); setBlocked(false); v.play().catch(() => {}); };
  const toggle = () => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  return (
    <>
      <video ref={ref} src={fileUrl(s.media_url)} poster={s.thumb_url ? fileUrl(s.thumb_url) : undefined} playsInline autoPlay loop controls preload="auto" className="h-full w-full object-cover" data-testid="story-public-video" onClick={blocked ? unmute : undefined} />
      {blocked && <button type="button" onClick={unmute} data-testid="story-public-unmute" className="absolute inset-x-0 bottom-20 mx-auto flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-xl animate-pulse"><Volume2 className="h-4 w-4" /> Tap for sound</button>}
      {!blocked && <button type="button" onClick={toggle} aria-label={muted ? "Unmute" : "Mute"} data-testid="story-public-mute" className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white backdrop-blur">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}
    </>
  );
}

// Public landing for a shared story: /s/:id?ref=CODE — the visitor joins or applies as the sharer's referral.
export default function StoryPublic() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const ref = sp.get("ref") || "";
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (ref) { try { localStorage.setItem("rt_ref", ref.toUpperCase()); } catch {} }
    axios.get(`${API}/stories/${id}/public`, { params: ref ? { ref } : {} }).then(({ data }) => setS(data)).catch((e) => setErr(e.response?.data?.detail || "Story not found"));
  }, [id, ref]);

  const code = s?.referrer?.code || "";
  const q = code ? `?ref=${encodeURIComponent(code)}` : "";
  const applyHref = s?.kind === "campaign" && s.slug ? (s.has_lead_form ? `/join/${s.slug}${q}` : `${API}/go/${s.slug}${q}`) : "";
  const joinHref = `/app/signup${q}`;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white" data-testid="story-public-page">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link to="/"><Logo light size="sm" /></Link>
        <Link to="/campaigns" className="text-xs font-semibold text-white/70 hover:text-white">All campaigns →</Link>
      </header>

      {err && <div className="mx-auto max-w-md px-6 py-24 text-center" data-testid="story-public-error"><Sparkles className="mx-auto mb-3 h-10 w-10 text-amber-300" /><h1 className="font-display text-2xl font-bold">{err}</h1><p className="mt-2 text-sm text-white/60">Stories 24 ghante baad expire ho jaati hain. Latest offers yahan dekhein:</p><Link to={`/campaigns`} className="rt-gradient-btn mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold">Live Campaigns <ArrowRight className="h-4 w-4" /></Link></div>}
      {!s && !err && <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-white/60" /></div>}

      {s && (
        <main className="mx-auto grid max-w-5xl gap-8 px-5 pb-16 pt-2 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-white/10" data-testid="story-public-media">
            {s.media_type === "image" && <img src={fileUrl(s.media_url)} alt={s.title} className="h-full w-full object-cover" />}
            {s.media_type === "video" && <StoryVideo s={s} />}
            {s.media_type === "text" && (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center" style={{ background: `linear-gradient(180deg, ${s.bg_color || "#7f1d1d"}, #0B0F17)`, ...fontCss(s.font) }}>
                <div className="text-3xl leading-tight drop-shadow">{s.title}</div>
                {s.caption && <p className="mt-4 text-base text-white/90">{s.caption}</p>}
                {s.payout ? <div className="mt-5 rounded-full bg-amber-400 px-5 py-2 font-mono text-xl font-extrabold text-slate-900">Payout ₹{s.payout}</div> : null}
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-[11px] font-bold backdrop-blur">{s.category}</div>
            {s.media_type !== "video" && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-xs font-semibold text-white/80">Radhika Traders · Story</div>}
          </div>

          <section className="rt-fade-up">
            {s.referrer && <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-bold text-amber-200" data-testid="story-public-referrer"><Gift className="h-4 w-4" /> Shared by {s.referrer.name} · Radhika Traders partner</div>}
            <h1 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{s.title}</h1>
            {s.company && <p className="mt-1 text-sm font-semibold text-white/60">{s.company}</p>}
            {s.caption && s.media_type !== "text" && <p className="mt-4 text-base text-white/80">{s.caption}</p>}
            {s.payout ? <div className="mt-5 inline-flex items-baseline gap-2 rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10"><span className="text-xs font-bold uppercase tracking-wider text-white/60">Payout</span><span className="font-mono text-3xl font-extrabold text-amber-300">₹{s.payout}</span></div> : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {applyHref && <a href={applyHref} data-testid="story-public-apply" className="rt-gradient-btn inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold">Apply Now <ArrowRight className="h-4 w-4" /></a>}
              <Link to={joinHref} data-testid="story-public-join" className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold ${applyHref ? "border border-white/20 bg-white/5 hover:bg-white/10" : "rt-gradient-btn"}`}>{applyHref ? "Become a partner & earn" : "Join Radhika Traders"} <Sparkles className="h-4 w-4" /></Link>
              {s.link?.startsWith("http") && <a href={s.link} target="_blank" rel="noreferrer" data-testid="story-public-link" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold hover:bg-white/10">Learn more <ExternalLink className="h-4 w-4" /></a>}
            </div>
            <p className="mt-5 text-xs text-white/50">Radhika Traders — ₹0 investment, genuine campaigns, on-time payouts. {s.referrer ? `Join through ${s.referrer.name}'s link and they earn a referral reward.` : ""}</p>
          </section>
        </main>
      )}
    </div>
  );
}
