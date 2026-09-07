import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { KeyRound, Lock, Loader2, ShieldCheck } from "lucide-react";

export function SecuritySettings() {
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

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="security-settings">
      <form onSubmit={changeLogin} className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-slate-900"><Lock className="h-5 w-5 text-red-600" /> Change Login Password</div>
        <div className="mt-4 space-y-3">
          <div><Label>Current password</Label><Input data-testid="sec-current-password" type="password" required value={lp.current_password} onChange={(e) => setLp({ ...lp, current_password: e.target.value })} className="mt-1.5" /></div>
          <div><Label>New password (min 8 chars)</Label><Input data-testid="sec-new-password" type="password" required minLength={8} value={lp.new_password} onChange={(e) => setLp({ ...lp, new_password: e.target.value })} className="mt-1.5" /></div>
        </div>
        <button type="submit" disabled={busy === "lp"} data-testid="sec-change-password" className="rt-gradient-btn mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold disabled:opacity-60">{busy === "lp" && <Loader2 className="h-4 w-4 animate-spin" />} Update Password</button>
      </form>

      <form onSubmit={saveTxn} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6">
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
            <div><Label>Login password</Label><Input data-testid="sec-txn-login-password" type="password" required value={tp.login_password} onChange={(e) => setTp({ ...tp, login_password: e.target.value })} className="mt-1.5" /></div>
          )}
          <div><Label>New transaction PIN (4–6 digits)</Label><Input data-testid="sec-txn-new" type="password" inputMode="numeric" pattern="\d{4,6}" required value={tp.new_password} onChange={(e) => setTp({ ...tp, new_password: e.target.value.replace(/\D/g, "").slice(0, 6) })} className="mt-1.5 font-mono tracking-widest" /></div>
        </div>
        <button type="submit" disabled={busy === "tp"} data-testid="sec-txn-save" className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 disabled:opacity-60">{busy === "tp" && <Loader2 className="h-4 w-4 animate-spin" />} {st.has_txn_password ? "Reset Transaction Password" : "Set Transaction Password"}</button>
      </form>

      {st.logs.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2" data-testid="sec-logs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Recent security activity</div>
          <ul className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">{st.logs.map((l, i) => <li key={i} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5"><span className="capitalize">{l.event.replace(/_/g, " ")}</span><span className="font-mono text-slate-400">{(l.created_at || "").slice(0, 16).replace("T", " ")}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
