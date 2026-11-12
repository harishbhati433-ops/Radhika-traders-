import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Loader2, X, Eye, Users } from "lucide-react";
import api, { fileUrl } from "../lib/api";
import { Input } from "./ui/input";

const fmt = (iso) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function StoryViewersDialog({ story, onClose }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async (page = 1, append = false) => {
    setBusy(true);
    try {
      const { data: d } = await api.get(`/admin/stories/${story.id}/viewers`, { params: { q, page, limit: 30 } });
      setData((prev) => (append && prev ? { ...d, items: [...prev.items, ...d.items] } : d));
    } finally { setBusy(false); }
  };
  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose} data-testid="story-viewers-dialog">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-bold text-slate-900">Viewers — {story.title || story.category}</h3>
            <div className="mt-1 flex gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700" data-testid="viewers-total"><Eye className="h-3.5 w-3.5" /> {data?.total_views ?? story.total_views ?? 0} Total Views</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700" data-testid="viewers-unique"><Users className="h-3.5 w-3.5" /> {data?.unique_viewers ?? story.unique_viewers ?? 0} Unique Viewers</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" data-testid="viewers-close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-4 pt-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="pl-9" data-testid="viewers-search" /></div></div>
        <div className="flex-1 overflow-y-auto p-4" data-testid="viewers-list">
          {!data && <div className="py-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}
          {data && !data.items.length && <p className="py-8 text-center text-sm text-slate-500" data-testid="viewers-empty">No viewers yet.</p>}
          {data?.items.map((v) => (
            <div key={v.user_id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0" data-testid={`viewer-row-${v.user_id}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 font-display font-bold text-amber-300">{v.avatar_url ? <img src={fileUrl(v.avatar_url)} alt="" className="h-full w-full object-cover" /> : (v.name || "?").charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{v.name || "Customer"}</div>
                <div className="truncate text-[11px] text-slate-500">ID: {v.customer_id}{v.mobile ? ` · ${v.mobile}` : ""}</div>
              </div>
              <div className="text-right text-[11px] text-slate-500"><div>{fmt(v.viewed_at)}</div>{v.count > 1 && <div className="font-semibold text-slate-700">{v.count}× viewed</div>}</div>
            </div>
          ))}
          {data?.has_more && <button type="button" onClick={() => load(data.page + 1, true)} disabled={busy} className="mt-3 w-full rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" data-testid="viewers-load-more">{busy ? "Loading…" : "Load more"}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
