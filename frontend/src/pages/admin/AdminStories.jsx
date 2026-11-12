import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Power, Pencil, Eye, Users, RefreshCw, Clock, Sparkles, Film, Image as ImageIcon, Type, X } from "lucide-react";
import { StoryViewersDialog } from "../../components/StoryViewersDialog";
import { STORY_FONTS, fontCss } from "../../lib/storyFonts";

const empty = { title: "", caption: "", category: "Radhika Updates", media_type: "image", media_url: "", media_path: "", bg_color: "#7c1d1d", font: "display", link: "", campaign_id: "", auto_expire: true, active: true };
const left = (iso) => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return "expired"; const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? `${h}h ${m}m left` : `${m}m left`; };

function MediaUpload({ f, setF }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const type = file.type || ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" }[ext] || "");
    if (type.startsWith("video/")) {
      if (file.size > 20 * 1024 * 1024) return toast.error("Video 20 MB se bada hai");
      const dur = await new Promise((res) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => res(v.duration); v.onerror = () => res(0); v.src = URL.createObjectURL(file); });
      if (dur > 31) return toast.error(`Video ${Math.round(dur)} sec ka hai — max 30 sec allowed`);
    } else if (!type.startsWith("image/")) return toast.error("Sirf photo (JPG/PNG/WEBP) ya video (MP4/WEBM/MOV) files allowed hain");
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file.type ? file : new File([file], file.name, { type }));
      const { data } = await api.post("/admin/stories/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 180000 });
      setF((x) => ({ ...x, media_url: data.url, media_path: data.path, media_type: data.media_type }));
      toast.success(`${data.media_type === "video" ? "Video" : "Photo"} uploaded (${Math.round(data.size / 1024)} KB)`);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label>Media (Photo / Video)</Label>
      <input ref={ref} type="file" accept="*/*" hidden onChange={pick} data-testid="story-file-input" />
      <div className="mt-1.5 flex items-center gap-3">
        <div className="relative flex h-28 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
          {f.media_url ? (f.media_type === "video" ? <video src={fileUrl(f.media_url)} className="h-full w-full object-cover" muted /> : <img src={fileUrl(f.media_url)} alt="" className="h-full w-full object-cover" />) : busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : <Upload className="h-5 w-5 text-slate-300" />}
          {f.media_url && <button type="button" onClick={() => setF((x) => ({ ...x, media_url: "", media_path: "" }))} className="absolute right-1 top-1 rounded-full bg-rose-500 p-0.5 text-white" data-testid="story-media-remove"><X className="h-3 w-3" /></button>}
        </div>
        <div className="text-xs text-slate-500">
          <button type="button" onClick={() => ref.current.click()} disabled={busy} data-testid="story-upload-btn" className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> {f.media_url ? "Change" : "Upload Photo / Video"}</>}</button>
          <div>Gallery, Files ya Drive — kahin se bhi chunein · Photo: JPG/PNG/WEBP, auto-compressed to WebP (max 8 MB) · Video: MP4/WEBM/MOV, max 20 MB / 30 sec · Best size 1080×1920 (9:16)</div>
        </div>
      </div>
    </div>
  );
}

