import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = localStorage.getItem("rt_token");
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("rt_token");
      setUser(null);
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
    sessionStorage.clear();
    setUser(null);
  };

  useEffect(() => {
    const onLogout = () => { setUser(null); setLoading(false); };
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
