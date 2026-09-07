import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { Menu, X, LogOut } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

export function DashboardLayout({ nav, children, title }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); navigate("/login", { replace: true }); };

  const SideLinks = () => (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => {
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
        <button onClick={() => setOpen(!open)} data-testid="dash-mobile-toggle" className="rounded-lg p-2 text-slate-700">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        {/* Sidebar */}
        <aside className={`${open ? "block" : "hidden"} lg:block fixed lg:sticky inset-x-0 top-14 lg:top-6 z-30 lg:z-auto lg:h-[calc(100vh-3rem)] w-full lg:w-60 shrink-0`}>
          <div className="mx-4 lg:mx-0 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 hidden lg:block"><Link to="/"><Logo size="sm" /></Link></div>
            <div className="mb-4 rounded-xl bg-gradient-to-br from-red-600 to-red-900 p-4 text-white">
              <div className="text-xs text-red-100">Signed in as</div>
              <div className="truncate font-display font-bold">{user?.name}</div>
              <div className="truncate text-xs text-red-200">{user?.email}</div>
            </div>
            <SideLinks />
            <button onClick={doLogout} data-testid="dash-logout" className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
              <LogOut style={{ width: 18, height: 18 }} /> Logout
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-start justify-between gap-4">
            {title && <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>}
            {user?.role === "customer" && <NotificationBell />}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
