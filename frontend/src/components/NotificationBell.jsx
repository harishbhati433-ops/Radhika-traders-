import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Bell, Megaphone, ShieldCheck, Info, CheckCheck } from "lucide-react";

const ICON = { campaign_live: Megaphone, kyc: ShieldCheck, broadcast: Info };

export function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  const load = () => api.get("/notifications").then(({ data }) => setData(data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(() => document.visibilityState === "visible" && load(), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const markAll = async () => { await api.post("/notifications/read", []); load(); };
  const openItem = async (n) => {
    if (!n.read) await api.post("/notifications/read", [n.id]);
    setOpen(false); load();
    if (n.link) nav(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} data-testid="notif-bell" aria-label="Notifications"
        className="relative rounded-full border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span data-testid="notif-unread" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div data-testid="notif-panel" className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-display font-bold text-slate-900">Notifications</span>
            {data.unread > 0 && <button onClick={markAll} data-testid="notif-mark-all" className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto rt-scroll">
            {data.items.length === 0 && <p className="p-6 text-center text-sm text-slate-500" data-testid="notif-empty">No notifications yet.</p>}
            {data.items.map((n) => {
              const Icon = ICON[n.type] || Info;
              return (
                <button key={n.id} onClick={() => openItem(n)} data-testid={`notif-item-${n.id}`}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? "" : "bg-red-50/60"}`}>
                  <span className={`mt-0.5 rounded-lg p-1.5 ${n.read ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-600"}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? "font-medium text-slate-700" : "font-bold text-slate-900"}`}>{n.title}</span>
                    <span className="block text-xs text-slate-500 line-clamp-2">{n.body}</span>
                    <span className="block text-[10px] text-slate-400">{(n.created_at || "").slice(0, 16).replace("T", " ")}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
