import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, ExternalLink, Pause, Play } from "lucide-react";
import api, { fileUrl } from "../lib/api";

const IMAGE_MS = 5000;
const seenThisSession = new Set();

const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

export function StoryViewer({ stories, start = 0, onClose, onSeen }) {
  const nav = useNavigate();
  const [idx, setIdx] = useState(start);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const vidRef = useRef(null);
  const raf = useRef(0);
  const s = stories[idx];
  const isVideo = s.media_type === "video";

  useEffect(() => {
    if (!s) return;
    if (!seenThisSession.has(s.id)) { seenThisSession.add(s.id); api.post(`/stories/${s.id}/view`).catch(() => {}); onSeen?.(s.id); }
    setProgress(0);
    if (isVideo) return;
    let startAt = performance.now(), acc = 0;
    const tick = (t) => {
      if (!paused) { acc += t - startAt; }
      startAt = t;
      const p = Math.min(1, acc / IMAGE_MS); setProgress(p);
      if (p >= 1) return next();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [idx, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => (idx + 1 < stories.length ? setIdx(idx + 1) : onClose());
  const prev = () => setIdx(Math.max(0, idx - 1));
  const onVideoTime = (e) => { const v = e.target; if (v.duration) setProgress(v.currentTime / v.duration); };
  const togglePause = () => { setPaused((p) => { const n = !p; if (vidRef.current) n ? vidRef.current.pause() : vidRef.current.play(); return n; }); };
  const openLink = () => { onClose(); if (s.link?.startsWith("http")) window.open(s.link, "_blank"); else nav(s.link); };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95" data-testid="story-viewer" onClick={onClose}>
      <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-black sm:h-[92vh] sm:rounded-3xl" onClick={(e) => e.stopPropagation()} style={{ background: s.media_type === "text" ? s.bg_color || "#7c1d1d" : "#000" }}>
        {/* progress */}
        <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-3 pt-3" data-testid="story-progress">
          {stories.map((_, i) => <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"><span className="block h-full bg-white transition-[width] duration-100" style={{ width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%" }} /></span>)}
        </div>
        {/* header */}
        <div className="absolute left-0 right-0 top-6 z-20 flex items-center gap-2 px-3 text-white">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-[#0B0F17]">{s.logo_url ? <img src={fileUrl(s.logo_url)} alt="" className="h-full w-full bg-white object-contain p-1" /> : <span className="font-display text-sm font-extrabold text-amber-400">RT</span>}</span>
          <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-bold" data-testid="story-viewer-title">{s.kind === "campaign" ? s.title : "Radhika Traders"}</div><div className="truncate text-[11px] text-white/70">{s.category} · {ago(s.published_at)}</div></div>
          <button type="button" onClick={togglePause} className="rounded-full bg-white/15 p-2" data-testid="story-pause">{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-2" data-testid="story-close" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {/* media */}
        <div className="flex h-full w-full items-center justify-center">
          {s.media_type === "image" && <img src={fileUrl(s.media_url)} alt={s.title} className="max-h-full w-full object-contain" data-testid="story-media-image" />}
          {isVideo && <video ref={vidRef} src={fileUrl(s.media_url)} autoPlay playsInline onTimeUpdate={onVideoTime} onEnded={next} className="max-h-full w-full object-contain" data-testid="story-media-video" />}
          {s.media_type === "text" && (
            <div className="px-8 text-center text-white" data-testid="story-media-text">
              <div className="font-display text-3xl font-extrabold leading-tight drop-shadow">{s.title}</div>
              {s.caption && <p className="mt-4 text-base leading-relaxed text-white/90">{s.caption}</p>}
              {s.payout ? <div className="mt-5 inline-block rounded-full bg-amber-400 px-5 py-2 font-mono text-xl font-extrabold text-slate-900">Payout ₹{s.payout}</div> : null}
            </div>
          )}
        </div>
        {/* caption + CTA */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-14 text-white">
          {s.media_type !== "text" && (s.title || s.caption) && <div className="mb-3"><div className="font-display text-lg font-bold">{s.title}</div>{s.caption && <p className="text-sm text-white/85" data-testid="story-caption">{s.caption}</p>}</div>}
          {s.link && <button type="button" onClick={openLink} data-testid="story-cta" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 active:scale-[.98]"><ExternalLink className="h-4 w-4" /> {s.kind === "campaign" ? "Open Campaign" : "Learn More"}</button>}
        </div>
        {/* tap zones */}
        <button type="button" aria-label="Previous" onClick={prev} className="absolute inset-y-24 left-0 z-10 w-1/3" data-testid="story-prev" />
        <button type="button" aria-label="Next" onClick={next} className="absolute inset-y-24 right-0 z-10 w-1/3" data-testid="story-next" />
        <ChevronLeft className="pointer-events-none absolute left-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 text-white/60 sm:block" />
        <ChevronRight className="pointer-events-none absolute right-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 text-white/60 sm:block" />
      </div>
    </div>,
    document.body
  );
}
