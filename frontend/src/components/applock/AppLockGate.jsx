import { useEffect, useRef, useState } from "react";
import { Fingerprint, Lock, LogOut, ShieldCheck, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { PinPad } from "./PinPad";
import { Logo } from "../Logo";
import { biometricAvailable, registerBiometric, unlockBiometric } from "../../lib/webauthn";
import { isUnlocked, markUnlocked, wireIdleLock } from "../../lib/appLockState";

const Shell = ({ title, subtitle, children, footer }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-[#0B0F17] px-5 py-8 text-white" data-testid="app-lock-screen">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.25),transparent_55%)]" />
    <div className="relative w-full max-w-sm text-center">
      <div className="mb-6 flex justify-center"><Logo size="sm" light /></div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight" data-testid="app-lock-title">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-slate-400" data-testid="app-lock-subtitle">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-400">{footer}</div>}
    </div>
  </div>
);

const Err = ({ msg }) => msg ? <p className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300" role="alert" data-testid="app-lock-error">{msg}</p> : null;

function SetupScreen({ user, onDone, logout }) {
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometricAvailable().then(setBioOk); }, []);

  const complete = async (v) => {
    setErr("");
    if (step === 1) { setFirst(v); setPin(""); setStep(2); return; }
    if (v !== first) { setErr("PINs do not match. Try again."); setPin(""); setFirst(""); setStep(1); return; }
    setBusy(true);
    try {
      await api.post("/app-lock/pin/set", { pin: v });
      if (bioOk) setStep(3); else finish();
    } catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail)); setPin(""); setFirst(""); setStep(1); }
    finally { setBusy(false); }
  };
  const finish = () => { markUnlocked(user.id); toast.success("App Lock is on"); onDone(); };
  const enableBio = async () => {
    setBusy(true);
    try { const d = await registerBiometric(); toast.success(d.message); finish(); }
    catch (e) { setErr(e?.response ? formatApiErrorDetail(e.response?.data?.detail) : "Fingerprint setup was cancelled. You can enable it later from Settings."); }
    finally { setBusy(false); }
  };

  if (step === 3) return (
    <Shell title="Enable Fingerprint / Face unlock?" subtitle="Unlock faster next time — your PIN always works as a backup.">
      <Err msg={err} />
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-600/15 text-red-400"><Fingerprint className="h-12 w-12" /></div>
      <button onClick={enableBio} disabled={busy} data-testid="app-lock-enable-bio" className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />} Enable on this device</button>
      <button onClick={finish} disabled={busy} data-testid="app-lock-skip-bio" className="mt-3 w-full rounded-full border border-white/15 py-3 text-sm font-bold text-slate-300 hover:bg-white/5">Not now, use PIN only</button>
    </Shell>
  );
  return (
    <Shell title={step === 1 ? "Set your App Lock PIN" : "Confirm your PIN"} subtitle={step === 1 ? `Hi ${user.name?.split(" ")[0] || ""} — choose a 4-digit PIN. You'll need it every time you open the app.` : "Enter the same 4 digits again."}
      footer={<button onClick={logout} data-testid="app-lock-logout" className="inline-flex items-center gap-1.5 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Logout</button>}>
      <Err msg={err} />
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-amber-300"><ShieldCheck className="h-3.5 w-3.5" /> Step {step} of {bioOk ? 3 : 2}</div>
      <PinPad value={pin} onChange={setPin} onComplete={complete} disabled={busy} testId="setup-pin" />
    </Shell>
  );
}

