import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Camera, ShieldCheck, LocateFixed, Save } from "lucide-react";
import api, { formatApiErrorDetail } from "../../lib/api";

const ICONS = { normal: ShieldCheck, gps: MapPin, gps_selfie: Camera };
const HINTS = {
  normal: "Current behaviour — tap Check In / Out from anywhere. Nothing changes.",
  gps: "Check-in / out allowed only when the phone's live GPS is within the office radius.",
  gps_selfie: "GPS check + a live camera selfie at check-in (visible to you in the attendance table).",
};

function ModePicker({ value, onChange, disabledGps }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {["normal", "gps", "gps_selfie"].map((m) => { const I = ICONS[m]; const off = disabledGps && m !== "normal"; return (
        <button key={m} type="button" disabled={off} onClick={() => onChange(m)} data-testid={`att-mode-${m}`}
          className={`rounded-xl border p-3 text-left transition ${value === m ? "border-red-500 bg-red-50 ring-2 ring-red-200" : "border-slate-200 bg-white hover:bg-slate-50"} ${off ? "cursor-not-allowed opacity-50" : ""}`}>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><I className="h-4 w-4 text-red-600" /> {m === "normal" ? "Normal" : m === "gps" ? "GPS Only" : "GPS + Selfie"}</div>
          <div className="mt-1 text-[11px] leading-snug text-slate-500">{HINTS[m]}{off ? " (set office location first)" : ""}</div>
        </button>); })}
    </div>
  );
}

function OfficeLocation({ f, setF }) {
  const [locating, setLocating] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) return toast.error("This browser has no GPS support");
    setLocating(true);
    navigator.geolocation.getCurrentPosition((p) => { setF({ ...f, office_lat: +p.coords.latitude.toFixed(6), office_lng: +p.coords.longitude.toFixed(6) }); setLocating(false); toast.success(`Location captured (±${Math.round(p.coords.accuracy)} m)`); },
      (e) => { setLocating(false); toast.error(e.code === 1 ? "Location permission denied — allow it in browser settings" : "Could not get location, try again outdoors"); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  };
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value === "" ? null : Number(e.target.value) });
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-900">Office location</div>
        <button type="button" onClick={locate} disabled={locating} data-testid="att-policy-locate" className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"><LocateFixed className="h-3.5 w-3.5" /> {locating ? "Locating…" : "Use my current location"}</button>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Press the button while standing in the office, or paste coordinates from Google Maps (right-click a spot → copy the numbers).</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">Latitude<input type="number" step="0.000001" value={f.office_lat ?? ""} onChange={num("office_lat")} data-testid="att-policy-lat" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="23.7117" /></label>
        <label className="text-xs font-semibold text-slate-600">Longitude<input type="number" step="0.000001" value={f.office_lng ?? ""} onChange={num("office_lng")} data-testid="att-policy-lng" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" placeholder="76.0157" /></label>
        <label className="text-xs font-semibold text-slate-600">Radius (metres)<input type="number" min="20" max="2000" value={f.radius_m} onChange={(e) => setF({ ...f, radius_m: Number(e.target.value) })} data-testid="att-policy-radius" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Keep selfies (days)<input type="number" min="7" max="365" value={f.selfie_retention_days} onChange={(e) => setF({ ...f, selfie_retention_days: Number(e.target.value) })} data-testid="att-policy-retention" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /></label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-600">Label (optional)<input value={f.office_label || ""} onChange={(e) => setF({ ...f, office_label: e.target.value })} data-testid="att-policy-label" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Radhika Traders office, Agar" /></label>
      {f.office_lat != null && f.office_lng != null && <a href={`https://www.google.com/maps?q=${f.office_lat},${f.office_lng}`} target="_blank" rel="noreferrer" data-testid="att-policy-map-link" className="mt-2 inline-block text-[11px] font-semibold text-sky-700 underline">Open in Google Maps to verify</a>}
    </div>
  );
}

function EmployeeOverrides({ employees, onChange }) {
  if (!employees?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="text-sm font-bold text-slate-900">Per-employee override</div>
      <p className="mt-1 text-[11px] text-slate-500">Default = follows the mode above. Use Normal for someone whose phone GPS fails or who cannot take a selfie.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {employees.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2" data-testid={`att-emp-mode-row-${e.id}`}>
            <div><div className="text-sm font-semibold text-slate-900">{e.name}</div><div className="font-mono text-[10px] text-slate-400">{e.employee_code} · now: {e.effective_mode === "normal" ? "Normal" : e.effective_mode === "gps" ? "GPS" : "GPS + Selfie"}</div></div>
            <select value={e.attendance_mode || ""} onChange={(ev) => onChange(e.id, ev.target.value || null)} data-testid={`att-emp-mode-${e.id}`} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold">
              <option value="">Default</option><option value="normal">Normal</option><option value="gps">GPS Only</option><option value="gps_selfie">GPS + Selfie</option>
            </select>
          </div>))}
      </div>
    </div>
  );
}

export function AttendancePolicyCard() {
  const [p, setP] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const apply = (data) => { setP(data); setF({ mode: data.mode, office_lat: data.office_lat, office_lng: data.office_lng, radius_m: data.radius_m, selfie_retention_days: data.selfie_retention_days, office_label: data.office_label }); };
  useEffect(() => { api.get("/admin/attendance/policy", { noCache: true }).then(({ data }) => apply(data)).catch(() => {}); }, []);
  if (!p || !f) return null;
  const save = async () => {
    setSaving(true);
    try { const { data } = await api.put("/admin/attendance/policy", f); apply(data); toast.success(`Attendance mode: ${data.mode_label}`); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };
  const setEmp = async (id, mode) => {
    try { const { data } = await api.put(`/admin/attendance/policy/employee/${id}`, { mode }); apply(data); toast.success("Employee attendance mode updated"); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const noOffice = f.office_lat == null || f.office_lng == null;
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" data-testid="att-policy-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900"><MapPin className="h-4 w-4 text-red-600" /> Attendance Mode</div>
          <p className="mt-1 text-xs text-slate-500">Choose how employees mark attendance. Salary rules are untouched — this only adds a verification step before Check In / Out.</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" data-testid="att-policy-current">Active: {p.mode_label}{p.office_set ? ` · ${p.radius_m} m` : " · office location not set"}</div>
      </div>
      <div className="mt-4 space-y-4">
        <ModePicker value={f.mode} onChange={(m) => setF({ ...f, mode: m })} disabledGps={noOffice} />
        <OfficeLocation f={f} setF={setF} />
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} data-testid="att-policy-save" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save attendance mode"}</button>
          <span className="text-[11px] text-slate-500">Selfies auto-delete after {f.selfie_retention_days} days (attendance record & GPS distance stay).</span>
        </div>
        <EmployeeOverrides employees={p.employees} onChange={setEmp} />
      </div>
    </div>
  );
}
