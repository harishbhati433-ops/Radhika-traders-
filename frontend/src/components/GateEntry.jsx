import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { grantGate, isBot, GATE_SLUG_RE } from "../lib/gate";
import { getSavedCredential } from "../lib/credentialStore";
import { useAuth } from "../context/AuthContext";

// Staff whose browser data was cleared land on the 404 wall. If Chrome still holds their saved login, sign them in and re-open the gate silently.
function useStaffResume() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { loginWithToken } = useAuth();
  useEffect(() => {
    const portal = pathname.startsWith("/admin") ? "admin" : pathname.startsWith("/employee") ? "employee" : "";
    if (!portal || isBot()) return;
    let alive = true;
    (async () => {
      const cred = await getSavedCredential("optional");
      if (!cred || !alive) return;
      try {
        const { data } = portal === "admin"
          ? await api.post("/auth/login", { email: cred.id, password: cred.password, portal: "admin" })
          : await api.post("/auth/employee/login", { username: cred.id, password: cred.password });
        if (!alive) return;
        grantGate(portal);
        if (data.token) { loginWithToken(data.token, data.user); nav(`/${portal}`, { replace: true }); }
        else nav(`/${portal}/login`, { replace: true, state: { autoCred: cred, twoFaPending: true } });
      } catch {}
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function NotFoundPage() {
  useStaffResume();
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
// Network failures never masquerade as 404: we retry, then show a "retry" card.
const IN_APP = /; wv\)|FBAN|FBAV|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent || "");

export function GateOrNotFound() {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const slug = pathname.replace(/^\/+|\/+$/g, "").replace(/[.,;:!?)\]]+$/, "");
  const candidate = !isBot() && !slug.includes("/") && GATE_SLUG_RE.test(slug);
  const [state, setState] = useState(candidate ? "checking" : "notfound"); // checking | notfound | offline
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!candidate) return;
    let alive = true;
    setState("checking");
    api.get(`/gate/${slug}`, { noCache: true, timeout: 12000 }).then(({ data }) => {
      if (!alive) return;
      grantGate(data.portal);
      const next = new URLSearchParams(search).get("next");
      const base = data.portal === "admin" ? "/admin" : "/employee";
      nav(next && next.startsWith(base) ? next : `${base}/login`, { replace: true });
    }).catch((err) => {
      if (!alive) return;
      if (err.response && err.response.status > 0) return setState("notfound");
      if (attempt < 2) return setTimeout(() => alive && setAttempt((a) => a + 1), 1500);
      setState("offline");
    });
    return () => { alive = false; };
  }, [slug, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "checking") return <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]" data-testid="gate-checking"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-red-600" /></div>;
  if (state === "offline") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-6 text-center" data-testid="gate-offline">
        <img src="/images/logo-tile.png" alt="" className="mb-6 h-16 w-16 rounded-2xl shadow-lg ring-1 ring-amber-500/40" />
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Connection problem</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">Could not reach the server to check this link. Check your internet and try again.</p>
        {IN_APP && <p className="mt-2 max-w-sm text-xs text-amber-700">Tip: you seem to be inside an app's browser (WhatsApp etc.). Tap ⋮ → <b>Open in Chrome</b>, or paste the link in Chrome.</p>}
        <button type="button" onClick={() => setAttempt((a) => a + 1)} data-testid="gate-retry" className="mt-6 rounded-full bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700">Try again</button>
      </div>
    );
  }
  return <NotFoundPage />;
}
