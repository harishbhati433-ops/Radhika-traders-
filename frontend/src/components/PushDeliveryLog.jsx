import { useEffect, useState } from "react";
import { Loader2, Smartphone, AlertTriangle } from "lucide-react";
import api from "../lib/api";

const ist = (s) => new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function PushDeliveryLog() {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    api.get("/admin/push-log", { noCache: true }).then(({ data }) => setData(data)).catch(() => setData({ items: [] }));
    api.get("/admin/attendance-events", { noCache: true }).then(({ data }) => setEvents(data)).catch(() => {});
  }, []);

  return (
    <div className="mt-10" data-testid="push-log-section">
      <h2 className="font-display text-base font-extrabold text-slate-900 md:text-lg">Phone Alert (Push) Delivery Log</h2>
      <p className="mb-3 text-xs text-slate-500">Every push the system fires is recorded with devices reached and the exact reason when a device did not get it. "No subscribed device" means that user has not turned on phone alerts (bell 🔔 → Turn on) on any phone.</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-4" data-testid="push-log-stats">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Alerts fired · 24 h</div><div className="mt-1 font-mono text-2xl font-bold text-slate-900">{data?.events_24h ?? "—"}</div></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Devices reached</div><div className="mt-1 font-mono text-2xl font-bold text-emerald-800" data-testid="push-log-sent24">{data?.sent_24h ?? "—"}</div></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-rose-700">Failed / expired</div><div className="mt-1 font-mono text-2xl font-bold text-rose-800" data-testid="push-log-failed24">{data?.failed_24h ?? "—"}</div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold uppercase tracking-wider text-amber-800">No device · 24 h</div><div className="mt-1 font-mono text-2xl font-bold text-amber-900" data-testid="push-log-nodevice24">{data?.no_device_24h ?? "—"}</div><div className="text-[11px] text-amber-800">{data?.subscribed_users ?? 0} user(s) have alerts ON</div></div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {!data ? <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div> : data.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500" data-testid="push-log-empty"><Smartphone className="mx-auto mb-2 h-6 w-6 text-slate-300" /> No push alerts fired yet.</div>
        ) : (
          <table className="w-full text-left text-sm" data-testid="push-log-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time (IST)</th><th className="px-4 py-3">Alert</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Users</th><th className="px-4 py-3">Devices</th><th className="px-4 py-3">Reached</th><th className="px-4 py-3">Reason / errors</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((e) => (
                <tr key={e.id} data-testid={`push-log-row-${e.id}`}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">{ist(e.created_at)}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-xs text-slate-800" title={e.title}>{e.title}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{e.kind || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.users}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{e.devices}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${e.sent > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{e.sent}/{e.devices}</span></td>
                  <td className="max-w-sm px-4 py-2.5 font-mono text-[11px] text-rose-700">{e.reason || (e.errors?.length ? e.errors.map((x) => `${x.device}: ${x.error}`).join(" · ") : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mt-10 font-display text-base font-extrabold text-slate-900 md:text-lg">Attendance Events (check-in / check-out / auto-close)</h2>
      <p className="mb-3 text-xs text-slate-500">One row per attendance event — exactly once per employee, date and kind. Shows whether the admin push, the employee push and each email went out.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {events.length === 0 ? <div className="p-8 text-center text-sm text-slate-500" data-testid="attendance-events-empty"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-slate-300" /> No attendance events recorded yet.</div> : (
          <table className="w-full text-left text-sm" data-testid="attendance-events-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time (IST)</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Admin push</th><th className="px-4 py-3">Employee push</th><th className="px-4 py-3">Emails</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((ev) => {
                const pr = (p) => !p ? "—" : p.skipped ? "duplicate (skipped)" : `${p.sent ?? 0}/${p.devices ?? 0}${p.reason ? ` · ${p.reason}` : ""}`;
                return (
                  <tr key={ev.id} data-testid={`attendance-event-${ev.id}`}>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">{ist(ev.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-800">{ev.employee_name || ev.employee_id}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">{{ in: "Check-in", out: "Check-out", auto: "Auto-close (no check-out)" }[ev.kind] || ev.kind} · {ev.date}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{pr(ev.push?.admin)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{pr(ev.push?.employee)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{Object.entries(ev.emails || {}).map(([k, v]) => <div key={k} className={v.status === "sent" ? "text-emerald-700" : "text-rose-700"}>{k.replace(/·/g, ".")}: {v.status}{v.error ? ` (${v.error})` : ""}</div>)}{!Object.keys(ev.emails || {}).length && "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
