import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { customerNav } from "./nav";
import { CampaignCard } from "../../components/CampaignCard";
import api from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Search } from "lucide-react";

export default function CustomerCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/campaigns", { params: search ? { search } : {} }).then(({ data }) => setCampaigns(data));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <DashboardLayout nav={customerNav} title="Campaigns">
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input data-testid="mycampaigns-search" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c, i) => <CampaignCard key={c.id} c={c} index={i} />)}
      </div>
    </DashboardLayout>
  );
}
