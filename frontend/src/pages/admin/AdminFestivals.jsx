import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { toast } from "sonner";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import { Eye, EyeOff, Zap, CalendarDays, RotateCcw, Loader2 } from "lucide-react";
import { refreshFestival } from "../../lib/festival";
import { FestivalHero } from "../../components/FestivalTheme";

const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function YearRow({ f, year, info, onSave, onReset }) {
  const [s, setS] = useState(info.start); const [e, setE] = useState(info.end);
  const dirty = s !== info.start || e !== info.end;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid={`fest-year-${f.key}-${year}`}>
      <span className="w-10 font-bold text-slate-700">{year}</span>
      <Input type="date" value={s} onChange={(ev) => setS(ev.target.value)} className="h-8 w-[140px] text-xs" data-testid={`fest-start-${f.key}-${year}`} />
      <span className="text-slate-400">→</span>
      <Input type="date" value={e} onChange={(ev) => setE(ev.target.value)} className="h-8 w-[140px] text-xs" data-testid={`fest-end-${f.key}-${year}`} />
      {dirty && <button onClick={() => onSave(year, s, e)} className="rounded-full bg-red-600 px-3 py-1 font-bold text-white" data-testid={`fest-save-${f.key}-${year}`}>Save</button>}
      {info.overridden && <button onClick={() => onReset(year)} title="Reset to Panchang default" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 font-semibold text-slate-600" data-testid={`fest-reset-${f.key}-${year}`}><RotateCcw className="h-3 w-3" /> Default</button>}
      {!info.overridden && <span className="text-slate-400">Panchang</span>}
    </div>
  );
}

function FestCard({ f, onChange, onPreview, previewing }) {
  const save = (patch) => onChange(f.key, patch);
  return (
    <div className={`rounded-2xl border bg-white p-4 ${f.active_now ? "border-amber-400 ring-2 ring-amber-200" : f.force_active ? "border-red-400 ring-2 ring-red-200" : "border-slate-200"}`} data-testid={`fest-card-${f.key}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: f.palette?.bg }}>{f.emoji}</span>
          <div>
            <div className="flex items-center gap-2 font-display text-base font-extrabold text-slate-900">{f.name}
              {f.active_now && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700" data-testid={`fest-active-badge-${f.key}`}>LIVE NOW</span>}
              {f.force_active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">FORCED ON</span>}
              {f.preview && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">ADMIN PREVIEW</span>}
            </div>
            <div className="text-xs text-slate-500">{f.note || "Fixed date"} · Priority <b>{f.priority}</b></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
          <label className="flex items-center gap-1.5">Priority <Input type="number" value={f.priority} onChange={(e) => save({ priority: Number(e.target.value) })} className="h-8 w-16 text-xs" data-testid={`fest-priority-${f.key}`} /></label>
          <label className="flex items-center gap-1.5"><Switch checked={!!f.enabled} onCheckedChange={(v) => save({ enabled: v })} data-testid={`fest-enabled-${f.key}`} /> Auto schedule</label>
          <button onClick={() => save({ force_active: !f.force_active })} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${f.force_active ? "bg-red-600 text-white" : "border border-slate-200"}`} data-testid={`fest-force-${f.key}`}><Zap className="h-3.5 w-3.5" /> {f.force_active ? "Force ON" : "Force now"}</button>
          <button onClick={() => onPreview(f)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${previewing ? "bg-slate-900 text-white" : "border border-slate-200"}`} data-testid={`fest-preview-${f.key}`}>{previewing ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} Preview</button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input value={f.headline_hi} onChange={(e) => save({ headline_hi: e.target.value })} className="h-8 text-xs" data-testid={`fest-headline-hi-${f.key}`} />
        <Input value={f.headline_en} onChange={(e) => save({ headline_en: e.target.value })} className="h-8 text-xs" data-testid={`fest-headline-en-${f.key}`} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> Schedule (IST) — auto every year</div>
      <div className="mt-1.5 space-y-1.5">
        {Object.entries(f.years || {}).map(([y, info]) => <YearRow key={`${y}-${info.start}-${info.end}`} f={f} year={y} info={info} onSave={(year, start, end) => save({ year: Number(year), start, end })} onReset={(year) => onChange(f.key, null, year)} />)}
      </div>
    </div>
  );
}

export default function AdminFestivals() {
  const [list, setList] = useState(null);
  const [preview, setPreview] = useState(null);
  const load = () => api.get("/admin/festivals").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);
  const onChange = async (key, patch, resetYear) => {
    try {
      if (resetYear) await api.delete(`/admin/festivals/${key}/override/${resetYear}`);
      else await api.put(`/admin/festivals/${key}`, patch);
      refreshFestival(); await load(); toast.success("Saved");
    } catch (e) { toast.error(e.response?.data?.detail || "Save failed"); }
  };
  const active = list?.find((f) => f.force_active) || list?.find((f) => f.active_now);
  return (
    <DashboardLayout nav={adminNav} title="Festival Themes">
      <p className="mb-4 text-sm text-slate-500">Website का banner, रंग और greeting त्योहार की तारीखों पर <b>अपने-आप</b> बदलते हैं और त्योहार ख़त्म होते ही normal design वापस आ जाता है। Dates Drik Panchang (IST) के अनुसार 2025–2035 तक pre-set हैं — किसी भी साल की तारीख यहाँ बदल सकते हैं। एक साथ दो त्योहार हों तो ऊँची <b>Priority</b> वाला दिखेगा। Live campaigns, payouts और data पर कोई असर नहीं।</p>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm" data-testid="fest-status">
        {active ? <span>🎉 Active now: <b>{active.name}</b>{active.years?.[active.today?.slice(0, 4)] && <> · {fmt(active.years[active.today.slice(0, 4)].start)} → {fmt(active.years[active.today.slice(0, 4)].end)}</>}</span> : <span className="text-slate-600">No festival active today — website is showing the normal design.</span>}
      </div>
      {preview && <div className="mb-6 overflow-hidden rounded-2xl ring-2 ring-sky-300" data-testid="fest-preview-pane"><FestivalHero fest={preview} /></div>}
      {!list ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div> : (
        <div className="space-y-3">{list.map((f) => <FestCard key={f.key} f={f} onChange={onChange} previewing={preview?.key === f.key} onPreview={(x) => setPreview(preview?.key === x.key ? null : x)} />)}</div>
      )}
    </DashboardLayout>
  );
}
