import { useEffect, useState } from "react";
import api from "../lib/api";
import { Trophy, Crown, Medal } from "lucide-react";

const rankTone = ["bg-amber-400 text-slate-950", "bg-slate-300 text-slate-900", "bg-amber-700 text-white"];

export function Leaderboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/leaderboard").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="leaderboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5"><Trophy className="h-5 w-5 text-amber-600" /></div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Top Earners</h2>
            <div className="text-xs text-slate-500" data-testid="leaderboard-month">{data?.month || "This month"} · {data?.total_partners ?? 0} partners earning</div>
          </div>
        </div>
        {data?.me && (
          <div className="rounded-full bg-red-50 px-4 py-1.5 text-xs font-bold text-red-700" data-testid="leaderboard-my-rank">
            Your rank: #{data.me.rank} · ₹{data.me.earned}
          </div>
        )}
      </div>

      {data && data.top.length === 0 && (
        <p className="mt-6 text-sm text-slate-500" data-testid="leaderboard-empty">No earnings recorded this month yet. Share a campaign and be the first on the board!</p>
      )}

      <ol className="mt-5 space-y-2">
        {data?.top.map((r) => (
          <li key={r.rank} data-testid={`leaderboard-row-${r.rank}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${r.is_me ? "bg-red-50 ring-1 ring-red-200" : r.rank <= 3 ? "bg-amber-50/60" : "bg-slate-50"}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${rankTone[r.rank - 1] || "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
              {r.rank === 1 ? <Crown className="h-4 w-4" /> : r.rank <= 3 ? <Medal className="h-4 w-4" /> : r.rank}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{r.name}{r.is_me && <span className="ml-1.5 text-xs font-bold text-red-600">(You)</span>}</div>
              <div className="text-[11px] text-slate-500">{r.count} conversion{r.count === 1 ? "" : "s"}</div>
            </div>
            <div className="font-mono text-sm font-bold text-emerald-600">₹{r.earned}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
