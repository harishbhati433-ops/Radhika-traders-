import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { KeyRound, Lock, Loader2, ShieldCheck, MonitorSmartphone, LogOut, Trash2 } from "lucide-react";
import { PasswordInput } from "./PasswordInput";
import { OtpPasswordReset } from "./OtpPasswordReset";
import { useAuth } from "../context/AuthContext";

const dt = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function SecuritySettings({ showTxn = true }) {
  const { loginWithToken } = useAuth();
  const [st, setSt] = useState({ has_txn_password: false, logs: [] });
  const [lp, setLp] = useState({ current_password: "", new_password: "" });
  const [tp, setTp] = useState({ login_password: "", otp: "", new_password: "" });
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState("");

  const load = () => api.get("/security/status").then(({ data }) => setSt(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const changeLogin = async (e) => {
    e.preventDefault(); setBusy("lp");
    try { await api.post("/security/change-password", lp); toast.success("Login password changed"); setLp({ current_password: "", new_password: "" }); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };
  const sendOtp = async () => {
    setBusy("otp");
    try { await api.post("/security/transaction-password/otp"); setOtpSent(true); toast.success("OTP sent to your email"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };
  const saveTxn = async (e) => {
    e.preventDefault(); setBusy("tp");
    try { await api.post("/security/transaction-password", tp); toast.success(st.has_txn_password ? "Transaction password reset" : "Transaction password set"); setTp({ login_password: "", otp: "", new_password: "" }); setOtpSent(false); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };

  const logoutAll = async () => {
    if (!window.confirm("Log out from ALL other devices?\n\nEvery other phone/browser signed into this account is logged out immediately. Only this session stays logged in.")) return;
    setBusy("all");
    try { const { data } = await api.post("/security/logout-all"); loginWithToken(data.token, data.user); toast.success(data.message, { duration: 7000 }); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };

  const removeDevice = async (d) => {
    if (!window.confirm(`Remove "${d.browser} on ${d.os}" (IP ${d.ip}) from known devices?\n\nIf this device logs in again you will get a fresh Gmail alert.`)) return;
    setBusy(`dev-${d.fingerprint}`);
    try { const { data } = await api.delete(`/security/devices/${d.fingerprint}`); toast.success(data.message); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="security-settings">
      <form onSubmit={changeLogin} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Lock className="h-5 w-5 text-red-600" /> Change Login Password</div>
        <div className="mt-4 space-y-3">
          <div><Label>Current password</Label><PasswordInput data-testid="sec-current-password" required value={lp.current_password} onChange={(e) => setLp({ ...lp, current_password: e.target.value })} className="mt-1.5" /></div>
          <div><Label>New password (min 8 chars)</Label><PasswordInput data-testid="sec-new-password" required minLength={8} value={lp.new_password} onChange={(e) => setLp({ ...lp, new_password: e.target.value })} className="mt-1.5" /></div>
        </div>
        <button type="submit" disabled={busy === "lp"} data-testid="sec-change-password" className="rt-gradient-btn mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">{busy === "lp" && <Loader2 className="h-4 w-4 animate-spin" />} Update Password</button>
      </form>

      <OtpPasswordReset />

      {showTxn && <form onSubmit={saveTxn} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><KeyRound className="h-5 w-5 text-amber-600" /> Transaction Password</div>
          <span data-testid="sec-txn-status" className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.has_txn_password ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{st.has_txn_password ? "SET ✓" : "NOT SET"}</span>
        </div>
        <p className="mt-1 text-xs text-slate-600">A separate 4–6 digit PIN required for withdrawals. {st.has_txn_password ? "To reset it, verify with an OTP sent to your email." : "Confirm your login password to set it."}</p>
        <div className="mt-4 space-y-3">
          {st.has_txn_password ? (
            <div className="flex gap-2">
              <div className="flex-1"><Label>Email OTP</Label><Input data-testid="sec-txn-otp" inputMode="numeric" maxLength={6} required value={tp.otp} onChange={(e) => setTp({ ...tp, otp: e.target.value })} className="mt-1.5 font-mono tracking-widest" placeholder="______" /></div>
              <button type="button" onClick={sendOtp} disabled={busy === "otp"} data-testid="sec-txn-send-otp" className="mt-6 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700">{otpSent ? "Resend OTP" : "Send OTP"}</button>
            </div>
          ) : (
            <div><Label>Login password</Label><PasswordInput data-testid="sec-txn-login-password" required value={tp.login_password} onChange={(e) => setTp({ ...tp, login_password: e.target.value })} className="mt-1.5" /></div>
          )}
          <div><Label>New transaction PIN (4–6 digits)</Label><PasswordInput data-testid="sec-txn-new" inputMode="numeric" pattern="\d{4,6}" required value={tp.new_password} onChange={(e) => setTp({ ...tp, new_password: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="mt-1.5 font-mono tracking-widest" /></div>
        </div>
        <button type="submit" disabled={busy === "tp"} data-testid="sec-txn-save" className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">{busy === "tp" && <Loader2 className="h-4 w-4 animate-spin" />} {st.has_txn_password ? "Reset Transaction Password" : "Set Transaction Password"}</button>
      </form>}

      {st.devices && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2" data-testid="sec-devices">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MonitorSmartphone className="h-4 w-4 text-sky-600" /> Admin login devices <span className="text-xs font-semibold text-slate-400">({st.devices.length})</span></div>
            <button type="button" onClick={logoutAll} disabled={busy === "all"} data-testid="sec-logout-all" className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60">{busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Log out from all devices</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">You get a Gmail alert the first time the Admin Panel is opened from a new device or IP. Don't recognise one? Tap <b>Log out from all devices</b> — every other session is signed out instantly and only this one stays logged in.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Device</th><th className="p-2">IP</th><th className="p-2">First login</th><th className="p-2">Last login</th><th className="p-2 text-right">Logins</th><th className="p-2"></th></tr></thead>
              <tbody>
                {st.devices.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">No logins recorded yet.</td></tr>}
                {st.devices.map((d) => (
                  <tr key={d.fingerprint} className="border-t border-slate-100" data-testid={`sec-device-${d.fingerprint}`}>
                    <td className="p-2 font-semibold text-slate-900">{d.browser} on {d.os}</td>
                    <td className="p-2 font-mono text-slate-600">{d.ip}</td>
                    <td className="whitespace-nowrap p-2 font-mono text-slate-500">{dt(d.first_seen)}</td>
                    <td className="whitespace-nowrap p-2 font-mono text-slate-500">{dt(d.last_seen)}</td>
                    <td className="p-2 text-right font-mono text-slate-700">{d.logins}</td>
                    <td className="p-2 text-right"><button type="button" onClick={() => removeDevice(d)} disabled={busy === `dev-${d.fingerprint}`} data-testid={`sec-device-remove-${d.fingerprint}`} title="Remove this device" className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">{busy === `dev-${d.fingerprint}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {st.logs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2" data-testid="sec-logs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Recent security activity</div>
          <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">{st.logs.map((l, i) => <li key={i} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5"><span><span className="capitalize">{l.event.replace(/_/g, " ")}</span>{l.detail && <span className="ml-1 text-slate-400">· {l.detail}</span>}</span><span className="shrink-0 font-mono text-slate-400">{(l.created_at || "").slice(0, 16).replace("T", " ")}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
