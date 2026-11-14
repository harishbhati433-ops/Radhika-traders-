import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatApiErrorDetail, setTrustedDevice } from "../lib/api";
import { biometricAvailable, passkeyLogin } from "../lib/webauthn";
import { getSavedCredential, storeCredential } from "../lib/credentialStore";
import { markUnlocked } from "../lib/appLockState";

// After "Clear browsing data" the app forgets its session; Chrome's saved password (or the App Lock fingerprint) brings the user back in one tap.
// submitWith(id, password) performs the normal password login for the page's portal.
export function useAutoLogin(submitWith) {
  const { state } = useLocation();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const auto = state?.autoCred;
    if (auto?.id && auto?.password) { submitWith(auto.id, auto.password); return; }
    getSavedCredential("optional").then((c) => { if (c) submitWith(c.id, c.password); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export const rememberInBrowser = (id, password, label) => storeCredential(id, password, label);

export function PasskeyLoginButton({ portal, onSuccess, dark = false }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { biometricAvailable().then(setOk); }, []);
  if (!ok) return null;
  const run = async () => {
    setBusy(true);
    try {
      const data = await passkeyLogin(portal);
      if (data.trusted_device) setTrustedDevice(data.trusted_device);
      markUnlocked(data.user.id);
      onSuccess(data);
    } catch (e) {
      if (e?.response) toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Fingerprint login failed");
      else if (!/cancel|abort|NotAllowed/i.test(String(e?.name || e?.message))) toast.error("Fingerprint login failed. Use your password.");
    } finally { setBusy(false); }
  };
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
      <button type="button" onClick={run} disabled={busy} data-testid={`${portal}-passkey-login`}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-bold transition-colors disabled:opacity-60 ${dark ? "border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white" : "border-red-200 text-red-700 hover:bg-red-50"}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />} Login with Fingerprint
      </button>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">Works if fingerprint is on in App Lock on this device.</p>
    </div>
  );
}
