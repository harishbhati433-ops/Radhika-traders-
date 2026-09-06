import { useEffect, useState } from "react";
import api from "../lib/api";
import { LayoutGrid, LineChart, PiggyBank, CreditCard, ShieldCheck, Landmark, Megaphone, Coins, Briefcase } from "lucide-react";

const ICONS = [
  [/demat|trading|stock/i, LineChart, "from-red-600 to-red-800"],
  [/mutual|sip|fund/i, Coins, "from-amber-500 to-amber-700"],
  [/saving|bank|account/i, PiggyBank, "from-emerald-500 to-emerald-700"],
  [/credit|card/i, CreditCard, "from-sky-500 to-sky-700"],
  [/insur/i, ShieldCheck, "from-violet-500 to-violet-700"],
  [/loan|emi/i, Landmark, "from-rose-500 to-rose-700"],
  [/market|digital/i, Megaphone, "from-pink-500 to-pink-700"],
];
const pick = (name) => ICONS.find(([rx]) => rx.test(name)) || [null, Briefcase, "from-slate-600 to-slate-800"];

export function CategoryTiles({ value, onChange, counts = {} }) {
  const [cats, setCats] = useState([]);
  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data)).catch(() => {}); }, []);
  if (!cats.length) return null;

  const tile = "flex shrink-0 flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-center transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md min-w-[112px]";
  return (
    <div className="mb-6" data-testid="category-tiles">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Browse by product</div>
      <div className="flex gap-3 overflow-x-auto pb-2 rt-scroll">
        <button type="button" onClick={() => onChange("")} data-testid="category-tile-all"
          className={`${tile} ${!value ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
          <span className={`rounded-xl p-2.5 ${!value ? "bg-white/20" : "bg-slate-100"}`}><LayoutGrid className="h-5 w-5" /></span>
          <span className="text-xs font-bold">All Offers</span>
        </button>
        {cats.map((c) => {
          const [, Icon, grad] = pick(c.name);
          const active = value === c.name;
          return (
            <button key={c.id} type="button" onClick={() => onChange(active ? "" : c.name)} data-testid={`category-tile-${c.slug}`}
              className={`${tile} ${active ? "border-red-600 bg-red-50 text-red-700 ring-2 ring-red-200" : "border-slate-200 bg-white text-slate-700"}`}>
              <span className={`rounded-xl bg-gradient-to-br p-2.5 text-white ${grad}`}><Icon className="h-5 w-5" /></span>
              <span className="text-xs font-bold leading-tight">{c.name}</span>
              {counts[c.name] != null && <span className="text-[10px] font-semibold text-slate-400">{counts[c.name]} offer{counts[c.name] === 1 ? "" : "s"}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
