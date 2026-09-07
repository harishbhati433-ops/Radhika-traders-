import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Loader2, Save, PauseCircle, PlayCircle, CalendarDays } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATES = Array.from({ length: 31 }, (_, i) => i + 1);

export function WithdrawalToggleSetting() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [days, setDays] = useState([]);
  const [dates, setDates] = useState([]);
  const [busy, setBusy] = useState(false);

  const apply = (d) => { setS(d); setMsg(d.withdrawals_paused_message); setDays(d.withdrawal_days || []); setDates(d.withdrawal_dates || []); };
  useEffect(() => { api.get("/settings/public").then(({ data }) => apply(data)); }, []);

  const save = async (patch, okMsg) => {
    setBusy(true);
    try { const { data } = await api.put("/admin/settings", patch); apply(data); toast.success(okMsg || "Saved"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  if (!s) return null;
  const on = s.withdrawals_enabled;
  const open = s.withdrawals_open;
  const chip = (active, extra = "") => `rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"} ${extra}`;

  return (
    <div className={`rounded-2xl border p-5 ${open ? "border-emerald-200 bg-emerald-50/60" : "border-rose-200 bg-rose-50/70"}`} data-testid="withdrawal-toggle-setting">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2.5 text-white ${open ? "bg-emerald-500" : "bg-rose-500"}`}>{open ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}</div>
          <div>
            <div className="font-display font-bold text-slate-900">Withdrawal Requests</div>
            <div className="text-xs text-slate-600">Master switch + optional schedule. Customers can request only when the switch is ON and today matches the schedule.</div>
            <div className={`mt-1 text-xs font-bold ${open ? "text-emerald-800" : "text-rose-800"}`} data-testid="withdrawal-toggle-current">
              Right now: {open ? "OPEN — customers can withdraw" : `CLOSED — ${on ? s.withdrawals_closed_reason : "paused by admin"}`}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => save({ withdrawals_enabled: !on }, !on ? "Withdrawals switched ON" : "Withdrawals PAUSED")} disabled={busy} data-testid="withdrawal-toggle-btn"
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${on ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
          {on ? "Pause Withdrawals" : "Resume Withdrawals"}
        </button>
      </div>

      {!on && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} data-testid="withdrawal-paused-message"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Message shown to customers while paused" />
          <button type="button" onClick={() => save({ withdrawals_paused_message: msg }, "Message saved")} disabled={busy} data-testid="withdrawal-paused-message-save" className="inline-flex items-center justify-center gap-1 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
            <Save className="h-3.5 w-3.5" /> Save message
          </button>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4" data-testid="withdrawal-schedule">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><CalendarDays className="h-4 w-4 text-red-600" /> Schedule (optional)</div>
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-semibold text-slate-500">Open on these weekdays — none selected = every day</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setDays([])} data-testid="withdrawal-days-all" className={chip(days.length === 0)}>Every day</button>
            {DAYS.map((d, i) => <button key={d} type="button" onClick={() => setDays(toggleIn(days, i))} data-testid={`withdrawal-day-${i}`} className={chip(days.includes(i))}>{d}</button>)}
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold text-slate-500">Open on these dates of the month — none selected = any date</div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setDates([])} data-testid="withdrawal-dates-all" className={chip(dates.length === 0)}>Any date</button>
            {DATES.map((d) => <button key={d} type="button" onClick={() => setDates(toggleIn(dates, d))} data-testid={`withdrawal-date-${d}`} className={chip(dates.includes(d), "min-w-[36px] px-0")}>{d}</button>)}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">Saved: {(s.withdrawal_days || []).length ? s.withdrawal_days.map((i) => DAYS[i]).join(", ") : "every day"} · {(s.withdrawal_dates || []).length ? `dates ${s.withdrawal_dates.join(", ")}` : "any date"}</div>
          <button type="button" onClick={() => save({ withdrawal_days: days, withdrawal_dates: dates }, "Schedule saved")} disabled={busy} data-testid="withdrawal-schedule-save" className="inline-flex items-center gap-1 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save schedule
          </button>
        </div>
      </div>
    </div>
  );
}
