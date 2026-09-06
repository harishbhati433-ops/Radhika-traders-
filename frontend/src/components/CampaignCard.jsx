import { Link } from "react-router-dom";
import { StatusBadge } from "./StatusBadge";
import { fileUrl } from "../lib/api";
import { ArrowRight, TrendingUp } from "lucide-react";

export function CampaignCard({ c, index = 0 }) {
  return (
    <Link
      to={`/campaign/${c.slug}`}
      data-testid={`campaign-card-${c.slug}`}
      className="group rt-fade-up flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:rt-gold-card"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logo_url ? (
            <img src={fileUrl(c.logo_url)} alt={c.company} className="h-11 w-11 rounded-xl object-cover border border-slate-100" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-900 text-white font-display font-bold">
              {(c.company || c.offer_name || "R").charAt(0)}
            </div>
          )}
          <div>
            <h3 className="font-display text-base font-bold leading-tight text-slate-900">{c.offer_name}</h3>
            <p className="text-xs text-slate-500">{c.company}</p>
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {c.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{c.category}</span>}
        {c.campaign_type && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-300/40">{c.campaign_type}</span>}
      </div>

      <p className="mb-4 line-clamp-2 text-sm text-slate-600">{c.benefits || c.description}</p>

      <div className="mt-auto flex items-end justify-between border-t border-dashed border-slate-200 pt-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payout</p>
          <p className="font-mono text-xl font-bold text-emerald-600 flex items-center gap-1">
            <TrendingUp className="h-4 w-4" /> ₹{c.payout_amount}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-700 group-hover:gap-2 transition-all">
          Details <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
