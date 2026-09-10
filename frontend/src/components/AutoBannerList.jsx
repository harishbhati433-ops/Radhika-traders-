import { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatApiErrorDetail, fileUrl } from "../lib/api";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Radio, Save, X } from "lucide-react";

function AutoRow({ b, idx, total, onMove, onToggle, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [h, setH] = useState(b.title);
  const [t, setT] = useState(b.subtitle);
  const save = async () => {
    try { await api.patch(`/admin/campaigns/${b.campaign_id}/slider`, { banner_headline: h, banner_tagline: t }); toast.success("Banner text saved"); setEdit(false); onSaved(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div data-testid={`auto-banner-${b.campaign_id}`} className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3 ${b.enabled ? "border-slate-200" : "border-dashed border-slate-300 opacity-70"}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0B0F17] text-amber-400 font-display font-bold">
        {b.image_url ? <img src={fileUrl(b.image_url)} alt="" className="h-full w-full object-cover" /> : b.logo_url ? <img src={fileUrl(b.logo_url)} alt="" className="h-full w-full object-cover" /> : (b.title || "?")[0]}
      </div>
      <div className="min-w-0 flex-1">
        {edit ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Input value={h} onChange={(e) => setH(e.target.value)} placeholder="Headline (default: campaign name)" data-testid={`auto-banner-headline-${b.campaign_id}`} className="h-8 text-xs" />
            <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Tagline (default: payout line)" data-testid={`auto-banner-tagline-${b.campaign_id}`} className="h-8 text-xs" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5"><span className="truncate font-semibold text-slate-900">{b.title}</span><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700"><Radio className="h-3 w-3" /> live</span>{b.campaign_type && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">{b.campaign_type}</span>}</div>
            <div className="truncate text-xs text-slate-500">{b.subtitle || "—"} · {b.company} {b.image_url ? "· uses uploaded banner image" : "· auto-designed card"}</div>
            <div className={`text-[11px] font-bold ${b.enabled ? "text-emerald-600" : "text-slate-400"}`} data-testid={`auto-banner-state-${b.campaign_id}`}>{b.enabled ? "Visible in slider" : "Hidden from slider"} · position {idx + 1}</div>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {edit ? (
          <>
            <button onClick={save} data-testid={`auto-banner-save-${b.campaign_id}`} className="rounded-lg bg-slate-900 p-2 text-white" title="Save"><Save className="h-4 w-4" /></button>
            <button onClick={() => setEdit(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Cancel"><X className="h-4 w-4" /></button>
          </>
        ) : (
          <>
            <button onClick={() => onMove(-1)} disabled={idx === 0} data-testid={`auto-banner-up-${b.campaign_id}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move up"><ArrowUp className="h-4 w-4" /></button>
            <button onClick={() => onMove(1)} disabled={idx === total - 1} data-testid={`auto-banner-down-${b.campaign_id}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move down"><ArrowDown className="h-4 w-4" /></button>
            <button onClick={() => setEdit(true)} data-testid={`auto-banner-edit-${b.campaign_id}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Edit headline / tagline"><Pencil className="h-4 w-4" /></button>
            <Link to={`/admin/campaigns?edit=${b.campaign_id}`} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-sky-700 hover:bg-sky-50" title="Edit full campaign details">Campaign</Link>
            <button onClick={onToggle} data-testid={`auto-banner-toggle-${b.campaign_id}`} className={`rounded-lg p-2 ${b.enabled ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`} title={b.enabled ? "Hide from slider" : "Show in slider"}>{b.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
          </>
        )}
      </div>
    </div>
  );
}

export function AutoBannerList({ autos, reload }) {
  const move = async (idx, dir) => {
    const next = [...autos];
    const j = idx + dir;
    [next[idx], next[j]] = [next[j], next[idx]];
    await Promise.all(next.map((b, k) => api.patch(`/admin/campaigns/${b.campaign_id}/slider`, { slider_order: k + 1 })));
    reload();
  };
  const toggle = async (b) => {
    await api.patch(`/admin/campaigns/${b.campaign_id}/slider`, { show_in_slider: !b.enabled });
    toast.success(b.enabled ? "Hidden from slider" : "Visible in slider"); reload();
  };
  return (
    <div className="space-y-2" data-testid="auto-banner-list">
      {autos.length === 0 && <p className="text-sm text-slate-500" data-testid="auto-banner-empty">No live campaigns right now — the slider fills automatically as soon as a campaign goes live.</p>}
      {autos.map((b, idx) => <AutoRow key={b.id} b={b} idx={idx} total={autos.length} onMove={(d) => move(idx, d)} onToggle={() => toggle(b)} onSaved={reload} />)}
    </div>
  );
}
