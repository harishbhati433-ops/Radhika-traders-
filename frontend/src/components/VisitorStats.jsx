import { useState } from "react";
import api, { formatApiErrorDetail } from "../lib/api";
import { useLivePoll } from "../lib/useLivePoll";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, Users, UserPlus, Activity, CalendarDays, Mail, Loader2, RotateCcw, ArrowUpRight, ArrowDownRight } from "lucide-react";

const HI_DAYS = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const fmtLong = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const label = (d, short) => (short ? HI_DAYS[new Date(d + "T00:00:00").getDay()] : fmt(d));

function StatCard({ icon: Icon, tone, title, value, sub, testId, delta }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md" data-testid={testId}>
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4.5 w-4.5" /></div>
      <div className="mt-3 text-sm text-slate-600">{title}</div>
      <div className="mt-0.5 flex items-end gap-2">
        <div className="font-display text-3xl font-extrabold tracking-tight text-slate-950" data-testid={`${testId}-value`}>{Number(value).toLocaleString("en-IN")}</div>
        {delta !== undefined && delta !== 0 && <span className={`mb-1 inline-flex items-center text-xs font-bold ${delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{delta > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(delta)}</span>}
      </div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}

const ChartTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><div className="font-bold text-slate-900">{fmtLong(p.date)}</div><div className="text-red-600">Visitors: <b>{p.visitors}</b></div><div className="text-slate-500">Page views: {p.views}</div></div>;
};

export function VisitorStats() {
  const [d, setD] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [sending, setSending] = useState(false);

  useLivePoll(() => { api.get("/admin/visits/summary", { params: range }).then(({ data }) => setD(data)).catch(() => {}); }, [range], 60000);

  const sendNow = async () => {
    setSending(true);
    try { const { data } = await api.post("/admin/visits/send-report"); toast.success(`Report emailed (${data.visitors} visitors on ${fmt(data.date)}) to ${data.sent} admin inbox(es)`); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSending(false); }
  };
  if (!d) return null;
  const short = d.series.length <= 14;
  const data = d.series.map((x) => ({ ...x, label: label(x.date, short) }));
  const quick = [["Yesterday", d.yesterday], ["This week", d.this_week], ["This month", d.this_month], ["Last 7 days", d.last_7_days], ["Last 30 days", d.last_30_days]];

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5" data-testid="visitor-stats">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-950"><Eye className="h-5 w-5 text-red-600" /> Website Overview</div>
          <div className="mt-0.5 text-xs text-slate-600">कितने लोग website पर आ रहे हैं — सिर्फ़ संख्या, किसी का नाम/number नहीं। Daily report रात 12:00 बजे email पर।</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200" data-testid="visits-live-badge"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span> Live Dashboard</span>
          <button type="button" onClick={sendNow} disabled={sending} data-testid="visits-send-report" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Email report</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} tone="bg-blue-50 text-blue-600" title="आज के Visitors" value={d.today.visitors} sub="Unique visitors" testId="visits-card-today" delta={d.today.visitors - d.yesterday.visitors} />
        <StatCard icon={Eye} tone="bg-emerald-50 text-emerald-600" title="Page Views" value={d.today.views} sub="कुल पेज देखे गए (आज)" testId="visits-card-views" />
        <StatCard icon={Activity} tone="bg-violet-50 text-violet-600" title="अभी ऑनलाइन" value={d.online_now} sub="Active in last 5 min" testId="visits-card-online" />
        <StatCard icon={UserPlus} tone="bg-amber-50 text-amber-600" title="नए Signups" value={d.signups_today} sub="आज के नए अकाउंट" testId="visits-card-signups" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quick.map(([l, v]) => <span key={l} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200" data-testid={`visits-quick-${l.replace(/\s/g, "-").toLowerCase()}`}>{l}: <b className="font-mono">{v.visitors}</b> <span className="text-slate-400">· {v.views} views</span></span>)}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-base font-bold text-slate-900">ट्रैफिक रिपोर्ट</div>
            <div className="text-xs text-slate-500">दिन के अनुसार Visitors · {fmt(d.range.start)} – {fmt(d.range.end)} · <b className="font-mono text-slate-800" data-testid="visits-range-total">{d.range.visitors}</b> visitors, {d.range.views} views</div>
          </div>
          <div className="flex flex-wrap items-end gap-2" data-testid="visits-filter">
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">From</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="visits-from" className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="visits-to" className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs" /></div>
            <button type="button" onClick={() => setRange({ start, end })} data-testid="visits-apply" className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-2 text-xs font-bold text-white"><CalendarDays className="h-3.5 w-3.5" /> Show</button>
            <button type="button" onClick={() => { setStart(""); setEnd(""); setRange({ start: "", end: "" }); }} data-testid="visits-reset" title="Last 30 days" className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600"><RotateCcw className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="mt-3 h-56" data-testid="visits-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs><linearGradient id="rtVisit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity={0.35} /><stop offset="100%" stopColor="#dc2626" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={short ? 0 : "preserveStartEnd"} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="visitors" stroke="#dc2626" strokeWidth={2.5} fill="url(#rtVisit)" dot={{ r: 3, fill: "#dc2626", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="max-h-60 overflow-auto rounded-2xl border border-slate-200 bg-white rt-scroll" data-testid="visits-table">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-2.5">Date</th><th className="p-2.5 text-right">Visitors</th><th className="p-2.5 text-right">Page views</th></tr></thead>
            <tbody>{[...d.series].reverse().map((x) => <tr key={x.date} className="border-t border-slate-100" data-testid={`visits-row-${x.date}`}><td className="p-2.5">{fmtLong(x.date)}</td><td className="p-2.5 text-right font-mono font-bold">{x.visitors}</td><td className="p-2.5 text-right font-mono text-slate-500">{x.views}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3" data-testid="visits-top-pages">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">सबसे ज़्यादा खोले गए पेज</div>
          <ul className="mt-2 space-y-1.5 text-xs">{d.top_pages.length === 0 && <li className="text-slate-400">No visits yet</li>}{d.top_pages.map((p) => <li key={p.path} className="flex items-center justify-between gap-2"><span className="truncate font-mono text-slate-700">{p.path}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono font-bold">{p.views}</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
