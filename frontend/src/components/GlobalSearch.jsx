import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Search, X, Loader2, Megaphone, ClipboardList, Wallet, Banknote, FileText, Users, UserCog, Clock, ArrowRight, CornerDownLeft, AlertTriangle } from "lucide-react";

const ICON = { campaigns: Megaphone, leads: ClipboardList, transactions: Wallet, withdrawals: Banknote, reports: FileText, customers: Users, employees: UserCog };
const TONE = { emerald: "bg-emerald-50 text-emerald-700 border-emerald-200", amber: "bg-amber-50 text-amber-700 border-amber-200", rose: "bg-rose-50 text-rose-700 border-rose-200", sky: "bg-sky-50 text-sky-700 border-sky-200", violet: "bg-violet-50 text-violet-700 border-violet-200", slate: "bg-slate-100 text-slate-600 border-slate-200" };
const HINTS = { customer: "Campaign name, Lead ID, mobile, ref ID, amount…", employee: "Lead ID, mobile, customer, campaign, amount…", admin: "Name, mobile, email, Lead ID, ref ID, campaign, amount…" };

const recentKey = (role) => `rt-recent-search-${role || "x"}`;
const readRecent = (role) => { try { return JSON.parse(localStorage.getItem(recentKey(role)) || "[]"); } catch { return []; } };
const pushRecent = (role, q) => { const list = [q, ...readRecent(role).filter((x) => x !== q)].slice(0, 5); localStorage.setItem(recentKey(role), JSON.stringify(list)); return list; };

