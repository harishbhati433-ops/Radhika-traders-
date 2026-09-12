import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import { Menu, X, LayoutDashboard, LogOut, User } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/services", label: "Services" },
  { to: "/partners", label: "Partners" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const doLogout = () => { logout(); nav("/"); };

  return (
    <header className="sticky top-0 z-50 rt-glass border-b border-slate-200/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" data-testid="nav-logo"><Logo /></Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l.to} to={l.to} data-testid={`nav-${l.label.toLowerCase()}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                loc.pathname === l.to ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-100"}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <Link to={user.role === "admin" ? "/admin" : user.role === "employee" ? "/employee" : "/dashboard"} data-testid="nav-dashboard"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:brightness-125">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
              <button onClick={doLogout} data-testid="nav-logout" className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Login</Link>
              <Link to="/signup" data-testid="nav-signup" className="rt-gradient-btn rounded-full px-5 py-2 text-sm font-semibold">Get Started</Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} data-testid="nav-mobile-toggle" className="rounded-lg p-2 text-slate-700 lg:hidden">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} data-testid={`nav-mobile-${l.label.toLowerCase()}`}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">{l.label}</Link>
            ))}
            <div className="my-2 h-px bg-slate-200" />
            {user ? (
              <>
                <Link to={user.role === "admin" ? "/admin" : user.role === "employee" ? "/employee" : "/dashboard"} onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>
                <button onClick={() => { setOpen(false); doLogout(); }} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-red-600"><LogOut className="h-4 w-4" /> Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700">Login</Link>
                <Link to="/signup" onClick={() => setOpen(false)} className="rt-gradient-btn rounded-lg px-4 py-2.5 text-center text-sm font-semibold">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
