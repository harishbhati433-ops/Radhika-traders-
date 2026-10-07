import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, BellOff, Volume2, Loader2 } from "lucide-react";
import api from "../lib/api";
import { SOUNDS, getPushState, enablePush, disablePush, getSound, setSound, playSound, isIosBrowser } from "../lib/push";

export function PushToggle() {
  const [state, setState] = useState("off");
  const [busy, setBusy] = useState(false);
  const [sound, setSoundState] = useState(getSound());
  useEffect(() => { getPushState().then(setState); }, []);

  const flip = async () => {
    setBusy(true);
    try {
      if (state === "on") { await disablePush(); setState("off"); toast.success("Phone alerts turned off on this device"); }
      else { await enablePush(); setState("on"); playSound(); toast.success("Phone alerts ON — you will get alerts even when the app is closed"); }
    } catch (e) { toast.error(e?.response?.data?.detail || e.message); setState(await getPushState()); }
    setBusy(false);
  };
  const test = async () => {
    try { await api.post("/push/test"); toast.success("Test alert sent — check your notification bar"); } catch (e) { toast.error(e?.response?.data?.detail || "Could not send test"); }
  };
  const pick = (s) => { setSound(s); setSoundState(s); playSound(s); };

  if (state === "unsupported") {
    return <p data-testid="push-unsupported" className="px-4 py-2 text-[11px] text-slate-500">{isIosBrowser() ? "iPhone: install the app (Share → Add to Home Screen) to get phone alerts." : "Phone alerts are not supported in this browser."}</p>;
  }
  return (
    <div data-testid="push-toggle" className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">{state === "on" ? <BellRing className="h-3.5 w-3.5 text-emerald-600" /> : <BellOff className="h-3.5 w-3.5 text-slate-400" />} Phone alerts {state === "on" ? "ON" : state === "denied" ? "blocked" : "OFF"}</span>
        <div className="flex items-center gap-1.5">
          {state === "on" && <button onClick={test} data-testid="push-test-btn" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Test</button>}
          <button onClick={flip} disabled={busy || state === "denied"} data-testid="push-enable-btn"
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-50 ${state === "on" ? "bg-slate-200 text-slate-700" : "bg-red-600 text-white hover:bg-red-700"}`}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}{state === "on" ? "Turn off" : "Turn on"}
          </button>
        </div>
      </div>
      {state === "denied" && <p className="mt-1 text-[11px] text-rose-600">Notifications are blocked — allow them in your browser/site settings, then reload.</p>}
      <div className="mt-2 flex items-center gap-1.5">
        <Volume2 className="h-3.5 w-3.5 text-slate-500" /><span className="text-[11px] text-slate-500">Sound:</span>
        {SOUNDS.map(([k, label]) => (
          <button key={k} onClick={() => pick(k)} data-testid={`push-sound-${k}`} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sound === k ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>{label}</button>
        ))}
      </div>
    </div>
  );
}