function StoryForm({ initial, campaigns, categories, onSaved, onCancel }) {
  const [f, setF] = useState(initial || empty);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      if (f.id) await api.put(`/admin/stories/${f.id}`, { title: f.title, caption: f.caption, category: f.category, media_type: f.media_type, media_url: f.media_url, media_path: f.media_path, bg_color: f.bg_color, font: f.font || "display", link: f.link, auto_expire: f.auto_expire });
      else await api.post("/admin/stories", f);
      toast.success(f.id ? "Story updated" : "Story published"); onSaved();
    } catch (err) {
      if (f.id && err.response?.status === 404) { toast.error("Yeh story ab maujood nahi hai (delete ho chuki) — list refresh kar di"); onCancel?.(); onSaved?.(); return; }
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-2" data-testid="story-form">
      <div className="flex gap-2 lg:col-span-2">
        {[["image", ImageIcon, "Photo / Video"], ["text", Type, "Text Story"]].map(([v, I, l]) => <button key={v} type="button" onClick={() => setF({ ...f, media_type: v === "text" ? "text" : f.media_url && f.media_type === "video" ? "video" : "image" })} data-testid={`story-type-${v}`} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${(v === "text") === (f.media_type === "text") ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}><I className="h-4 w-4" /> {l}</button>)}
      </div>
      {f.media_type !== "text" ? <div className="lg:col-span-2"><MediaUpload f={f} setF={setF} /></div> : (
        <>
          <div><Label>Background colour</Label><input type="color" value={f.bg_color} onChange={set("bg_color")} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200" data-testid="story-bg-color" /></div>
          <div><Label>Font style</Label><select value={f.font || "display"} onChange={set("font")} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" data-testid="story-font">{Object.entries(STORY_FONTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="flex min-h-[120px] items-center justify-center rounded-2xl p-5 text-center text-white lg:col-span-2" style={{ background: f.bg_color, ...fontCss(f.font) }} data-testid="story-text-preview">
            <div><div className="text-2xl leading-tight">{f.title || "Story title preview"}</div>{f.caption && <p className="mt-2 text-sm opacity-90">{f.caption}</p>}</div>
          </div>
        </>
      )}
      <div><Label>Story Title</Label><Input value={f.title} onChange={set("title")} placeholder="ICICI MF Live Campaign" className="mt-1.5" data-testid="story-title" maxLength={80} /></div>
      <div><Label>Category</Label><select value={f.category} onChange={set("category")} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" data-testid="story-category">{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
      <div className="lg:col-span-2"><Label>Caption (optional)</Label><Textarea value={f.caption} onChange={set("caption")} placeholder="Payout ₹500 · Daily payment on approved leads" className="mt-1.5" rows={2} maxLength={300} data-testid="story-caption" /></div>
      {!f.id && <div><Label>Link to Campaign (optional)</Label><select value={f.campaign_id} onChange={set("campaign_id")} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" data-testid="story-campaign"><option value="">— None —</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.offer_name} ({c.status})</option>)}</select></div>}
      <div><Label>Custom link (optional)</Label><Input value={f.link} onChange={set("link")} placeholder="/campaigns or https://…" className="mt-1.5" disabled={!!f.campaign_id} data-testid="story-link" /></div>
      <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-slate-800 lg:col-span-2"><input type="checkbox" checked={f.auto_expire} onChange={set("auto_expire")} className="h-4 w-4 accent-red-600" data-testid="story-auto-expire" /><Clock className="h-4 w-4 text-amber-700" /> Auto Expire After 24 Hours <span className="font-normal text-slate-500">— untick to keep the story until you delete/deactivate it</span></label>
      <div className="flex justify-end gap-2 lg:col-span-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700" data-testid="story-cancel">Cancel</button>}
        <button type="submit" disabled={busy} className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60" data-testid="story-submit">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {f.id ? "Save Changes" : "Publish Story"}</button>
      </div>
    </form>
  );
}

function Status({ s }) {
  if (s.kind === "campaign" && !s.campaign_live) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Campaign not live</span>;
  if (!s.active) return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">Inactive</span>;
  if (s.expired) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Expired</span>;
  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live{s.expires_at ? ` · ${left(s.expires_at)}` : " · Permanent"}</span>;
}