function ForgotScreen({ user, onDone, onBack }) {
  const [stage, setStage] = useState("send");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [masked, setMasked] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true); setErr("");
    try { const { data } = await api.post("/app-lock/forgot"); setMasked(data.email_masked); setStage("code"); toast.success(data.message); }
    catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const complete = async (v) => {
    setErr("");
    if (!first) { setFirst(v); setPin(""); return; }
    if (v !== first) { setErr("PINs do not match. Try again."); setPin(""); setFirst(""); return; }
    setBusy(true);
    try { await api.post("/app-lock/reset", { code: code.trim(), pin: v }); markUnlocked(user.id); toast.success("New PIN set"); onDone(); }
    catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail)); setPin(""); setFirst(""); if (/OTP/i.test(formatApiErrorDetail(e.response?.data?.detail))) setStage("code"); }
    finally { setBusy(false); }
  };
  const footer = <button onClick={onBack} data-testid="app-lock-forgot-back" className="hover:text-white">← Back to unlock</button>;
  if (stage === "send") return (
    <Shell title="Forgot your PIN?" subtitle="We'll email a one-time code to your registered email address to set a new PIN." footer={footer}>
      <Err msg={err} />
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-slate-300"><Mail className="h-9 w-9" /></div>
      <button onClick={send} disabled={busy} data-testid="app-lock-send-otp" className="rt-gradient-btn flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send OTP to my email</button>
    </Shell>
  );
  if (stage === "code") return (
    <Shell title="Enter the OTP" subtitle={`Sent to ${masked}. Valid for 10 minutes.`} footer={<>{footer}<button onClick={send} disabled={busy} data-testid="app-lock-resend-otp" className="hover:text-white">Resend OTP</button></>}>
      <Err msg={err} />
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoFocus placeholder="6-digit OTP" data-testid="app-lock-otp-input"
        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-white placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-500 focus:border-red-500 focus:outline-none" />
      <button onClick={() => code.length === 6 ? setStage("pin") : setErr("Enter the 6-digit OTP")} data-testid="app-lock-otp-next" className="rt-gradient-btn mt-4 w-full rounded-full py-3 text-sm font-bold">Continue</button>
    </Shell>
  );
  return (
    <Shell title={first ? "Confirm new PIN" : "Set a new PIN"} subtitle={first ? "Enter the same 4 digits again." : "Choose a new 4-digit PIN."} footer={footer}>
      <Err msg={err} />
      <PinPad value={pin} onChange={setPin} onComplete={complete} disabled={busy} testId="reset-pin" />
    </Shell>
  );
}

function LockScreen({ user, onUnlocked, logout, bio }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const tryBio = async () => {
    setBusy(true); setErr("");
    try { await unlockBiometric(); markUnlocked(user.id); onUnlocked(); }
    catch (e) { if (e?.response) setErr(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const started = useRef(false);
  useEffect(() => { if (bio && !started.current) { started.current = true; tryBio(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const complete = async (v) => {
    setBusy(true); setErr("");
    try { await api.post("/app-lock/pin/unlock", { pin: v }); markUnlocked(user.id); onUnlocked(); }
    catch (e) { setErr(formatApiErrorDetail(e.response?.data?.detail)); setPin(""); }
    finally { setBusy(false); }
  };
  if (forgot) return <ForgotScreen user={user} onDone={onUnlocked} onBack={() => setForgot(false)} />;
  return (
    <Shell title={`Welcome back, ${user.name?.split(" ")[0] || ""}`} subtitle="Enter your App Lock PIN to continue"
      footer={<><button onClick={() => setForgot(true)} data-testid="app-lock-forgot" className="hover:text-white">Forgot PIN?</button><button onClick={logout} data-testid="app-lock-logout" className="inline-flex items-center gap-1.5 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Logout</button></>}>
      <Err msg={err} />
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-slate-300"><Lock className="h-6 w-6" /></div>
      <PinPad value={pin} onChange={setPin} onComplete={complete} disabled={busy} testId="unlock-pin" />
      {bio && <button onClick={tryBio} disabled={busy} data-testid="app-lock-use-bio" className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60"><Fingerprint className="h-4 w-4 text-red-400" /> Use fingerprint / face</button>}
    </Shell>
  );
}

// Wraps every protected page: mandatory PIN setup on first login, lock screen on each fresh app open / after 5 min in background.
export function AppLockGate({ children }) {
  const { user, refresh, logout } = useAuth();
  const [open, setOpen] = useState(() => !!user && isUnlocked(user.id));
  const [bio, setBio] = useState(null);
  useEffect(() => { wireIdleLock(); const onLock = () => setOpen(false); window.addEventListener("rt:lock", onLock); return () => window.removeEventListener("rt:lock", onLock); }, []);
  const needsSetup = user && !user.app_lock?.configured && user.app_lock?.enabled !== false;
  const enabled = !!user?.app_lock?.configured && user.app_lock?.enabled !== false;
  useEffect(() => {
    if (!user || !enabled || open) return;
    api.get("/app-lock/status", { noCache: true }).then(({ data }) => { setBio(data.biometric); if (data.locked_until) setBio(false); }).catch(() => setBio(false));
  }, [user?.id, enabled, open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return children;
  if (needsSetup) return <SetupScreen user={user} logout={logout} onDone={() => { setOpen(true); refresh(); }} />;
  if (!enabled || open) return children;
  if (bio === null) return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0F17]" data-testid="app-lock-loading"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>;
  return <LockScreen user={user} bio={bio} logout={logout} onUnlocked={() => setOpen(true)} />;
}
