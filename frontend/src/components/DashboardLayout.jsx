import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { Menu, X, LogOut, Download, ChevronDown } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { PushPrompt } from "./PushPrompt";
import { triggerInstall, isStandalone } from "./InstallPrompt";
import { canUser } from "../lib/perm";
import { ROUTE_PERM } from "../pages/admin/nav";
import { getTheme, setTheme, applyTheme } from "../lib/theme";
import { Eye, LayoutDashboard, Sun, Moon } from "lucide-react";
import { SidebarAvatarButton } from "./AvatarUpload";
import { AttendanceNudge } from "./AttendanceNudge";
import { prefetchRoute } from "../lib/prefetch";

function ThemeToggle({ compact }) {
  const [theme, setT] = useState(getTheme());
  useEffect(() => {
    applyTheme(theme);
    const sync = () => setT(getTheme());
    window.addEventListener("rt:theme", sync);
    return () => { window.removeEventListener("rt:theme", sync); applyTheme("light"); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = () => { const n = theme === "dark" ? "light" : "dark"; setTheme(n); };
  const dark = theme === "dark";
  return (
    <button onClick={flip} data-testid={compact ? "theme-toggle-mobile" : "theme-toggle"} title={dark ? "Switch to Light mode" : "Switch to Dark mode"} aria-label="Toggle dark mode"
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 ${compact ? "p-2" : "px-3 py-1.5"}`}>
      {dark ? <Sun style={{ width: 16, height: 16 }} className="text-amber-400" /> : <Moon style={{ width: 16, height: 16 }} />}
      {!compact && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

function navForUser(nav, user) {
  if (user?.role !== "employee") return nav.filter((n) => !n.employeeOnly);
  return [{ to: "/employee", label: "My Workspace", icon: LayoutDashboard }, ...nav.filter((n) => n.employeeOnly || (n.perm && canUser(user, n.perm, "view"))).map(({ group, ...n }) => n)]; // employees get a flat list
}

function InstallButton() {
  const [avail, setAvail] = useState(!!window.__rtInstallPrompt && !isStandalone());
  useEffect(() => {
    const f = () => setAvail(!!window.__rtInstallPrompt && !isStandalone());
    window.addEventListener("rt-install-changed", f);
    return () => window.removeEventListener("rt-install-changed", f);
  }, []);
  if (!avail) return null;
  return (
    <button onClick={triggerInstall} data-testid="sidebar-install-app" className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100">
      <Download style={{ width: 18, height: 18 }} /> Install App
    </button>
  );
}

export function DashboardLayout({ nav, children, title }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isEmp = user?.role === "employee";
  const items = navForUser(nav, user);
  const routePerm = ROUTE_PERM[loc.pathname];
  const viewOnly = isEmp && routePerm && !canUser(user, routePerm, "edit");
  const activeGroup = items.find((n) => n.to === loc.pathname)?.group || null;
  const [openGroup, setOpenGroup] = useState(activeGroup);
  useEffect(() => { setOpenGroup(activeGroup); setOpen(false); }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const doLogout = () => { logout(); navigate(isEmp ? "/employee/login" : user?.role === "admin" ? "/admin/login" : "/app/login", { replace: true }); };

  // Preserve order: ungrouped items stand alone; grouped items collapse into accordion sections (one open at a time)
  const sections = [];
  for (const n of items) {
    if (!n.group) { sections.push({ item: n }); continue; }
    const g = sections.find((s) => s.group === n.group);
    if (g) g.items.push(n); else sections.push({ group: n.group, items: [n] });
  }

  const LinkRow = ({ n, nested }) => {
    const active = loc.pathname === n.to;
    const Icon = n.icon;
    return (
      <Link to={n.to} data-testid={`side-${n.label.toLowerCase().replace(/[\s/]+/g, "-")}`} onClick={() => setOpen(false)} onPointerDown={() => prefetchRoute(n.to)} onMouseEnter={() => prefetchRoute(n.to)}
        className={`flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-semibold transition-colors ${nested ? "pl-9 pr-3" : "px-3"} ${active ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
        <Icon style={{ width: 16, height: 16 }} className="shrink-0" /> <span className="truncate">{n.label}</span>
      </Link>
    );
  };

  const sideLinks = (
    <nav className="flex flex-col gap-0.5" data-testid="sidebar-nav">
      {sections.map((s) => {
        if (s.item) return <LinkRow key={s.item.to} n={s.item} />;
        const isOpen = openGroup === s.group;
        const hasActive = s.items.some((n) => n.to === loc.pathname);
        const GIcon = s.items[0].icon;
        const id = s.group.toLowerCase().replace(/[^a-z]+/g, "-");
        return (
          <div key={s.group} className="rounded-lg">
            <button type="button" onClick={() => setOpenGroup(isOpen ? null : s.group)} aria-expanded={isOpen} data-testid={`side-group-${id}`}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-bold transition-colors ${hasActive && !isOpen ? "bg-red-50 text-red-700" : "text-slate-800 hover:bg-slate-100"}`}>
              <GIcon style={{ width: 16, height: 16 }} className={`shrink-0 ${hasActive ? "text-red-600" : "text-slate-500"}`} />
              <span className="flex-1 truncate">{s.group}</span>
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{s.items.length}</span>
              <ChevronDown style={{ width: 14, height: 14 }} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden"><div className="flex flex-col gap-0.5 py-0.5">{s.items.map((n) => <LinkRow key={n.to} n={n} nested />)}</div></div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const sidebarCard = (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-3 hidden lg:block"><Link to="/"><Logo size="sm" /></Link></div>
      <div className="mb-3 flex items-center gap-3 rounded-xl bg-gradient-to-br from-red-600 to-red-900 p-3 text-white">
        <SidebarAvatarButton />
        <div className="min-w-0">
          <div className="text-[11px] text-red-100">{isEmp ? "Employee" : "Signed in as"}</div>
          <div className="truncate text-sm font-display font-bold">{user?.name}</div>
          <div className="truncate text-[11px] text-red-200">{isEmp ? `@${user?.username}` : user?.email}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]">{sideLinks}</div>
      <div className="mt-2 border-t border-slate-100 pt-2">
        <button onClick={doLogout} data-testid="dash-logout" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50">
          <LogOut style={{ width: 16, height: 16 }} /> Logout
        </button>
        <InstallButton />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button onClick={() => setOpen(!open)} data-testid="dash-mobile-toggle" aria-label="Open menu" className="rounded-lg p-2 text-slate-700">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} data-testid="dash-drawer-backdrop" className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
        <aside data-testid="dash-drawer" className={`absolute inset-y-0 left-0 flex w-[82vw] max-w-xs flex-col p-3 transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="mb-2 flex items-center justify-between px-1"><Logo size="sm" /><button onClick={() => setOpen(false)} data-testid="dash-drawer-close" aria-label="Close menu" className="rounded-lg bg-white p-2 text-slate-700 shadow"><X className="h-5 w-5" /></button></div>
          <div className="min-h-0 flex-1">{sidebarCard}</div>
        </aside>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* Desktop sidebar: fixed height, scrolls inside */}
        <aside className="hidden lg:block sticky top-6 h-[calc(100vh-3rem)] w-60 shrink-0">{sidebarCard}</aside>

        {/* Content */}
        <main className="rt-enter min-w-0 flex-1" key={loc.pathname}>
          <div className="mb-6 flex items-start justify-between gap-4">
            {title && <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>}
            <div className="flex items-center gap-2">
              <span className="hidden lg:block"><ThemeToggle /></span>
              <NotificationBell />
            </div>
          </div>
          {viewOnly && (
            <div data-testid="view-only-banner" className="mb-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-800">
              <Eye className="h-4 w-4" /> View-only access — you can see this module but cannot make changes. Ask the Super Admin for edit permission.
            </div>
          )}
          {isEmp && <AttendanceNudge />}
          {children}
        </main>
        <PushPrompt />
      </div>
    </div>
  );
}
