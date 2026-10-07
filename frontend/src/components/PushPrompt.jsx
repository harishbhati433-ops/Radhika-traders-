import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Megaphone, Wallet, ShieldCheck, Loader2, Share } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent } from "./ui/dialog";
import { getPushState, enablePush, playSound, isIosBrowser } from "../lib/push";

const KEY = "rt_push_prompt_";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

const POINTS = { customer: [[Megaphone, "New campaign LIVE / paused / closed"], [Wallet, "Wallet credits, lead approvals, withdrawal updates"], [ShieldCheck, "KYC & account status changes"]],
  employee: [[ShieldCheck, "Leave & KYC approvals"], [BellRing, "Check-in / check-out reminders"], [Wallet, "Salary & attendance updates"]],
  admin: [[Wallet, "New withdrawal requests & leads"], [BellRing, "Leave requests, employee check-in/out"], [ShieldCheck, "Security & login alerts"]] };

export function PushPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const until = Number(localStorage.getItem(KEY + user.id) || 0);
    if (until > Date.now()) return;
    getPushState().then((s) => {
      if (s === "off") { setOpen(true); return; }
      if (s === "unsupported" && isIosBrowser()) { setIos(true); setOpen(true); }
    });
  }, [user?.id]);

  const later = () => { localStorage.setItem(KEY + user.id, String(Date.now() + SNOOZE_MS)); setOpen(false); };
  const allow = async () => {
    setBusy(true);
    try { await enablePush(); playSound(); localStorage.setItem(KEY + user.id, String(Date.now() + 365 * 24 * 3600 * 1000)); setOpen(false); toast.success("Alerts ON — you will now get updates even when the app is closed"); }
    catch (e) { toast.error(e?.response?.data?.detail || e.message); later(); }
    setBusy(false);
  };
  if (!user) return null;
  const pts = POINTS[user.role] || POINTS.customer;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && later()}>
      <DialogContent className="max-w-md overflow-hidden p-0" data-testid="push-prompt">
        <div className="border-b-4 border-amber-400 bg-[#991B1B] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3"><BellRing className="h-7 w-7 text-amber-300" /></div>
            <div>
              <div className="font-display text-xl font-extrabold">Turn on notifications</div>
              <div className="text-sm text-red-100">Allow alerts to get more updates — even when the app is closed.</div>
            </div>
          </div>
        </div>
        <div className="px-6 py-5">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
