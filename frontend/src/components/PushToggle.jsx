import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, BellOff, Volume2, Loader2, Download, Settings2 } from "lucide-react";
import api from "../lib/api";
import { SOUNDS, getPushState, enablePush, disablePush, getSound, setSound, playSound, isIosBrowser, syncSound } from "../lib/push";
import { triggerInstall, isStandalone } from "./InstallPrompt";
import { Dialog, DialogContent } from "./ui/dialog";

const isAndroid = () => /android/i.test(navigator.userAgent);

function SoundSetupGuide({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="sound-setup-guide">
        <div className="font-display text-lg font-extrabold text-slate-900">Same sound when the app is closed</div>
        <p className="text-xs text-slate-600">Android plays the <b>phone's</b> notification sound for closed apps. To hear <b>RT Alert</b> there too, set it once in your phone settings (2 minutes, one time):</p>
        <ol className="mt-1 space-y-2 text-xs text-slate-700">
          <li className="flex gap-2"><span className="font-bold text-red-600">1.</span><span>Download the sound to your phone: <a href="/sounds/alert.mp3" download="RT-Alert.mp3" data-testid="sound-download" className="inline-flex items-center gap-1 font-semibold text-red-600 underline"><Download className="h-3 w-3" /> RT-Alert.mp3</a></span></li>
          <li className="flex gap-2"><span className="font-bold text-red-600">2.</span><span>Long-press the <b>Radhika Traders</b> app icon → <b>App info</b> → <b>Notifications</b> (if not installed, this is under Chrome → Notifications → this site).</span></li>
          <li className="flex gap-2"><span className="font-bold text-red-600">3.</span><span>Tap the notification category → <b>Sound</b> → <b>Add / Choose from files</b> → pick <b>RT-Alert.mp3</b> from Downloads.</span></li>
          <li className="flex gap-2"><span className="font-bold text-red-600">4.</span><span>Come back and tap <b>Test</b> — the alert now rings with RT Alert even with the screen off.</span></li>
        </ol>
        <p className="text-[11px] text-slate-500">iPhone uses its own system sound for web apps and does not allow a custom one.</p>
        <button onClick={onClose} data-testid="sound-setup-close" className="mt-2 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white">Got it</button>
      </DialogContent>
    </Dialog>
  );
}

export function PushToggle() {
  const [state, setState] = useState("off");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const [sound, setSoundState] = useState(getSound());
  useEffect(() => { getPushState().then(setState); syncSound().then((s) => s && setSoundState(s)); }, []);

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
      {state === "on" && !isStandalone() && (
        <button onClick={() => { if (!triggerInstall()) toast.info("Browser menu (⋮) → Install app / Add to Home screen"); }} data-testid="push-install-hint" className="mt-1.5 text-[11px] font-semibold text-amber-700 hover:underline">
          Install the app to see the Radhika Traders logo on alerts (instead of the browser's) →
        </button>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Volume2 className="h-3.5 w-3.5 text-slate-500" /><span className="text-[11px] text-slate-500">Sound:</span>
        {SOUNDS.map(([k, label]) => (
          <button key={k} onClick={() => pick(k)} data-testid={`push-sound-${k}`} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sound === k ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}>{label}</button>
        ))}
      </div>
      {state === "on" && isAndroid() && (
        <button onClick={() => setGuide(true)} data-testid="sound-setup-open" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-red-600"><Settings2 className="h-3 w-3" /> Set RT Alert as the phone sound for closed-app alerts →</button>
      )}
      <SoundSetupGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}
