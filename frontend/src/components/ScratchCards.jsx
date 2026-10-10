import { useEffect, useRef, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Gift, Sparkles, Lock } from "lucide-react";

function ScratchCard({ card, onDone }) {
  const ref = useRef(null);
  const busy = useRef(false);
  const [revealed, setRevealed] = useState(card.status === "scratched");
  const [amount, setAmount] = useState(card.amount);

  useEffect(() => {
    if (revealed) return;
    const cv = ref.current; const ctx = cv.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, "#f59e0b"); g.addColorStop(0.5, "#fbbf24"); g.addColorStop(1, "#d97706");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2, 2);
    ctx.fillStyle = "#78350f"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE", cv.width / 2, cv.height / 2 - 6);
    ctx.font = "12px sans-serif"; ctx.fillText("yahan rub karein", cv.width / 2, cv.height / 2 + 14);
  }, [revealed]);

  const finish = async () => {
    if (busy.current) return; busy.current = true;
    try {
      const { data } = await api.post(`/scratch-cards/${card.id}/scratch`);
      setAmount(data.amount); setRevealed(true);
      toast.success(`🎉 ₹${data.amount} unlocked to your Main Wallet!`);
      onDone?.(data);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); onDone?.(); }
  };

  const scratchAt = (e) => {
    if (revealed || busy.current) return;
    const cv = ref.current; const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height;
    const ctx = cv.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let clear = 0;
    for (let i = 3; i < d.length; i += 64) if (d[i] === 0) clear++;
    if (clear / (d.length / 64) > 0.45) finish();
  };

  return (
    <div data-testid={`scratch-card-${card.id}`} className={`relative w-44 shrink-0 overflow-hidden rounded-2xl border p-3 ${revealed ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-white"}`}>
      <div className="mb-2 truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">Lead {card.lead_ref}</div>
      <div className="relative h-24 select-none overflow-hidden rounded-xl bg-slate-900">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <Sparkles className={`h-4 w-4 text-amber-300 ${revealed ? "animate-bounce" : ""}`} />
          <div className="font-mono text-2xl font-extrabold" data-testid={`scratch-amount-${card.id}`}>₹{amount}</div>
          <div className="text-[10px] text-slate-300">{revealed ? "Moved to Main Wallet" : "Bonus unlock"}</div>
        </div>
        {!revealed && (
          <canvas ref={ref} width={176} height={96} data-testid={`scratch-canvas-${card.id}`} className="absolute inset-0 h-full w-full cursor-pointer touch-none"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scratchAt(e); }}
            onPointerMove={(e) => { if (e.buttons) scratchAt(e); }} />
        )}
      </div>
      <div className="mt-2 truncate text-[10px] text-slate-500">{card.campaign_name}</div>
    </div>
  );
}

export function ScratchCards({ onScratched }) {
  const [data, setData] = useState(null);
  const load = () => api.get("/scratch-cards").then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return null;
  const issued = data.cards.filter((c) => c.status === "issued");
  const done = data.cards.filter((c) => c.status === "scratched").slice(0, 6);
  if (!issued.length && !done.length) return null;
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5" data-testid="scratch-cards-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><div className="rounded-xl bg-amber-400 p-2 text-slate-900"><Gift className="h-5 w-5" /></div>
          <div><div className="font-display font-bold text-slate-900">Scratch Cards</div><div className="text-xs text-slate-600">Har approved lead par ek card — scratch karo aur Signup Bonus Main Wallet me unlock karo.</div></div></div>
        <div className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800" data-testid="scratch-bonus-remaining"><Lock className="h-3 w-3" /> Locked left: ₹{data.bonus.remaining} / ₹{data.bonus.total}</div>
      </div>
      {issued.length > 0 && <div className="mt-4 flex gap-3 overflow-x-auto pb-2 rt-scroll">{issued.map((c) => <ScratchCard key={c.id} card={c} onDone={(r) => { load(); onScratched?.(r); }} />)}</div>}
      {issued.length === 0 && <div className="mt-3 text-xs text-slate-500" data-testid="scratch-none-pending">Abhi koi naya card nahi — agli approved lead par milega.</div>}
      {done.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{done.map((c) => <span key={c.id} data-testid={`scratch-done-${c.id}`} className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">₹{c.amount} · {c.lead_ref}</span>)}</div>}
    </div>
  );
}
