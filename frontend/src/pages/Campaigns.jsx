import { useEffect, useState, useCallback } from "react";
import { PublicLayout } from "../components/PublicLayout";
import { CampaignCard } from "../components/CampaignCard";
import api from "../lib/api";
import { Input } from "../components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

const TYPES = ["First Trade", "Non-Trade", "SIP", "Account Opening"];

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [ctype, setCtype] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (category) params.category = category;
    if (ctype) params.campaign_type = ctype;
    const { data } = await api.get("/campaigns", { params });
    setCampaigns(data);
    setLoading(false);
  }, [search, category, ctype]);

  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-6 py-12">
        <span className="text-xs font-bold uppercase tracking-wider text-red-600">All Offers</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Affiliate Campaigns</h1>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input data-testid="campaign-search" placeholder="Search by name or company..." value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto rt-scroll">
              <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
              <select data-testid="filter-category" value={category} onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <option value="">All Categories</option>
                {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select data-testid="filter-type" value={ctype} onChange={(e) => setCtype(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                <option value="">All Types</option>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" /></div>
        ) : campaigns.length === 0 ? (
          <p className="py-20 text-center text-slate-500" data-testid="no-campaigns">No campaigns found. Try different filters.</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c, i) => <CampaignCard key={c.id} c={c} index={i} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
