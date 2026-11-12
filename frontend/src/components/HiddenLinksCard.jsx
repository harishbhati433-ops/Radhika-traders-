import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, Link2 } from "lucide-react";
import api, { formatApiErrorDetail } from "../lib/api";

const dt = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// Secret staff entry links — stored only on the server, shown only to the logged-in admin, rotatable in one click.
export function HiddenLinksCard() {
  const [g, setG] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/security/gates", { noCache: true }).then(({ data }) => setG(data)).catch(() => setG({})); }, []);

  const rotate = async () => {
    if (!window.confirm("Change BOTH secret links now?\n\nOld links stop working immediately (they will show 'Page not found'). Devices already unlocked and installed apps keep working. Share the new links personally with your team.")) return;
    setBusy(true);
    try { const { data } = await api.post("/admin/security/gates/rotate"); setG(data); toast.success("New secret links generated — old links are now dead"); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); } finally { setBusy(false); }
  };
  const copy = (url) => { navigator.clipboard?.writeText(url); toast.success("Link copied"); };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="hidden-links-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-display text-base font-bold text-slate-900"><Link2 className="h-4 w-4 text-slate-500" /> Hidden panel links</div>
        <button type="button" onClick={rotate} disabled={busy || !g} data-testid="hidden-links-rotate" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:brightness-125 disabled:opacity-60">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Rotate links</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">/admin and /employee show "Page not found" to everyone (and to Google) until a device opens its secret link once. These links are never written into the website code — only you can see them here. Leaked? Tap <b>Rotate links</b>: old links die instantly, unlocked devices and installed apps keep working.</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {[["Admin panel", g?.admin, "hidden-link-admin"], ["Employee panel", g?.employee, "hidden-link-employee"]].map(([l, url, tid]) => (
          <div key={tid} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{l}</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800" data-testid={tid}>{url || (g ? "—" : "Loading…")}</code>
              <button type="button" onClick={() => copy(url)} disabled={!url} data-testid={`${tid}-copy`} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:brightness-125 disabled:opacity-50"><Copy className="h-3 w-3" /> Copy</button>
            </div>
          </div>
        ))}
      </div>
      {g?.rotated_at && <p className="mt-2 text-[11px] text-slate-400" data-testid="hidden-links-rotated">Last changed: {dt(g.rotated_at)}</p>}
    </div>
  );
}
