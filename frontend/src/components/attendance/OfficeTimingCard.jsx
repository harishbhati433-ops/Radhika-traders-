import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";
import api, { formatApiErrorDetail } from "../../lib/api";

const F = ({ label, hint, value, onChange, id }) => (
  <label className="block text-xs font-semibold text-slate-600">{label}
    <input type="time" value={value} onChange={(e) => onChange(e.target.value)} data-testid={id} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900" />
    <span className="mt-0.5 block text-[10px] font-normal text-slate-400">{hint}</span>
  </label>
);

export function OfficeTimingCard({ onSaved }) {
  const [cur, setCur] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get("/admin/attendance/settings", { noCache: true }).then(({ data }) => { setCur(data); setF({ start: data.start, end: data.end, auto_close: data.auto_close }); }).catch(() => {}); }, []);
  if (!cur || !f) return null;
  const dirty = f.start !== cur.start || f.end !== cur.end || f.auto_close !== cur.auto_close;
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/admin/attendance/settings", f);
      setCur(data); setF({ start: data.start, end: data.end, auto_close: data.auto_close });
      toast.success(`Office timing updated: ${data.start_12} – ${data.end_12}, auto-close ${data.auto_close_12}`);
      onSaved?.(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" data-testid="office-timing-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900"><Clock className="h-4 w-4 text-red-600" /> Office Timing</div>
          <p className="mt-1 text-xs text-slate-500">Change for winter / summer anytime. Full Day stays <b>7 hours</b> and <b>Sunday</b> stays weekly off — only the clock moves. Applies to attendance from now on; use "Recalculate" on the Salary Sheet to re-derive old entries.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-700" data-testid="office-timing-current">Now: {cur.start_12} – {cur.end_12} · auto-close {cur.auto_close_12}</div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <F id="office-start" label="Office Start" hint="Check-in after this = Late mark" value={f.start} onChange={(v) => setF({ ...f, start: v })} />
        <F id="office-end" label="Office End" hint="Must be ≥ 7h after start; work after this = Extra minutes" value={f.end} onChange={(v) => setF({ ...f, end: v })} />
        <F id="office-auto-close" label="Auto-close" hint="No check-out by this time = Checkout Missing (admin review)" value={f.auto_close} onChange={(v) => setF({ ...f, auto_close: v })} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={!dirty || saving} data-testid="office-timing-save" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save timing"}</button>
        {dirty && <button onClick={() => setF({ start: cur.start, end: cur.end, auto_close: cur.auto_close })} data-testid="office-timing-reset" className="text-xs font-semibold text-slate-500 hover:text-slate-800">Reset</button>}
      </div>
    </div>
  );
}
