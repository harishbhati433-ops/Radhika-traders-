import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Megaphone, Gift, PartyPopper, Camera, Bell, Sparkles } from "lucide-react";
import api, { fileUrl } from "../lib/api";
import { StoryViewer } from "./StoryViewer";

const ICONS = { "Radhika Updates": Bell, "Live Campaigns": Megaphone, Offers: Gift, "Festival Updates": PartyPopper, "Office Celebrations": Camera, Other: Sparkles };

export function StoriesBar() {
  const [stories, setStories] = useState(null);
  const [openIdx, setOpenIdx] = useState(-1);
  const { search, pathname } = useLocation();
  const nav = useNavigate();
  useEffect(() => { api.get("/stories").then(({ data }) => setStories(data)).catch(() => setStories([])); }, []);
  useEffect(() => {
    const want = new URLSearchParams(search).get("story");
    if (!want || !stories) return;
    const i = stories.findIndex((s) => s.id === want);
    if (i >= 0) setOpenIdx(i);
    nav(pathname, { replace: true }); // deep link from a bell notification → open that story once
  }, [stories, search]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!stories || !stories.length) return null;
  const markSeen = (id) => setStories((l) => l.map((s) => (s.id === id ? { ...s, seen: true } : s)));
  return (
    <div className="mb-5 rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-white to-amber-50 p-3 shadow-sm" data-testid="stories-bar">
      <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s, i) => {
          const Icon = ICONS[s.category] || Sparkles;
          const img = s.media_type === "image" ? s.media_url : s.logo_url;
          return (
            <button key={s.id} type="button" onClick={() => setOpenIdx(i)} data-testid={`story-ring-${s.id}`} className="group flex w-[68px] shrink-0 flex-col items-center gap-1.5">
              <span className={`rounded-full p-[3px] transition-transform group-active:scale-95 ${s.seen ? "bg-slate-300" : "bg-[conic-gradient(from_180deg,#f59e0b,#ef4444,#d946ef,#f59e0b)]"}`}>
                <span className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#0B0F17] text-amber-300">
                  {img ? <img src={fileUrl(img)} alt="" loading="lazy" className={`h-full w-full ${s.media_type === "image" ? "object-cover" : "bg-white object-contain p-1.5"}`} /> : <Icon className="h-6 w-6" />}
                </span>
              </span>
              <span className="line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight text-slate-700" data-testid={`story-label-${s.id}`}>{s.title || s.category}</span>
            </button>
          );
        })}
      </div>
      {openIdx >= 0 && <StoryViewer stories={stories} start={openIdx} onClose={() => setOpenIdx(-1)} onSeen={markSeen} />}
    </div>
  );
}
