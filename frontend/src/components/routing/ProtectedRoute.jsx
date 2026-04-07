import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-shell">Loading...</div>;
  }

  if (!user) {
    const loginPath = roles?.includes("admin") ? "/login/admin" : "/login/user";
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "admin" ? "/admin/dashboard" : "/search"}
        replace
      />
    );
  }

  return children;
}

export default ProtectedRoute;
