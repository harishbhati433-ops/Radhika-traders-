import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { getPushState, isIosBrowser } from "../lib/push";

// Header pill shown to admin / employee / customer whenever phone alerts are not active on this device.
export function PushStatusButton() {
  const [state, setState] = useState("on");
  useEffect(() => {
    const check = () => getPushState().then(setState);
    check();
    window.addEventListener("rt-push-changed", check);
    document.addEventListener("visibilitychange", check);
    return () => { window.removeEventListener("rt-push-changed", check); document.removeEventListener("visibilitychange", check); };
  }, []);
  if (state === "on" || (state === "unsupported" && !isIosBrowser())) return null;
  const blocked = state === "denied";
  return (
    <button onClick={() => window.dispatchEvent(new Event("rt-open-push-prompt"))} data-testid="push-header-enable" title={blocked ? "Notifications are blocked — tap to see how to unblock" : "Turn on phone alerts"}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold shadow-sm transition-colors ${blocked ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-red-600 text-white hover:bg-red-700 animate-[pulse_3s_ease-in-out_infinite]"}`}>
      {blocked ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
      <span className="hidden sm:inline">{blocked ? "Alerts blocked" : "Turn on alerts"}</span>
    </button>
  );
}
