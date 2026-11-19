import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Diya } from "./FestivalTheme";
import { enableSound, toggleSound, isSoundOn, onSoundChange, playBurst } from "../lib/fireworksSound";

const HOLI = ["#ec4899", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#f97316"];

function Holi() {
  return (
    <div className="motif" data-testid="festival-motif-holi">
      {HOLI.map((c, i) => <span key={c} className="holi-puff" style={{ "--c": c, left: `${4 + i * 18}%`, top: `${10 + ((i * 29) % 40)}%`, animationDelay: `${i * 0.35}s` }} />)}
      <span className="holi-pichkari" />
    </div>
  );
}

function Flag() {
  return (
    <div className="motif" data-testid="festival-motif-flag">
      <span className="flag-pole" />
      <div className="flag"><span className="flag-band" style={{ background: "#FF9933" }} /><span className="flag-band flag-white"><span className="chakra" /></span><span className="flag-band" style={{ background: "#138808" }} /></div>
    </div>
  );
}

function Kite() {
  return (
    <div className="motif" data-testid="festival-motif-kite">
      <div className="kite"><span className="kite-body" /><span className="kite-spine" /><span className="kite-tail">{[0, 1, 2, 3].map((i) => <i key={i} />)}</span></div>
      <div className="kite kite-2"><span className="kite-body" style={{ background: "linear-gradient(135deg,#f472b6 50%,#fbbf24 50%)" }} /><span className="kite-spine" /><span className="kite-tail">{[0, 1, 2].map((i) => <i key={i} />)}</span></div>
    </div>
  );
}

function Tree() {
  return (
    <div className="motif" data-testid="festival-motif-tree">
      <span className="tree-star" />
      <span className="tree-tier t1" /><span className="tree-tier t2" /><span className="tree-tier t3" /><span className="tree-trunk" />
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="tree-bulb" style={{ left: `${35 + ((i * 23) % 32)}%`, top: `${30 + i * 10}%`, "--c": ["#f87171", "#facc15", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa"][i], animationDelay: `${i * 0.3}s` }} />)}
    </div>
  );
}

function Fireworks() {
  return (
    <div className="motif" data-testid="festival-motif-fireworks">
      {[0, 1, 2].map((i) => <span key={i} className="fw" style={{ left: `${25 + i * 25}%`, top: `${30 + (i % 2) * 25}%`, "--c": ["#fde68a", "#f472b6", "#60a5fa"][i], animationDelay: `${i * 0.9}s` }} />)}
    </div>
  );
}

function Rakhi() {
  return (
    <div className="motif" data-testid="festival-motif-rakhi">
      <span className="rakhi-thread l" /><span className="rakhi-thread r" />
      <span className="rakhi-disc"><span className="rakhi-core" /></span>
    </div>
  );
}

function Dandiya() {
  return (
    <div className="motif" data-testid="festival-motif-dandiya">
      <span className="stick s1" /><span className="stick s2" />
      {[0, 1, 2, 3].map((i) => <span key={i} className="spark" style={{ left: `${30 + i * 14}%`, top: `${20 + (i % 2) * 15}%`, animationDelay: `${i * 0.4}s` }} />)}
    </div>
  );
}

// Dussehra: Ram's bow & arrow with the Ravan-dahan glow — distinct from Navratri's dandiya sticks.
function BowArrow() {
  return (
    <div className="motif" data-testid="festival-motif-dussehra">
      <span className="glyph-halo" style={{ "--c": "#fbbf24" }} /><span className="glyph-halo h2" />
      <span className="glyph" role="img" aria-label="dussehra">🏹</span>
      {[0, 1, 2].map((i) => <span key={i} className="spark" style={{ left: `${22 + i * 26}%`, top: `${8 + (i % 2) * 12}%`, background: "#fb923c", animationDelay: `${i * 0.5}s` }} />)}
    </div>
  );
}

function Glyph({ ch, label, extra }) {
  return (
    <div className="motif" data-testid={`festival-motif-${label}`}>
      <span className="glyph-halo" /><span className="glyph-halo h2" />
      <span className="glyph" role="img" aria-label={label}>{ch}</span>
      {extra}
    </div>
  );
}

const MAP = {
  holi: <Holi />,
  independence: <Flag />,
  republic: <Flag />,
  sankranti: <Kite />,
  christmas: <Tree />,
  newyear: <Fireworks />,
  rakhi: <Rakhi />,
  navratri: <Dandiya />,
  dussehra: <BowArrow />,
  ganesh: <Glyph ch={<span style={{ color: "var(--fest-accent2)", fontFamily: "serif", fontWeight: 700 }}>ॐ</span>} label="ganesh" />,
  janmashtami: <Glyph ch="🦚" label="janmashtami" extra={<span className="flute" />} />,
  shivratri: <Glyph ch="🔱" label="shivratri" extra={<span className="moon" />} />,
};

export function FestivalMotif({ fest, compact }) {
  if (fest.key === "diwali") return <Diya fest={fest} compact={compact} />;
  const m = MAP[fest.key] || <Glyph ch={fest.emoji} label={fest.key} />;
  if (fest.fireworks) return <CrackerMotif fest={fest} compact={compact}>{m}</CrackerMotif>;
  return <div className={`motif-wrap ${compact ? "scale-75" : ""}`} data-testid="festival-motif" data-festival={fest.key}>{m}</div>;
}

// Dussehra / New Year: no diya, so the festival motif itself is the tap target that starts cracker sounds (never auto-starts).
function CrackerMotif({ fest, compact, children }) {
  const [sound, setSound] = useState(isSoundOn());
  useEffect(() => onSoundChange(setSound), []);
  const fire = () => { enableSound(); playBurst(true); window.dispatchEvent(new CustomEvent("rt-fireworks-burst", { detail: { count: 3 } })); };
  const toggle = (e) => { e.stopPropagation(); toggleSound(); };
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={fire} aria-label="Tap for crackers" data-testid="festival-cracker-btn" className={`motif-wrap cursor-pointer rounded-3xl transition-transform active:scale-95 ${compact ? "scale-75" : ""}`} data-festival={fest.key}>{children}</button>
      <button type="button" onClick={sound ? toggle : fire} data-testid="festival-sound-toggle" aria-pressed={sound} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1" style={{ background: "color-mix(in srgb, var(--fest-accent) 20%, transparent)", color: "var(--fest-accent2)", borderColor: "var(--fest-accent)" }}>
        {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {sound ? "पटाखों की आवाज़ चालू" : "पटाखे चलाने के लिए tap करें"}
      </button>
    </div>
  );
}