function StoryCard({ s, onEdit, onPatch, onDelete, onViewers }) {
  const Icon = s.media_type === "video" ? Film : s.media_type === "text" ? Type : ImageIcon;
  return (
    <div className={`flex gap-3 rounded-2xl border bg-white p-3 ${s.visible ? "border-emerald-200" : "border-slate-200 opacity-90"}`} data-testid={`story-card-${s.id}`}>
      <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-white" style={{ background: s.media_type === "text" ? s.bg_color : undefined, ...(s.media_type === "text" ? fontCss(s.font) : {}) }}>
        {s.media_type === "image" && s.media_url ? <img src={fileUrl(s.media_url)} alt="" className="h-full w-full object-cover" loading="lazy" /> : s.media_type === "video" ? <Film className="h-6 w-6" /> : <span className="px-1 text-center text-[9px] leading-tight line-clamp-4">{s.title || "T"}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-slate-400" /><span className="truncate font-display text-sm font-bold text-slate-900">{s.title || s.category}</span><Status s={s} /></div>
        {s.caption && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{s.caption}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{s.category}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700" data-testid={`story-views-${s.id}`}><Eye className="h-3.5 w-3.5" /> {s.total_views} Views</span>
          <span className="inline-flex items-center gap-1" data-testid={`story-unique-${s.id}`}><Users className="h-3.5 w-3.5" /> {s.unique_viewers} Unique</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700" data-testid={`story-hearts-${s.id}`}>❤️ {s.hearts ?? 0}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-700" data-testid={`story-fires-${s.id}`}>🔥 {s.fires ?? 0}</span>
          <label className="inline-flex items-center gap-1 font-semibold"><input type="checkbox" checked={!!s.auto_expire} onChange={(e) => onPatch(s, { auto_expire: e.target.checked })} className="h-3.5 w-3.5 accent-red-600" data-testid={`story-expire-${s.id}`} /> 24h expiry</label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onViewers(s)} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white" data-testid={`story-viewers-${s.id}`}><Users className="h-3 w-3" /> Viewers</button>
          {s.kind !== "campaign" && <button type="button" onClick={() => onEdit(s)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700" data-testid={`story-edit-${s.id}`}><Pencil className="h-3 w-3" /> Edit</button>}
          <button type="button" onClick={() => onPatch(s, { active: !s.active })} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${s.active ? "border-slate-200 text-slate-700" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`} data-testid={`story-toggle-${s.id}`}><Power className="h-3 w-3" /> {s.active ? "Deactivate" : "Activate"}</button>
          {s.expired && s.active && <button type="button" onClick={() => onPatch(s, { republish: true })} className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800" data-testid={`story-republish-${s.id}`}><RefreshCw className="h-3 w-3" /> Republish</button>}
          {s.kind !== "campaign" && <button type="button" onClick={() => onDelete(s)} className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-700" data-testid={`story-delete-${s.id}`}><Trash2 className="h-3 w-3" /> Delete</button>}
        </div>
      </div>
    </div>
  );
}

export default function AdminStories() {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewers, setViewers] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef(null);
  const startEdit = (s) => { setEditing(s); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); toast.info(`Editing "${s.title || s.category}"`); };
  const load = () => api.get("/admin/stories").then(({ data }) => { setData(data); setEditing((e) => (e && !data.manual.some((s) => s.id === e.id) ? null : e)); }).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  useEffect(() => { load(); api.get("/campaigns", { params: { admin_view: true } }).then(({ data }) => setCampaigns(data)).catch(() => {}); }, []);
  const patch = async (s, body) => { try { await api.put(`/admin/stories/${s.id}`, body); toast.success(body.republish ? "Story republished — fresh 24h window" : "Saved"); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const del = async () => { const s = confirm; setConfirm(null); try { await api.delete(`/admin/stories/${s.id}`); toast.success("Story deleted"); load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const cats = data?.categories || ["Radhika Updates"];
  return (
    <DashboardLayout nav={adminNav} title="Stories">
      <p className="mb-4 text-sm text-slate-500">WhatsApp/Instagram-style stories shown on every customer's dashboard (below the greeting, above the banner slider). Customers can only view; views & viewer lists are tracked per customer.</p>
      {editing ? <div className="mb-8 scroll-mt-24" ref={formRef}><h2 className="mb-2 font-display text-lg font-bold text-slate-900">Edit Story</h2><StoryForm key={editing.id} initial={editing} campaigns={campaigns} categories={cats} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} /></div>
        : <div className="mb-8 scroll-mt-24" ref={formRef}><h2 className="mb-2 font-display text-lg font-bold text-slate-900">Add Story</h2><StoryForm key={formKey} campaigns={campaigns} categories={cats} onSaved={() => { setFormKey((k) => k + 1); load(); }} /></div>}
      <section className="mb-8">
        <h2 className="mb-2 font-display text-lg font-bold text-slate-900">Your Stories <span className="text-sm font-normal text-slate-500">({data?.manual.length ?? 0})</span></h2>
        {data && !data.manual.length && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500" data-testid="stories-empty">No stories yet — add your first story above.</p>}
        <div className="grid gap-3 lg:grid-cols-2" data-testid="stories-manual-list">{data?.manual.map((s) => <StoryCard key={s.id} s={s} onEdit={startEdit} onPatch={patch} onDelete={setConfirm} onViewers={setViewers} />)}</div>
      </section>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4" data-testid="stories-campaign-section">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Sparkles className="h-5 w-5 text-emerald-600" /> Automatic Live Campaign Stories <span className="text-sm font-normal text-slate-500">({data?.campaign.filter((s) => s.visible).length ?? 0} showing)</span></h2>
        <p className="mb-3 mt-1 text-xs text-slate-600">Every live campaign gets a story automatically using its existing poster/logo and details (no duplicate uploads). It updates when the campaign is edited and disappears when the campaign is paused/closed. The 24h expiry checkbox applies here too; a campaign that goes live again gets a fresh story.</p>
        <div className="grid gap-3 lg:grid-cols-2" data-testid="stories-campaign-list">{data?.campaign.map((s) => <StoryCard key={s.id} s={s} onEdit={() => {}} onPatch={patch} onDelete={() => {}} onViewers={setViewers} />)}</div>
      </section>
      {viewers && <StoryViewersDialog story={viewers} onClose={() => setViewers(null)} />}
      {confirm && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" data-testid="story-delete-confirm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="font-display text-lg font-bold text-slate-900">Delete this story?</h3>
            <p className="mt-1 text-sm text-slate-600">"{confirm.title || confirm.category}" will be removed from all customers immediately, along with its media file and viewer records.</p>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setConfirm(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold" data-testid="story-delete-cancel">Cancel</button><button type="button" onClick={del} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white" data-testid="story-delete-confirm-btn">Delete</button></div>
          </div>
        </div>,
        document.body
      )}
    </DashboardLayout>
  );
}
