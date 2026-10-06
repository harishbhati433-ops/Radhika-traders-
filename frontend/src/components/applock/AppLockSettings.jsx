import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, Lock, Loader2, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { biometricAvailable, registerBiometric } from "../../lib/webauthn";
import { relock } from "../../lib/appLockState";

const PinField = ({ label, value, onChange, testId }) => (
  <div><Label>{label}</Label><Input type="password" inputMode="numeric" maxLength={4} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))} data-testid={testId} className="mt-1.5 font-mono tracking-[0.4em]" placeholder="••••" /></div>
);

export function AppLockSettings() {
  const { refresh } = useAuth();
  const [s, setS] = useState(null);
  const [bioOk, setBioOk] = useState(false);
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({ cur: "", pin: "", pin2: "" });
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/app-lock/status", { noCache: true }).then(({ data }) => setS(data)).catch(() => setS({}));
  useEffect(() => { load(); biometricAvailable().then(setBioOk); }, []);

  const run = async (fn, ok) => {
    setBusy(true);
    try { const d = await fn(); toast.success(d?.message || ok); setDlg(null); setF({ cur: "", pin: "", pin2: "" }); load(); refresh(); }
    catch (e) { toast.error(e?.response ? formatApiErrorDetail(e.response?.data?.detail) : (e?.message || "Cancelled")); }
    finally { setBusy(false); }
  };
  const changePin = (e) => { e.preventDefault(); if (f.pin !== f.pin2) return toast.error("New PINs do not match"); run(async () => (await api.post("/app-lock/pin/set", { pin: f.pin, current_pin: s?.enabled ? f.cur : undefined })).data); };
  const disable = (e) => { e.preventDefault(); run(async () => (await api.post("/app-lock/disable", { pin: f.cur })).data, "App Lock turned off"); };

  if (!s) return null;
  const on = s.enabled;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="app-lock-settings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}><Lock className="h-5 w-5" /></span>
          <div>
            <div className="font-display text-base font-bold text-slate-900">App Lock</div>
            <p className="mt-0.5 text-xs text-slate-500">PIN {bioOk ? "or fingerprint / face " : ""}required every time the app is opened, and after 5 minutes in the background.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span data-testid="app-lock-state" className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${on ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{on ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />} {on ? "On" : "Off"}</span>
              {on && <span data-testid="app-lock-bio-state" className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.biometric ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}><Fingerprint className="h-3 w-3" /> Fingerprint {s.biometric ? "on this device" : "not set on this device"}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {on ? (<>
            <button onClick={() => setDlg("pin")} data-testid="app-lock-change-pin" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><KeyRound className="h-3.5 w-3.5" /> Change PIN</button>
            {bioOk && (s.biometric
              ? <button onClick={() => run(async () => (await api.delete("/app-lock/biometric")).data)} disabled={busy} data-testid="app-lock-remove-bio" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Trash2 className="h-3.5 w-3.5" /> Remove fingerprint</button>
              : <button onClick={() => run(registerBiometric)} disabled={busy} data-testid="app-lock-add-bio" className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />} Enable fingerprint</button>)}
            <button onClick={() => relock()} data-testid="app-lock-lock-now" className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:brightness-125"><Lock className="h-3.5 w-3.5" /> Lock now</button>
            <button onClick={() => setDlg("off")} data-testid="app-lock-turn-off" className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"><ShieldOff className="h-3.5 w-3.5" /> Turn off</button>
          </>) : (
            <button onClick={() => (s.configured ? run(async () => (await api.post("/app-lock/enable")).data) : setDlg("pin"))} data-testid="app-lock-turn-on" className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Turn on App Lock</button>
          )}
        </div>
      </div>

      <Dialog open={dlg === "pin"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent data-testid="app-lock-pin-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-red-600" /> {on ? "Change App Lock PIN" : "Set App Lock PIN"}</DialogTitle></DialogHeader>
          <form onSubmit={changePin} className="space-y-4">
            {on && <PinField label="Current PIN" value={f.cur} onChange={(v) => setF({ ...f, cur: v })} testId="app-lock-current-pin" />}
            <PinField label="New 4-digit PIN" value={f.pin} onChange={(v) => setF({ ...f, pin: v })} testId="app-lock-new-pin" />
            <PinField label="Confirm new PIN" value={f.pin2} onChange={(v) => setF({ ...f, pin2: v })} testId="app-lock-new-pin2" />
            <button type="submit" disabled={busy || f.pin.length !== 4 || f.pin2.length !== 4 || (on && f.cur.length !== 4)} data-testid="app-lock-pin-submit" className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save PIN</button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dlg === "off"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent data-testid="app-lock-off-dialog">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldOff className="h-5 w-5 text-rose-600" /> Turn off App Lock</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">Anyone with your phone will be able to open the app without a PIN. Enter your current PIN to confirm.</p>
          <form onSubmit={disable} className="space-y-4">
            <PinField label="Current PIN" value={f.cur} onChange={(v) => setF({ ...f, cur: v })} testId="app-lock-off-pin" />
            <button type="submit" disabled={busy || f.cur.length !== 4} data-testid="app-lock-off-submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Turn off</button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
