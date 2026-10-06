import { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { currentPortal, getToken, getCachedUser, saveSession, saveUser, clearSession, resolveBucket } from "../lib/portal";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const portalRef = useRef(currentPortal());
  const cached = getCachedUser(portalRef.current);
  const [user, setUserState] = useState(cached);
  const [loading, setLoading] = useState(!cached && !!getToken(portalRef.current));
  const setUser = (u) => { setUserState(u); saveUser(portalRef.current, u); };

  const refresh = async () => {
    if (!getToken(portalRef.current)) { setUserState(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) { clearSession(portalRef.current); setUserState(null); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by PortalSync when the URL moves between /, /employee/* and /admin/* — swap to that portal's own session.
  const switchPortal = (portal) => {
    if (resolveBucket(portal) === resolveBucket(portalRef.current) && portalRef.current === portal) return;
    const sameBucket = resolveBucket(portal) === resolveBucket(portalRef.current);
    portalRef.current = portal;
    if (sameBucket) return;
    const c = getCachedUser(portal);
    setUserState(c);
    if (!c && getToken(portal)) { setLoading(true); refresh(); } else setLoading(false);
  };

  const loginWithToken = (token, userObj) => {
    const portal = userObj.role === "admin" ? "admin" : userObj.role === "employee" ? "employee" : "customer";
    saveSession(portal, token, userObj);
    portalRef.current = portal;
    setUserState(userObj);
  };

  const logout = () => {
    clearSession(portalRef.current);
    try { if (user?.id) sessionStorage.removeItem(`rt_unlocked_${user.id}`); } catch {}
    setUserState(null);
  };

  useEffect(() => {
    const onLogout = () => { setUserState(null); setLoading(false); };
    window.addEventListener("rt:logout", onLogout);
    return () => window.removeEventListener("rt:logout", onLogout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginWithToken, logout, refresh, switchPortal, portal: portalRef.current }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
