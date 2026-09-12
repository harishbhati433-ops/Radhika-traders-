import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";
import { MaintenancePage } from "../pages/MaintenancePage";

const POLL_MS = 45000;

export function ShutdownGate({ children }) {
  const [state, setState] = useState(null);
  const { pathname } = useLocation();
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/employee");

  const check = () => api.get("/status/public").then(({ data }) => setState(data)).catch(() => {});
  useEffect(() => {
    check();
    const t = setInterval(check, POLL_MS);
    const onShutdown = (e) => { setState({ active: true, ...e.detail }); if (!window.location.pathname.startsWith("/admin") && !window.location.pathname.startsWith("/employee")) { localStorage.removeItem("rt_token"); window.dispatchEvent(new Event("rt:logout")); } };
    window.addEventListener("rt:shutdown", onShutdown);
    return () => { clearInterval(t); window.removeEventListener("rt:shutdown", onShutdown); };
  }, []);

  if (state?.active && !isAdminArea) return <MaintenancePage state={state} onRecheck={check} />;
  return children;
}
