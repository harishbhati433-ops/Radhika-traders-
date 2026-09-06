import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Power } from "lucide-react";

export default function AdminCategories() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState("");

  const load = () => api.get("/categories?all=true").then(({ data }) => setCats(data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await api.post("/categories", { name, enabled: true }); setName(""); load(); toast.success("Category added"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  const toggle = async (c) => { await api.put(`/categories/${c.id}`, { enabled: !c.enabled }); load(); };
  const del = async (c) => { if (!window.confirm(`Delete "${c.name}"?`)) return; await api.delete(`/categories/${c.id}`); load(); toast.success("Deleted"); };

  return (
    <DashboardLayout nav={adminNav} title="Categories">
      <form onSubmit={add} className="mb-6 flex gap-2">
        <Input data-testid="category-name" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <button type="submit" data-testid="category-add" className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold"><Plus className="h-4 w-4" /> Add</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <div key={c.id} data-testid={`category-${c.slug}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <div className="font-semibold text-slate-800">{c.name}</div>
              <div className={`text-xs font-bold ${c.enabled ? "text-emerald-600" : "text-slate-400"}`}>{c.enabled ? "Enabled" : "Disabled"}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggle(c)} data-testid={`category-toggle-${c.slug}`} className={`rounded-lg p-2 ${c.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}><Power className="h-4 w-4" /></button>
              <button onClick={() => del(c)} data-testid={`category-delete-${c.slug}`} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
