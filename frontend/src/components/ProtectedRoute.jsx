import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canUser } from "../lib/perm";

const homeFor = (u) => (u.role === "admin" ? "/admin" : u.role === "employee" ? "/employee" : "/dashboard");

export function ProtectedRoute({ children, role, perm }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to={role === "admin" ? "/admin/login" : role === "employee" ? "/employee/login" : "/login"} replace />;
  if (role === "admin" && user.role === "employee") {
    if (perm && canUser(user, perm, "view")) return children;
    return <Navigate to="/employee" replace />;
  }
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
