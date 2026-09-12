import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

const CACHED_USER = "rt_user";

export function AuthProvider({ children }) {
  const cached = (() => { try { return localStorage.getItem("rt_token") ? JSON.parse(localStorage.getItem(CACHED_USER) || "null") : null; } catch { return null; } })();
  const [user, setUserState] = useState(cached);
  const [loading, setLoading] = useState(!cached);
  const setUser = (u) => { setUserState(u); if (u) localStorage.setItem(CACHED_USER, JSON.stringify(u)); else localStorage.removeItem(CACHED_USER); };

  const refresh = async () => {
    const token = localStorage.getItem("rt_token");
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) { localStorage.removeItem("rt_token"); setUser(null); }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const loginWithToken = (token, userObj) => {
    localStorage.setItem("rt_token", token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("rt_token");
    localStorage.removeItem(CACHED_USER);
    sessionStorage.clear();
    setUserState(null);
  };

  useEffect(() => {
    const onLogout = () => { localStorage.removeItem(CACHED_USER); setUserState(null); setLoading(false); };
    window.addEventListener("rt:logout", onLogout);
    return () => window.removeEventListener("rt:logout", onLogout);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, loginWithToken, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
