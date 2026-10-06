import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { grantGate } from "../lib/gate";

// Opening the secret link unlocks the staff panel on this device, then forwards to its login (or ?next=).
export function GateEntry({ portal }) {
  const nav = useNavigate();
  const { search } = useLocation();
  useEffect(() => {
    grantGate(portal);
    const next = new URLSearchParams(search).get("next");
    const base = portal === "admin" ? "/admin" : "/employee";
    nav(next && next.startsWith(base) ? next : `${base}/login`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
