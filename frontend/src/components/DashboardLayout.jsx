import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { Menu, X, LogOut, Download } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { triggerInstall, isStandalone } from "./InstallPrompt";
import { canUser } from "../lib/perm";
import { ROUTE_PERM } from "../pages/admin/nav";
import { getTheme, setTheme, applyTheme } from "../lib/theme";
import { Eye, LayoutDashboard, Sun, Moon, MessageCircle, Mail, Phone } from "lucide-react";
import { useContact, waLink, telLink, fmtWa } from "../lib/contact";

function SupportBox() {
  const c = useContact();
  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs" data-testid="sidebar-support-box">
      <div className="font-bold text-emerald-900">Customer Support</div>
      <a href={waLink(c.whatsapp_number, "Hello Radhika Traders, I need help with my partner account.")} target="_blank" rel="noreferrer" data-testid="sidebar-support-whatsapp" className="mt-1.5 flex items-center gap-1.5 font-semibold text-emerald-800 hover:underline"><MessageCircle style={{ width: 14, height: 14 }} /> WhatsApp {fmtWa(c.whatsapp_number)}</a>
      <a href={telLink(c.support_mobile)} data-testid="sidebar-support-call" className="mt-1 flex items-center gap-1.5 font-semibold text-slate-700 hover:underline"><Phone style={{ width: 14, height: 14 }} /> Call {c.support_mobile}</a>
      <a href={`mailto:${c.support_email}`} data-testid="sidebar-support-email" className="mt-1 flex items-center gap-1.5 break-all font-semibold text-slate-700 hover:underline"><Mail style={{ width: 14, height: 14 }} className="shrink-0" /> {c.support_email}</a>
    </div>
  );
}

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
  return [{ to: "/employee", label: "My Workspace", icon: LayoutDashboard }, ...nav.filter((n) => n.perm && canUser(user, n.perm, "view"))];
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

  const doLogout = () => { logout(); navigate(isEmp ? "/employee/login" : user?.role === "admin" ? "/admin/login" : "/login", { replace: true }); };

  const SideLinks = () => (
    <nav className="flex flex-col gap-1">
      {items.map((n) => {
        const active = loc.pathname === n.to;
        const Icon = n.icon;
        return (
          <Link key={n.to} to={n.to} data-testid={`side-${n.label.toLowerCase().replace(/\s/g, "-")}`}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/"><Logo size="sm" /></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button onClick={() => setOpen(!open)} data-testid="dash-mobile-toggle" className="rounded-lg p-2 text-slate-700">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* Sidebar */}
        <aside className={`${open ? "block" : "hidden"} lg:block fixed lg:sticky inset-x-0 top-14 lg:top-6 z-30 lg:z-auto lg:h-[calc(100vh-3rem)] w-full lg:w-60 shrink-0`}>
          <div className="mx-4 lg:mx-0 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 hidden lg:block"><Link to="/"><Logo size="sm" /></Link></div>
            <div className="mb-4 rounded-xl bg-gradient-to-br from-red-600 to-red-900 p-4 text-white">
              <div className="text-xs text-red-100">{isEmp ? "Employee" : "Signed in as"}</div>
              <div className="truncate font-display font-bold">{user?.name}</div>
              <div className="truncate text-xs text-red-200">{isEmp ? `@${user?.username}` : user?.email}</div>
            </div>
            <SideLinks />
            <button onClick={doLogout} data-testid="dash-logout" className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
              <LogOut style={{ width: 18, height: 18 }} /> Logout
            </button>
            <InstallButton />
            {!isEmp && user?.role === "customer" && <SupportBox />}
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-start justify-between gap-4">
            {title && <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>}
            <div className="flex items-center gap-2">
              <span className="hidden lg:block"><ThemeToggle /></span>
              {user?.role === "customer" && <NotificationBell />}
            </div>
          </div>
          {viewOnly && (
            <div data-testid="view-only-banner" className="mb-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-800">
              <Eye className="h-4 w-4" /> View-only access — you can see this module but cannot make changes. Ask the Super Admin for edit permission.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
