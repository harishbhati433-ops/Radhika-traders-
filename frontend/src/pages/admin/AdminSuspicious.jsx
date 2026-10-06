import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { adminNav } from "./nav";
import api from "../../lib/api";
import { PhoneLink, EmailLink } from "../../components/ContactLinks";
import { ShieldAlert, Smartphone, Network, Ban, Info } from "lucide-react";

const Group = ({ g, kind }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4" data-testid={`suspicious-${kind}-group-${g.key}`}>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold">
      {kind === "device" ? <Smartphone className="h-4 w-4 text-rose-600" /> : <Network className="h-4 w-4 text-amber-600" />}
      <span className="text-slate-700">{kind === "device" ? "Same device" : "Same IP"} · <span className="font-mono">{g.key}</span></span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-700">{g.count} accounts</span>
    </div>
    <div className="divide-y divide-slate-100">
      {g.users.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid={`suspicious-user-${u.id}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{u.name}</span><span className="font-mono text-[11px] text-slate-400">{u.referral_code}</span>
              {u.flags?.same_device && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700" data-testid={`suspicious-blocked-${u.id}`}><Ban className="h-3 w-3" /> No bonus · dup of {u.flags.dup_of}</span>}
              {!u.verified && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">OTP pending</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5"><PhoneLink value={u.mobile} /><EmailLink value={u.email} /></div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <div>{(u.created_at || "").slice(0, 10)}{u.referred_by_code ? ` · via ${u.referred_by_code}` : ""}</div>
            <div className="font-mono">{u.ip}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function AdminSuspicious() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/suspicious-signups").then(({ data }) => setD(data)).catch(() => setD({ device_groups: [], ip_groups: [], blocked_count: 0, tracked: 0 })); }, []);
  return (
    <DashboardLayout nav={adminNav} title="Suspicious Signups">
      <div className="mb-5 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900" data-testid="suspicious-info">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div><b>One device = one rewarded account.</b> Signup is never blocked, but a second account from the same phone/browser gets <b>no referral bonus, no dedicated payout and no signup bonus</b>. Same-IP groups are shown for information only (mobile networks share IPs).</div>
      </div>
      {!d ? <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" /></div> : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[["Tracked signups", d.tracked, "text-slate-900"], ["Same-device groups", d.device_groups.length, "text-rose-700"], ["Bonus blocked", d.blocked_count, "text-rose-700"]].map(([l, v, c]) => (
              <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4"><div className={`font-mono text-2xl font-bold ${c}`} data-testid={`suspicious-stat-${l.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{v}</div><div className="text-xs font-semibold text-slate-500">{l}</div></div>
            ))}
          </div>
          <h3 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-slate-900"><ShieldAlert className="h-4 w-4 text-rose-600" /> Same device</h3>
          <div className="space-y-3">{d.device_groups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500" data-testid="suspicious-device-empty">No duplicate-device signups found.</p>}{d.device_groups.map((g) => <Group key={g.key} g={g} kind="device" />)}</div>
          <h3 className="mb-2 mt-8 flex items-center gap-2 font-display text-base font-bold text-slate-900"><Network className="h-4 w-4 text-amber-600" /> Same IP address <span className="text-xs font-semibold text-slate-400">· info only</span></h3>
          <div className="space-y-3">{d.ip_groups.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500" data-testid="suspicious-ip-empty">No shared-IP signups found.</p>}{d.ip_groups.map((g) => <Group key={g.key} g={g} kind="ip" />)}</div>
        </>
      )}
    </DashboardLayout>
  );
}
