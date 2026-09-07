import { useEffect, useState } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";

const KEY = "rt_install_dismissed_at";
const AUTO_HIDE_MS = 20000;
export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
const recentlyDismissed = () => Date.now() - Number(localStorage.getItem(KEY) || 0) < 7 * 24 * 3600 * 1000;

export function triggerInstall() {
  const ev = window.__rtInstallPrompt;
  if (!ev) return false;
  ev.prompt();
  ev.userChoice.then(() => { window.__rtInstallPrompt = null; window.dispatchEvent(new Event("rt-install-changed")); });
  return true;
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      window.__rtInstallPrompt = e;
      window.dispatchEvent(new Event("rt-install-changed"));
      if (!isStandalone() && !recentlyDismissed()) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => { window.__rtInstallPrompt = null; setShow(false); window.dispatchEvent(new Event("rt-install-changed")); };
    window.addEventListener("appinstalled", onInstalled);
    const t = isIOS() && !isStandalone() && !recentlyDismissed() ? setTimeout(() => { setIos(true); setShow(true); }, 4000) : null;
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); if (t) clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (!show) return;
    document.body.style.paddingBottom = "96px";
    const t = setTimeout(() => setShow(false), AUTO_HIDE_MS);
    return () => { document.body.style.paddingBottom = ""; clearTimeout(t); };
  }, [show]);

  const dismiss = () => { localStorage.setItem(KEY, String(Date.now())); setShow(false); };
  const install = () => { if (triggerInstall()) setShow(false); };

  if (!show) return null;
  return (
    <div data-testid="pwa-install-banner" role="dialog" aria-label="Install app"
      className="fixed inset-x-2 bottom-2 z-[60] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in slide-in-from-bottom-4 sm:inset-x-auto sm:left-6 sm:bottom-6 sm:w-[380px] pr-20 sm:pr-3">
      <div className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-extrabold text-slate-900">Install Radhika Traders App</div>
          {ios ? (
            <div className="text-[11px] text-slate-600" data-testid="pwa-ios-steps">Tap <Share className="inline h-3 w-3 text-sky-600" /> <b>Share</b> → <PlusSquare className="inline h-3 w-3" /> <b>Add to Home Screen</b></div>
          ) : (
            <div className="text-[11px] text-slate-500">One-tap access to campaigns & earnings</div>
          )}
        </div>
        {!ios && (
          <button onClick={install} data-testid="pwa-install-btn" className="rt-gradient-btn hidden shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold sm:inline-flex"><Download className="h-3.5 w-3.5" /> Install</button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" data-testid="pwa-install-dismiss" className="hidden shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 sm:inline-flex"><X className="h-4 w-4" /></button>
      </div>
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 sm:hidden">
        {!ios && <button onClick={install} data-testid="pwa-install-btn-m" className="rt-gradient-btn rounded-full px-3 py-1.5 text-[11px] font-bold">Install</button>}
        <button onClick={dismiss} aria-label="Dismiss" data-testid="pwa-install-dismiss-m" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