function Mark({ text, q }) {
  if (!q || !text) return <>{text}</>;
  const i = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-amber-200/70 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function ResultRow({ item, q, active, onPick, idx }) {
  const Icon = ICON[item.group] || Search;
  return (
    <button type="button" data-testid={`gs-result-${item.group}-${item.id}`} data-idx={idx} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(item)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-slate-50"}`}>
      {item.image ? <img src={item.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900"><Mark text={item.title} q={q} /></span>
        <span className="block truncate text-xs text-slate-500"><Mark text={item.subtitle} q={q} /></span>
      </span>
      {item.badge && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[item.tone] || TONE.slate}`}>{String(item.badge).replace(/_/g, " ")}</span>}
      <ArrowRight className={`h-4 w-4 shrink-0 ${active ? "text-red-500" : "text-slate-300"}`} />
    </button>
  );
}

export function GlobalSearch({ compact = false }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [more, setMore] = useState({});
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const reqRef = useRef(0);

  const close = useCallback(() => { setOpen(false); setQ(""); setData(null); setError(""); setMore({}); }, []);
  const openBox = useCallback(() => { setRecent(readRecent(user?.role)); setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); }, [user?.role]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open ? close() : openBox(); }
      else if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, openBox]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setData(null); setError(""); setLoading(false); return; }
    setLoading(true); setError("");
    const id = ++reqRef.current;
    const t = setTimeout(() => {
      api.get("/search", { params: { q: term } })
        .then(({ data }) => { if (id === reqRef.current) { setData(data); setActive(0); setMore({}); } })
        .catch((err) => { if (id === reqRef.current) { setData(null); setError(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Search failed — please try again"); } })
        .finally(() => { if (id === reqRef.current) setLoading(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const groups = useMemo(() => (data?.groups || []).map((g) => ({ ...g, items: (more[g.key]?.items || g.items).map((it) => ({ ...it, group: g.key })), total: more[g.key]?.total ?? g.total })), [data, more]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const pick = (item) => { const term = q.trim(); if (term) setRecent(pushRecent(user?.role, term)); close(); nav(item.link); };
  const loadMore = async (g) => {
    try { const { data: d } = await api.get("/search", { params: { q: q.trim(), group: g.key, limit: 50 } }); const gg = d.groups.find((x) => x.key === g.key); if (gg) setMore((m) => ({ ...m, [g.key]: gg })); }
    catch { setError("Could not load more results"); }
  };
  const onKeyDown = (e) => {
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && flat[active]) { e.preventDefault(); pick(flat[active]); }
  };
  useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const term = q.trim();
  const showEmpty = !loading && !error && term.length >= 2 && data && flat.length === 0;
  let idx = -1;

  return (
    <>
      <button type="button" onClick={openBox} data-testid={compact ? "global-search-btn-mobile" : "global-search-btn"} aria-label="Search" title="Search (Ctrl+K)"
        className={compact ? "rounded-lg p-2 text-slate-700" : "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 lg:pr-3"}>
        <Search className="h-5 w-5" />
        {!compact && <span className="hidden text-xs font-semibold text-slate-400 lg:inline">Search <kbd className="ml-1 rounded border border-slate-200 bg-slate-50 px-1 font-sans text-[10px]">Ctrl K</kbd></span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:p-4 sm:pt-[8vh]" data-testid="global-search-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[80vh] sm:w-[min(680px,100%)] sm:rounded-3xl sm:border sm:border-slate-200" data-testid="global-search-panel">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-red-600" data-testid="gs-loading" /> : <Search className="h-5 w-5 shrink-0 text-slate-400" />}
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} data-testid="global-search-input" placeholder={HINTS[user?.role] || "Search…"} autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm" />
              {q && <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} data-testid="gs-clear" aria-label="Clear search" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>}
              <button type="button" onClick={close} data-testid="gs-close" className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">Esc</button>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 rt-scroll">
              {term.length < 2 && (
                <div className="p-3" data-testid="gs-idle">
                  {recent.length > 0 && (
                    <>
                      <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Recent searches</span>
                        <button type="button" onClick={() => { localStorage.removeItem(recentKey(user?.role)); setRecent([]); }} data-testid="gs-clear-recent" className="font-semibold normal-case tracking-normal text-red-600 hover:underline">Clear</button></div>
                      <div className="flex flex-wrap gap-1.5">{recent.map((r) => <button key={r} type="button" onClick={() => setQ(r)} data-testid="gs-recent-chip" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-red-300 hover:bg-red-50">{r}</button>)}</div>
                    </>
                  )}
                  <p className={`text-center text-xs text-slate-400 ${recent.length ? "mt-5" : "mt-2"}`}>Type at least 2 characters · ↑ ↓ to move · <CornerDownLeft className="inline h-3 w-3" /> to open</p>
                </div>
              )}
              {error && <div className="m-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" data-testid="gs-error"><AlertTriangle className="h-4 w-4 shrink-0" /> {String(error)}</div>}
              {showEmpty && (
                <div className="px-4 py-10 text-center" data-testid="gs-empty">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Search className="h-5 w-5" /></div>
                  <div className="text-sm font-bold text-slate-800">No results found for “{term}”</div>
                  <div className="mt-1 text-xs text-slate-500">Try a name, mobile number, ID or amount.</div>
                </div>
              )}
              {groups.map((g) => {
                const Icon = ICON[g.key] || Search;
                return (
                  <div key={g.key} className="mb-2" data-testid={`gs-group-${g.key}`}>
                    <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {g.label}</span><span data-testid={`gs-group-total-${g.key}`}>{g.total}</span>
                    </div>
                    {g.items.map((it) => { idx += 1; return <ResultRow key={`${g.key}-${it.id}`} item={it} q={term} active={active === idx} idx={idx} onPick={pick} />; })}
                    {g.total > g.items.length && <button type="button" onClick={() => loadMore(g)} data-testid={`gs-more-${g.key}`} className="mt-1 w-full rounded-xl py-2 text-center text-xs font-bold text-red-600 hover:bg-red-50">Show all {g.total} {g.label.toLowerCase()}</button>}
                  </div>
                );
              })}
            </div>
            <div className="hidden items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:flex">
              <span>{user?.role === "customer" ? "Searching only your own records" : user?.role === "employee" ? "Results limited to your permitted modules" : "Searching all admin records"}</span>
              <span>{flat.length > 0 ? `${flat.length} shown` : ""}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
