import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Power, Loader2 } from "lucide-react";

const empty = { title: "", subtitle: "", image_url: "", link: "", enabled: true, order: 0 };

export default function AdminBanners() {
  const [list, setList] = useState([]);
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/banners", { params: { all: true } }).then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    if (!f.image_url) return toast.error("Please upload a banner image first");
    setBusy(true);
    try { await api.post("/admin/banners", { ...f, order: Number(f.order) || 0 }); setF(empty); load(); toast.success("Banner added"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const toggle = async (b) => { await api.put(`/admin/banners/${b.id}`, { ...b, enabled: !b.enabled }); load(); };
  const del = async (b) => { if (!window.confirm("Delete this banner?")) return; await api.delete(`/admin/banners/${b.id}`); load(); toast.success("Deleted"); };

  return (
    <DashboardLayout nav={adminNav} title="Offer Banners">
      <p className="mb-6 text-sm text-slate-500">These banners appear on every customer's dashboard after login. Use them to highlight payouts, e.g. "Choice Trade — ₹300 per account".</p>
      <form onSubmit={add} className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-2" data-testid="banner-form">
        <div className="lg:col-span-2"><ImageUpload label="Banner image (recommended 1200×400)" value={f.image_url} onChange={(v) => setF({ ...f, image_url: v })} testId="banner-upload" /></div>
        <div><Label>Title</Label><Input data-testid="banner-title" value={f.title} onChange={set("title")} placeholder="Choice Trade" className="mt-1.5" /></div>
        <div><Label>Payout / Subtitle</Label><Input data-testid="banner-subtitle" value={f.subtitle} onChange={set("subtitle")} placeholder="₹300 per account opening" className="mt-1.5" /></div>
        <div><Label>Link (optional)</Label><Input data-testid="banner-link" value={f.link} onChange={set("link")} placeholder="/campaign/choice-trade" className="mt-1.5" /></div>
        <div><Label>Order</Label><Input data-testid="banner-order" type="number" value={f.order} onChange={set("order")} className="mt-1.5" /></div>
        <div className="lg:col-span-2 flex justify-end">
          <button type="submit" data-testid="banner-add" disabled={busy} className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Banner
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {list.length === 0 && <p className="text-sm text-slate-500" data-testid="banner-empty">No banners yet.</p>}
        {list.map((b) => (
          <div key={b.id} data-testid={`banner-${b.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={fileUrl(b.image_url)} alt={b.title} className="h-36 w-full object-cover" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{b.title || "Untitled"}</div>
                <div className="truncate text-xs text-slate-500">{b.subtitle} {b.link && `· ${b.link}`}</div>
                <div className={`text-xs font-bold ${b.enabled ? "text-emerald-600" : "text-slate-400"}`}>{b.enabled ? "Visible" : "Hidden"} · order {b.order}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => toggle(b)} data-testid={`banner-toggle-${b.id}`} className={`rounded-lg p-2 ${b.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}><Power className="h-4 w-4" /></button>
                <button onClick={() => del(b)} data-testid={`banner-delete-${b.id}`} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
