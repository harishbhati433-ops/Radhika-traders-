import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import { CampaignCard } from "../../components/CampaignCard";
import { CategoryTiles } from "../../components/CategoryTiles";
import api from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Search } from "lucide-react";

export default function CustomerCampaigns() {
  const [all, setAll] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => { api.get("/campaigns").then(({ data }) => setAll(data)); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      api.get("/campaigns", { params }).then(({ data }) => setCampaigns(data));
    }, 250);
    return () => clearTimeout(t);
  }, [search, category]);

  const counts = all.reduce((m, c) => ({ ...m, [c.category]: (m[c.category] || 0) + 1 }), {});

  return (
    <DashboardLayout nav={customerNav} title="Campaigns">
      <CategoryTiles value={category} onChange={setCategory} counts={counts} />
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input data-testid="mycampaigns-search" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      {category && <h2 className="mb-3 font-display text-lg font-bold text-slate-900" data-testid="mycampaigns-heading">{category} <span className="text-sm font-normal text-slate-500">· {campaigns.length} offer{campaigns.length === 1 ? "" : "s"}</span></h2>}
      {campaigns.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500" data-testid="mycampaigns-empty">No offers in this category yet. Check back soon!</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c, i) => <CampaignCard key={c.id} c={c} index={i} />)}
        </div>
      )}
    </DashboardLayout>
  );
}
