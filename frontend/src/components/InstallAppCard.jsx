import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, CheckCircle2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { triggerInstall } from "./InstallPrompt";
import { isStandalone } from "./PwaEntry";

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;

// "Download the app" card for auth pages: one tap install on Android/Chrome, step guide on iPhone, hidden inside the installed app.
export function InstallAppCard() {
  const [ready, setReady] = useState(!!window.__rtInstallPrompt);
  const [installed, setInstalled] = useState(isStandalone());
  const [ios] = useState(isIOS());
  useEffect(() => {
    const sync = () => setReady(!!window.__rtInstallPrompt);
    const done = () => setInstalled(true);
    window.addEventListener("rt-install-changed", sync); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("rt-install-changed", sync); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return null;

  const install = () => {
    if (triggerInstall()) return;
    toast.info(ios ? "iPhone: Share button → 'Add to Home Screen' पर tap करें" : "Chrome menu (⋮) → 'Install app' / 'Add to Home screen' चुनें", { duration: 7000 });
  };

  return (
    <div data-testid="install-app-card" className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-[#0B0F17] via-[#1a0f12] to-[#2a0a0a] p-4 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="Radhika Traders app" className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-amber-400/50" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-extrabold leading-tight">Radhika Traders App download करें</div>
          <div className="mt-0.5 text-[11px] text-slate-300">Free · सिर्फ़ 1 MB · सीधे Dashboard खुलता है · weak network पर भी चलता है</div>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-200">
        {["One-tap open", "Fingerprint / PIN lock", "Fast & offline-ready", "Earnings alerts"].map((f) => <li key={f} className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> {f}</li>)}
      </ul>
      {ios ? (
        <div data-testid="install-app-ios" className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[11px] leading-relaxed text-slate-100">
          <b>iPhone:</b> नीचे <Share className="inline h-3.5 w-3.5 text-sky-300" /> <b>Share</b> दबाएँ → <PlusSquare className="inline h-3.5 w-3.5" /> <b>Add to Home Screen</b> → <b>Add</b>
        </div>
      ) : (
        <button type="button" onClick={install} data-testid="install-app-btn" className="rt-gradient-btn mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold">
          {ready ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />} {ready ? "Install App (1 tap)" : "Download App"}
        </button>
      )}
    </div>
  );
}
