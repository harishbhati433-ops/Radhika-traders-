import { Diya } from "./FestivalTheme";

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
  ganesh: <Glyph ch="🕉️" label="ganesh" />,
  janmashtami: <Glyph ch="🦚" label="janmashtami" extra={<span className="flute" />} />,
  shivratri: <Glyph ch="🔱" label="shivratri" extra={<span className="moon" />} />,
};

export function FestivalMotif({ fest, compact }) {
  if (fest.key === "diwali") return <Diya fest={fest} compact={compact} />;
  const m = MAP[fest.key] || <Glyph ch={fest.emoji} label={fest.key} />;
  return <div className={`motif-wrap ${compact ? "scale-75" : ""}`} data-testid="festival-motif" data-festival={fest.key}>{m}</div>;
}
