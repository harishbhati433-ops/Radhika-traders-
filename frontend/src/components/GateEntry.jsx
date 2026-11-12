import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { grantGate, isBot, GATE_SLUG_RE } from "../lib/gate";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found | Radhika Traders";
    for (const n of ["robots", "googlebot"]) { let m = document.head.querySelector(`meta[name="${n}"]`); if (!m) { m = document.createElement("meta"); m.name = n; document.head.appendChild(m); } m.content = "noindex, nofollow"; }
  }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-6 text-center" data-testid="hidden-page">
      <img src="/images/logo-tile.png" alt="" className="mb-6 h-16 w-16 rounded-2xl shadow-lg ring-1 ring-amber-500/40" />
      <h1 className="font-display text-5xl font-extrabold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-500">Page not found — the page you're looking for doesn't exist.</p>
      <a href="/" className="mt-6 rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">Go to homepage</a>
    </div>
  );
}

// Catch-all route: a single-segment path may be a secret staff link — ask the server; anything else (and every bot) is a plain 404.
export function GateOrNotFound() {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  const candidate = !isBot() && !slug.includes("/") && GATE_SLUG_RE.test(slug);
  const [resolved, setResolved] = useState(!candidate);
  useEffect(() => {
    if (!candidate) return;
    let alive = true;
    api.get(`/gate/${slug}`, { noCache: true }).then(({ data }) => {
      if (!alive) return;
      grantGate(data.portal);
      const next = new URLSearchParams(search).get("next");
      const base = data.portal === "admin" ? "/admin" : "/employee";
      nav(next && next.startsWith(base) ? next : `${base}/login`, { replace: true });
    }).catch(() => alive && setResolved(true));
    return () => { alive = false; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!resolved) return null;
  return <NotFoundPage />;
}
