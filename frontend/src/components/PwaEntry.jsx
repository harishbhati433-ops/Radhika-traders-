import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { grantGate } from "../lib/gate";

const homeFor = (u) => (u.role === "admin" ? "/admin" : u.role === "employee" ? "/employee" : "/app/dashboard");

// Installed app (home-screen icon) opens straight into the panel; normal website visits are untouched.
// Only a real standalone display counts for unlocking the staff gate — a "?source=pwa" query alone is just a navigation hint.
export const isStandalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch { return false; }
};
const pwaHint = () => isStandalone() || new URLSearchParams(window.location.search).get("source") === "pwa";

export function PwaEntry() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loading) return;
    done.current = true;
    if (!pwaHint()) return;
    const p = pathname.replace(/\/$/, "") || "/";
    if (p.startsWith("/admin")) grantGate("admin"); else if (p.startsWith("/employee")) grantGate("employee");
    if (p === "/") nav(user ? homeFor(user) : "/app/login", { replace: true });
    else if (p === "/employee" && !user) nav("/employee/login", { replace: true });
    else if (p === "/admin" && !user) nav("/admin/login", { replace: true });
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
