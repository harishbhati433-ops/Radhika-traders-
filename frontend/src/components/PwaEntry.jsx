import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const homeFor = (u) => (u.role === "admin" ? "/admin" : u.role === "employee" ? "/employee" : "/dashboard");

// Installed app (home-screen icon) opens straight into the panel; normal website visits are untouched.
export const isStandalone = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true || new URLSearchParams(window.location.search).get("source") === "pwa";
  } catch { return false; }
};

export function PwaEntry() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || loading) return;
    done.current = true;
    if (!isStandalone()) return;
    const p = pathname.replace(/\/$/, "") || "/";
    if (p === "/") nav(user ? homeFor(user) : "/login", { replace: true });
    else if (p === "/employee" && !user) nav("/employee/login", { replace: true });
    else if (p === "/admin" && !user) nav("/admin/login", { replace: true });
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
