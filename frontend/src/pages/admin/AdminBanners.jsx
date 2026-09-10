import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Power, Loader2, Sparkles } from "lucide-react";
import { AutoBannerList } from "../../components/AutoBannerList";

const empty = { title: "", subtitle: "", image_url: "", link: "", campaign_id: "", enabled: true, order: 0 };

export default function AdminBanners() {
  const [list, setList] = useState([]);
  const [autos, setAutos] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/banners", { params: { all: true } }).then(({ data }) => { setList(data.manual || []); setAutos(data.auto || []); });
  useEffect(() => { load(); api.get("/campaigns", { params: { admin_view: true } }).then(({ data }) => setCampaigns(data)).catch(() => {}); }, []);

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
      <p className="mb-3 text-sm text-slate-500">These banners appear on every customer's dashboard after login. Use them to highlight payouts, e.g. "Choice Trade — ₹300 per account".</p>
      <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5" data-testid="banners-auto-section">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Sparkles className="h-5 w-5 text-emerald-600" /> Automatic campaign banners</h2>
        <p className="mb-4 mt-1 text-xs text-slate-600" data-testid="banners-auto-note">Every <b>live</b> campaign gets a banner here automatically — with its name, type, payout, fund requirement, customer benefit and a LIVE badge — and rotates in the customer slider. It updates when you edit the campaign and disappears the moment the campaign is paused, disabled or deleted. Reorder, hide or change the headline below.</p>
        <AutoBannerList autos={autos} reload={load} />
      </section>
      <h2 className="mb-2 font-display text-lg font-bold text-slate-900">Custom banners (optional)</h2>
      <form onSubmit={add} className="mb-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-2" data-testid="banner-form">
        <div className="lg:col-span-2"><ImageUpload label="Banner image — use 1200×400 px (3:1). The full image is always shown, nothing is cropped." value={f.image_url} onChange={(v) => setF({ ...f, image_url: v })} testId="banner-upload" /></div>
        <div><Label>Title</Label><Input data-testid="banner-title" value={f.title} onChange={set("title")} placeholder="Choice Trade" className="mt-1.5" /></div>
        <div><Label>Payout / Subtitle</Label><Input data-testid="banner-subtitle" value={f.subtitle} onChange={set("subtitle")} placeholder="₹300 per account opening" className="mt-1.5" /></div>
        <div><Label>Campaign (banner click → lead form → partner site)</Label>
          <select data-testid="banner-campaign" value={f.campaign_id} onChange={set("campaign_id")} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">— No campaign (use custom link) —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.offer_name} ({c.status})</option>)}
          </select>
        </div>
        <div><Label>Custom link (only if no campaign selected)</Label><Input data-testid="banner-link" value={f.link} onChange={set("link")} placeholder="/campaigns" className="mt-1.5" disabled={!!f.campaign_id} /></div>
        <div><Label>Order</Label><Input data-testid="banner-order" type="number" value={f.order} onChange={set("order")} className="mt-1.5" /></div>
        <div className="lg:col-span-2 flex justify-end">
          <button type="submit" data-testid="banner-add" disabled={busy} className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Banner
          </button>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {list.length === 0 && <p className="text-sm text-slate-500" data-testid="banner-empty">No custom banners.</p>}
        {list.map((b) => (
          <div key={b.id} data-testid={`banner-${b.id}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img src={fileUrl(b.image_url)} alt={b.title} className="aspect-[3/1] w-full bg-[#0B0F17] object-contain" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{b.title || "Untitled"}</div>
                <div className="truncate text-xs text-slate-500">{b.subtitle} {b.campaign_name ? `· → ${b.campaign_name}${b.campaign_live ? "" : " (inactive)"}` : b.link && `· ${b.link}`}</div>
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
