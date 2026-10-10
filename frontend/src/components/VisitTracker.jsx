import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { portalFromPath } from "../lib/portal";

const API = process.env.REACT_APP_BACKEND_URL;
const KEY = "rt_vid";
const vid = () => { let v = localStorage.getItem(KEY); if (!v) { v = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(KEY, v); } return v; };

// Anonymous visit counter: one ping per page view, random id only (no name / number / user id).
export function VisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`${API}/api/visit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vid: vid(), path: pathname, portal: portalFromPath(pathname) }), keepalive: true }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}
