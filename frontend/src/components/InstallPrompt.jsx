import { useEffect, useState } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";

const KEY = "rt_install_dismissed_at";
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
const recentlyDismissed = () => Date.now() - Number(localStorage.getItem(KEY) || 0) < 7 * 24 * 3600 * 1000;

export function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = isIOS() ? setTimeout(() => { setIos(true); setShow(true); }, 4000) : null;
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); if (t) clearTimeout(t); };
  }, []);

  const dismiss = () => { localStorage.setItem(KEY, String(Date.now())); setShow(false); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setShow(false); else dismiss();
    setDeferred(null);
  };

  if (!show) return null;
  return (
    <div data-testid="pwa-install-banner" className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6">
      <button onClick={dismiss} data-testid="pwa-install-dismiss" className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl border border-slate-200 shadow-sm" />
        <div className="min-w-0">
          <div className="font-display text-sm font-extrabold text-slate-900">Install Radhika Traders</div>
          <div className="text-xs text-slate-500">Add to your home screen for one-tap access to campaigns & earnings.</div>
        </div>
      </div>
      {ios ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700" data-testid="pwa-ios-steps">
          Tap <Share className="inline h-3.5 w-3.5 text-sky-600" /> <b>Share</b> below, then <PlusSquare className="inline h-3.5 w-3.5" /> <b>Add to Home Screen</b>.
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button onClick={dismiss} data-testid="pwa-install-later" className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">Not now</button>
          <button onClick={install} data-testid="pwa-install-btn" className="rt-gradient-btn flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"><Download className="h-3.5 w-3.5" /> Install App</button>
        </div>
      )}
    </div>
  );
}
