import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Trash2, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";

export default function AdminTeam() {
  const [t, setT] = useState(null);
  const [busy, setBusy] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => { api.get("/admin/team").then(({ data }) => setT(data)).catch(() => toast.error("Could not load team settings")); }, []);

  const set = (k) => (e) => setT({ ...t, [k]: e.target.value });
  const photos = t?.photos || [];
  const setPhotos = (p) => setT({ ...t, photos: p });
  const move = (i, d) => { const p = [...photos]; const j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; setPhotos(p); };
  const remove = (i) => setPhotos(photos.filter((_, k) => k !== i));
  const caption = (i, v) => setPhotos(photos.map((p, k) => (k === i ? { ...p, caption: v } : p)));

  useEffect(() => { if (newUrl) { setPhotos([...photos, { url: newUrl, caption: "" }]); setNewUrl(""); } }, [newUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (next = t, msg = "Team section saved — homepage updated") => {
    setBusy(true);
    try { const { data } = await api.put("/admin/team", next); setT(data); toast.success(msg); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const toggleVisible = (v) => { const next = { ...t, visible: v }; setT(next); save(next, v ? "Team section is now visible on the homepage" : "Team section hidden from the homepage"); };

  if (!t) return <DashboardLayout nav={adminNav} title="Team Photos"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></DashboardLayout>;

  return (
    <DashboardLayout nav={adminNav} title="Team Photos">
      <p className="mb-4 text-sm text-slate-500">Controls the "Radhika Traders Team" section on the public homepage. Upload photos, reorder them, change the heading, or hide the whole section.</p>

      <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 lg:grid-cols-2" data-testid="team-text-form">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 lg:col-span-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{t.visible ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-slate-400" />} Show Team section on homepage</div>
            <div className="mt-0.5 text-[11px] text-slate-500" data-testid="team-visible-state">{t.visible ? "Visible — saves instantly when you switch it off." : "Hidden — photos stay saved, nothing is shown on the homepage."}</div>
          </div>
          <Switch data-testid="team-visible-toggle" checked={t.visible} disabled={busy} onCheckedChange={toggleVisible} />
        </div>
        <div><Label>Small label (above heading)</Label><Input data-testid="team-eyebrow" value={t.eyebrow} onChange={set("eyebrow")} className="mt-1.5" maxLength={60} /></div>
        <div><Label>Heading</Label><Input data-testid="team-heading" value={t.heading} onChange={set("heading")} className="mt-1.5" maxLength={80} /></div>
        <div className="lg:col-span-2"><Label>Description / lines below heading (press Enter for a new line)</Label><Textarea data-testid="team-description" value={t.description} onChange={set("description")} className="mt-1.5 min-h-[96px]" maxLength={600} placeholder="e.g. Hamari team har campaign, payout aur celebration ke peeche khadi hai.&#10;Agar (M.P.) office se 2023 se aapki seva mein." /></div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6" data-testid="team-photos-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-slate-900">Photos ({photos.length}/12)</h2><p className="text-xs text-slate-500">First photo shows large. Use landscape photos for best results.</p></div>
          {photos.length < 12 && <ImageUpload label="" value="" onChange={setNewUrl} testId="team-photo-upload" />}
        </div>
        {photos.length === 0 && <p className="text-sm text-slate-500" data-testid="team-photos-empty">No photos yet — upload one above.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <div key={`${p.url}-${i}`} data-testid={`team-photo-card-${i}`} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="relative">
                <img src={fileUrl(p.url)} alt="" className="h-40 w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-slate-900">MAIN</span>}
              </div>
              <div className="space-y-2 p-3">
                <Input data-testid={`team-photo-caption-${i}`} value={p.caption} onChange={(e) => caption(i, e.target.value)} placeholder="Caption (optional)" className="h-8 text-xs" maxLength={80} />
                <div className="flex justify-end gap-1">
                  <button onClick={() => move(i, -1)} disabled={i === 0} data-testid={`team-photo-up-${i}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} data-testid={`team-photo-down-${i}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => remove(i)} data-testid={`team-photo-remove-${i}`} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{t.updated_at ? `Last saved ${new Date(t.updated_at).toLocaleString("en-IN")}${t.updated_by ? ` by ${t.updated_by}` : ""}` : "Using default photos"}</span>
        <button onClick={() => save()} disabled={busy} data-testid="team-save" className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & publish
        </button>
      </div>
    </DashboardLayout>
  );
}
