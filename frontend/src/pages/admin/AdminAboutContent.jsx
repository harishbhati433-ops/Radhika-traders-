import { useEffect, useState } from "react";
import api, { formatApiErrorDetail, fileUrl } from "../../lib/api";
import { ImageUpload } from "../../components/ImageUpload";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Switch } from "../../components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Save, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Plus, Lock, UserRound, Target, Telescope } from "lucide-react";

const blankProfile = () => ({ id: "", locked: false, visible: true, name: "", title: "", photo_url: "", photo2_url: "", photo_pos: "center", bio: "", highlight: "", highlight_label: "" });
const POS = [["top", "Top (face near the top)"], ["center", "Center"], ["bottom", "Bottom"]];

function ProfileCard({ p, i, total, onChange, onMove, onDelete }) {
  const set = (k) => (e) => onChange({ ...p, [k]: e.target.value });
  const tid = `about-profile-${i}`;
  return (
    <div className={`rounded-2xl border p-4 ${p.visible ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50"}`} data-testid={tid}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <UserRound className="h-4 w-4 text-red-600" /> {p.name || "New profile"}
          {p.locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" data-testid={`${tid}-locked`}><Lock className="h-3 w-3" /> Founder — protected</span>}
          {!p.visible && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">HIDDEN</span>}
        </div>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">{p.visible ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5" />} Show
            <Switch data-testid={`${tid}-visible`} checked={p.visible} onCheckedChange={(v) => onChange({ ...p, visible: v })} /></label>
          <button type="button" onClick={() => onMove(-1)} disabled={i === 0} data-testid={`${tid}-up`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(1)} disabled={i === total - 1} data-testid={`${tid}-down`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={onDelete} disabled={p.locked} title={p.locked ? "Founder profile can be hidden but not deleted" : "Delete profile"} data-testid={`${tid}-delete`} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          {p.photo_url ? <img src={fileUrl(p.photo_url)} alt="" className="mb-2 h-40 w-full rounded-xl object-cover" style={{ objectPosition: p.photo_pos || "center" }} data-testid={`${tid}-photo`} /> : <div className="mb-2 flex h-40 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">No photo</div>}
          <ImageUpload label="" value={p.photo_url} onChange={(url) => onChange({ ...p, photo_url: url })} testId={`${tid}-upload`} />
          <Label className="mt-3 block text-xs">Photo focus (crop)</Label>
          <select data-testid={`${tid}-photo-pos`} value={p.photo_pos || "center"} onChange={set("photo_pos")} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
            {POS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {p.locked && (
            <div className="mt-3">
              <Label className="block text-xs">Second photo (About page, optional)</Label>
              {p.photo2_url && <img src={fileUrl(p.photo2_url)} alt="" className="my-1 h-20 w-full rounded-lg object-cover object-top" data-testid={`${tid}-photo2`} />}
              <div className="flex items-center gap-2">
                <ImageUpload label="" value={p.photo2_url} onChange={(url) => onChange({ ...p, photo2_url: url })} testId={`${tid}-upload2`} />
                {p.photo2_url && <button type="button" onClick={() => onChange({ ...p, photo2_url: "" })} data-testid={`${tid}-photo2-remove`} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>}
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Name</Label><Input data-testid={`${tid}-name`} value={p.name} onChange={set("name")} maxLength={80} className="mt-1.5" /></div>
          <div><Label>Designation / Post</Label><Input data-testid={`${tid}-title`} value={p.title} onChange={set("title")} maxLength={100} className="mt-1.5" placeholder="e.g. Head of Operations & Management" /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea data-testid={`${tid}-bio`} value={p.bio} onChange={set("bio")} maxLength={1200} className="mt-1.5 min-h-[88px]" /></div>
          <div><Label>Highlight (optional)</Label><Input data-testid={`${tid}-highlight`} value={p.highlight} onChange={set("highlight")} maxLength={12} className="mt-1.5" placeholder="e.g. 7+" /></div>
          <div><Label>Highlight label</Label><Input data-testid={`${tid}-highlight-label`} value={p.highlight_label} onChange={set("highlight_label")} maxLength={40} className="mt-1.5" placeholder="e.g. Years in the Market" /></div>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ k, icon: Icon, b, onChange }) {
  return (
    <div className={`rounded-2xl border p-4 ${b.visible ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50"}`} data-testid={`about-${k}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon className="h-4 w-4 text-red-600" /> {b.title || k}</div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">{b.visible ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5" />} Show
          <Switch data-testid={`about-${k}-visible`} checked={b.visible} onCheckedChange={(v) => onChange({ ...b, visible: v })} /></label>
      </div>
      <Label>Heading</Label><Input data-testid={`about-${k}-title`} value={b.title} onChange={(e) => onChange({ ...b, title: e.target.value })} maxLength={60} className="mt-1.5" />
      <Label className="mt-3 block">Content</Label><Textarea data-testid={`about-${k}-text`} value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} maxLength={1500} className="mt-1.5 min-h-[110px]" />
    </div>
  );
}

export function AdminAboutContent() {
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  useEffect(() => { api.get("/admin/about").then(({ data }) => setA(data)).catch(() => toast.error("Could not load About page content")); }, []);

  if (!a) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
  const profiles = a.profiles;
  const setProfiles = (p) => setA({ ...a, profiles: p });
  const move = (i, d) => { const p = [...profiles]; const j = i + d; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; setProfiles(p); };

  const save = async () => {
    if (profiles.some((p) => !p.name.trim() || !p.title.trim())) return toast.error("Every profile needs a name and a designation");
    setBusy(true);
    try { const { data } = await api.put("/admin/about", a); setA(data); toast.success("About page saved & published"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const confirmDelete = async () => {
    const next = { ...a, profiles: profiles.filter((_, k) => k !== pendingDelete) };
    setPendingDelete(null);
    setBusy(true);
    try { const { data } = await api.put("/admin/about", next); setA(data); toast.success("Profile deleted from the website"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6" data-testid="about-profiles-section">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-slate-900">Leadership Profiles ({profiles.length})</h2><p className="text-xs text-slate-500">Shown on the About page. Founder stays first & protected; add, edit, hide or delete the rest.</p></div>
          {profiles.length < 12 && <button type="button" onClick={() => setProfiles([...profiles, blankProfile()])} data-testid="about-profile-add" className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><Plus className="h-4 w-4" /> Add profile</button>}
        </div>
        <div className="space-y-4">
          {profiles.map((p, i) => <ProfileCard key={p.id || `new-${i}`} p={p} i={i} total={profiles.length} onChange={(np) => setProfiles(profiles.map((x, k) => (k === i ? np : x)))} onMove={(d) => move(i, d)} onDelete={() => (p.id ? setPendingDelete(i) : setProfiles(profiles.filter((_, k) => k !== i)))} />)}
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2" data-testid="about-mission-vision-section">
        <BlockEditor k="mission" icon={Target} b={a.mission} onChange={(b) => setA({ ...a, mission: b })} />
        <BlockEditor k="vision" icon={Telescope} b={a.vision} onChange={(b) => setA({ ...a, vision: b })} />
      </section>

      <div className="mb-10 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{a.updated_at ? `Last saved ${new Date(a.updated_at).toLocaleString("en-IN")}${a.updated_by ? ` by ${a.updated_by}` : ""}` : "Using default content"}</span>
        <button onClick={save} disabled={busy} data-testid="about-save" className="rt-gradient-btn inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-bold disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save & publish About page
        </button>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent data-testid="about-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete !== null ? profiles[pendingDelete]?.name : ""}" from the website?</AlertDialogTitle>
            <AlertDialogDescription>This removes the profile permanently from the About page immediately. If you only want to take it down for a while, use the Show switch instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="about-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="about-delete-confirm" onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Yes, delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
