import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import api, { formatApiErrorDetail, getTrustedDevice, setTrustedDevice } from "../lib/api";

const dt = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export function TrustedDevices() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api.get("/admin/security/trusted-devices", { noCache: true }).then(({ data }) => setRows(data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const revoke = async (id, label) => {
    if (!window.confirm(id === "all" ? "Remove ALL trusted devices?\n\nEvery device (including this one) will be asked for the email code on next admin login." : `Remove "${label}"?\n\nIt will be asked for the email code on its next login.`)) return;
    setBusy(id);
    try {
      await api.delete(`/admin/security/trusted-devices/${id}`);
      const cur = rows?.find((r) => r.id === id)?.current;
      if (id === "all" || cur) setTrustedDevice("");
      toast.success("Removed"); load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(""); }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5" data-testid="trusted-devices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-600" /> 2-Step Verification <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">ON</span></div>
        {!!rows?.length && <button type="button" onClick={() => revoke("all")} disabled={busy === "all"} data-testid="trusted-revoke-all" className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60">{busy === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove all trusted devices</button>}
      </div>
      <p className="mt-1 text-xs text-slate-600">Every admin login needs your password <b>plus</b> a 6-digit code sent to your Gmail. Devices you tick "Trust this device" on skip the code for 30 days — they are listed here. Lost a phone? Remove it and it will need the code again.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/70 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2">Device</th><th className="p-2">IP</th><th className="p-2">Trusted on</th><th className="p-2">Last used</th><th className="p-2">Expires</th><th className="p-2"></th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={6} className="p-4 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {rows?.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400" data-testid="trusted-empty">No trusted devices — a code is asked on every login.</td></tr>}
            {rows?.map((d) => (
              <tr key={d.id} className="border-t border-emerald-100" data-testid={`trusted-device-${d.id}`}>
                <td className="p-2 font-semibold text-slate-900">{d.browser} on {d.os} {d.current && <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white" data-testid="trusted-current">This device</span>}</td>
                <td className="p-2 font-mono text-slate-600">{d.ip}</td>
                <td className="whitespace-nowrap p-2 font-mono text-slate-500">{dt(d.created_at)}</td>
                <td className="whitespace-nowrap p-2 font-mono text-slate-500">{dt(d.last_used)}</td>
                <td className="whitespace-nowrap p-2 font-mono text-slate-500">{dt(d.expires_at)}</td>
                <td className="p-2 text-right"><button type="button" onClick={() => revoke(d.id, `${d.browser} on ${d.os}`)} disabled={busy === d.id} data-testid={`trusted-revoke-${d.id}`} className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">{busy === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!getTrustedDevice() && <p className="mt-2 text-[11px] text-slate-500">This browser is not trusted yet — it will ask for the code on your next admin login.</p>}
    </div>
  );
}
