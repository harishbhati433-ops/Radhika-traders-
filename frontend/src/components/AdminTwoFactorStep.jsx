import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import api, { formatApiErrorDetail, setTrustedDevice } from "../lib/api";

// Second step of admin login: 6-digit email code, optional "trust this device for 30 days".
export function AdminTwoFactorStep({ email, password, onSuccess, onBack }) {
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState("");
  const [cooldown, setCooldown] = useState(45);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const verify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy("verify");
    try {
      const { data } = await api.post("/auth/login/verify-2fa", { email, password, portal: "admin", code, remember_device: remember });
      setTrustedDevice(data.trusted_device || "");
      onSuccess(data);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Verification failed"); setCode(""); inputRef.current?.focus(); }
    finally { setBusy(""); }
  };
  const resend = async () => {
    setBusy("resend");
    try { await api.post("/auth/login/resend-2fa", { email, password, portal: "admin" }); toast.success("New code sent to your email"); setCooldown(45); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not resend"); }
    finally { setBusy(""); }
  };

  return (
    <form onSubmit={verify} className="space-y-4" data-testid="admin-2fa-step">
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div><p className="font-bold">2-Step Verification</p><p className="mt-0.5 text-xs">A 6-digit code was sent to <b data-testid="admin-2fa-email">{email}</b>. It expires in 5 minutes.</p></div>
      </div>
      <input ref={inputRef} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} data-testid="admin-2fa-code"
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.5em] text-slate-900 outline-none focus:border-slate-900" placeholder="••••••" />
      <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} data-testid="admin-2fa-remember" className="mt-0.5 h-4 w-4 accent-slate-900" />
        <span><b className="text-slate-800">Trust this device for 30 days</b> — no code asked again on this phone/browser. Untick on a shared or public device.</span>
      </label>
      <button type="submit" disabled={busy === "verify" || code.length !== 6} data-testid="admin-2fa-submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 py-2.5 text-sm font-bold text-white hover:brightness-125 disabled:opacity-60">
        {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify & Login
      </button>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="font-semibold text-slate-500 hover:underline" data-testid="admin-2fa-back">← Back</button>
        <button type="button" onClick={resend} disabled={cooldown > 0 || busy === "resend"} data-testid="admin-2fa-resend" className="font-semibold text-red-600 hover:underline disabled:text-slate-400 disabled:no-underline">
          {busy === "resend" ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
