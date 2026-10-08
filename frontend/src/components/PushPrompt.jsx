import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Megaphone, Wallet, ShieldCheck, Loader2, Share, Download, Smartphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent } from "./ui/dialog";
import { getPushState, enablePush, playSound, isIosBrowser } from "../lib/push";
import { triggerInstall, isStandalone } from "./InstallPrompt";

const KEY = "rt_push_prompt_";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const POINTS = { customer: [[Megaphone, "New campaign LIVE / paused / closed"], [Wallet, "Wallet credits, lead approvals, withdrawal updates"], [ShieldCheck, "KYC & account status changes"]],
  employee: [[ShieldCheck, "Leave & KYC approvals"], [BellRing, "Check-in / check-out reminders"], [Wallet, "Salary & attendance updates"]],
  admin: [[Wallet, "New withdrawal requests & leads"], [BellRing, "Leave requests, employee check-in/out"], [ShieldCheck, "Security & login alerts"]] };

export function PushPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("allow");
  const [ios, setIos] = useState(false);
  const [canInstall, setCanInstall] = useState(!!window.__rtInstallPrompt);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const until = Number(localStorage.getItem(KEY + user.id) || 0);
    if (until > Date.now()) return;
    getPushState().then((s) => {
      if (s === "off") { setStep(isStandalone() ? "allow" : "install"); setOpen(true); return; }
      if (s === "unsupported" && isIosBrowser()) { setIos(true); setStep("allow"); setOpen(true); }
    });
  }, [user?.id]);

  // Re-open on demand from the header "Turn on alerts" button (ignores the snooze).
  useEffect(() => {
    const reopen = async () => {
      const s = await getPushState();
      setIos(s === "unsupported" && isIosBrowser());
      setStep(s === "denied" ? "denied" : (s === "off" && !isStandalone()) ? "install" : "allow");
      setOpen(true);
    };
    window.addEventListener("rt-open-push-prompt", reopen);
    return () => window.removeEventListener("rt-open-push-prompt", reopen);
  }, []);

  useEffect(() => {
    const sync = () => setCanInstall(!!window.__rtInstallPrompt);
    const installed = () => { setCanInstall(false); setStep("allow"); toast.success("App installed — alerts will now show the Radhika Traders logo"); };
    window.addEventListener("rt-install-changed", sync);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("rt-install-changed", sync); window.removeEventListener("appinstalled", installed); };
  }, []);

  const later = () => { localStorage.setItem(KEY + user.id, String(Date.now() + SNOOZE_MS)); setOpen(false); };
  const allow = async () => {
    setBusy(true);
    try { await enablePush(); playSound(); localStorage.setItem(KEY + user.id, String(Date.now() + 365 * 24 * 3600 * 1000)); setOpen(false); window.dispatchEvent(new Event("rt-push-changed")); toast.success("Alerts ON — you will now get updates even when the app is closed"); }
    catch (e) { toast.error(e?.response?.data?.detail || e.message); later(); }
    setBusy(false);
  };
  const install = () => { if (!triggerInstall()) setCanInstall(false); };
  if (!user) return null;
  const pts = POINTS[user.role] || POINTS.customer;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && later()}>
      <DialogContent className="max-w-md overflow-hidden p-0" data-testid="push-prompt">
        <div className="border-b-4 border-amber-400 bg-[#991B1B] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="Radhika Traders" className="h-14 w-14 rounded-2xl ring-2 ring-white/20" />
            <div>
              <div className="text-[10px] font-bold tracking-[0.2em] text-amber-200">RADHIKA TRADERS</div>
              <div className="font-display text-xl font-extrabold">{step === "install" ? "Install the app" : step === "denied" ? "Notifications are blocked" : "Turn on notifications"}</div>
              <div className="text-sm text-red-100">{step === "install" ? "Step 1 of 2 — get alerts with the Radhika Traders logo" : step === "denied" ? "Your phone/browser blocked alerts for this app — unblock in 20 seconds." : "Allow alerts to get more updates — even when the app is closed."}</div>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
          {step === "denied" ? (
            <>
              <ol className="space-y-2 text-sm text-slate-700" data-testid="push-prompt-denied">
                {isStandalone() ? (<>
                  <li className="flex gap-2"><span className="font-bold text-red-600">1.</span><span>Long-press the <b>Radhika Traders</b> app icon → <b>App info</b></span></li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">2.</span><span>Tap <b>Notifications</b> → turn <b>Allow notifications</b> ON</span></li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">3.</span><span>Come back here and tap <b>Check again</b></span></li>
                </>) : (<>
                  <li className="flex gap-2"><span className="font-bold text-red-600">1.</span><span>Tap the <b>🔒 lock / ⓘ icon</b> left of the web address</span></li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">2.</span><span><b>Permissions</b> → <b>Notifications</b> → <b>Allow</b></span></li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">3.</span><span>Tap <b>Check again</b> below (page may reload)</span></li>
                </>)}
              </ol>
              <div className="mt-5 flex items-center gap-2">
                <button onClick={() => window.location.reload()} data-testid="push-prompt-recheck" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700">Check again</button>
                <button onClick={later} data-testid="push-prompt-later" className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Later</button>
              </div>
            </>
          ) : step === "install" ? (
            <>
              <p className="text-sm text-slate-700">Install Radhika Traders on your phone so every alert shows <b>our logo and name</b> on your lock screen — not the browser's. It takes one tap and uses no extra space.</p>
              {!canInstall && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" data-testid="push-prompt-install-manual">
                  <b>How to install:</b> open the browser menu (⋮) → <b>Install app</b> / <b>Add to Home screen</b>, then open Radhika Traders from your home screen.
                </div>
              )}
              <div className="mt-5 flex items-center gap-2">
                {canInstall && <button onClick={install} data-testid="push-prompt-install" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"><Download className="h-4 w-4" /> Install app</button>}
                <button onClick={() => setStep("allow")} data-testid="push-prompt-skip-install" className={`rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 ${canInstall ? "" : "flex-1 border border-slate-200"}`}>{canInstall ? "Skip" : "Continue to alerts"}</button>
              </div>
            </>
          ) : (
            <>
              <ul className="space-y-2.5">
                {pts.map(([Icon, t]) => <li key={t} className="flex items-center gap-3 text-sm text-slate-700"><span className="rounded-lg bg-red-50 p-1.5 text-red-600"><Icon className="h-4 w-4" /></span>{t}</li>)}
              </ul>
              {ios ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900" data-testid="push-prompt-ios">
                  <b>iPhone:</b> tap <Share className="inline h-3.5 w-3.5" /> Share → <b>Add to Home Screen</b>, then open the app from your home screen and allow notifications.
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Tap <b>Allow</b> below, then choose <b>Allow</b> in your browser popup. Your phone will ring on every important update.</p>
              )}
              <div className="mt-5 flex items-center gap-2">
                {!ios && <button onClick={allow} disabled={busy} data-testid="push-prompt-allow" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Allow notifications</button>}
                <button onClick={later} data-testid="push-prompt-later" className={`rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 ${ios ? "flex-1 border border-slate-200" : ""}`}>{ios ? "Got it" : "Later"}</button>
              </div>
            </>
          )}
          {step === "allow" && !ios && !isStandalone() && (
            <button onClick={() => setStep("install")} data-testid="push-prompt-back-install" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600"><Smartphone className="h-3 w-3" /> Want the Radhika Traders logo on alerts? Install the app</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
