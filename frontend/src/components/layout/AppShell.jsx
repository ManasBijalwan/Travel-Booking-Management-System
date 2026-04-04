import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AppShell() {
  const { user, isUser, isAdmin, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to={user ? (isAdmin ? "/admin/dashboard" : "/search") : "/login/user"} className="brand">
          TravelSphere
        </NavLink>

        <nav className="topnav">
          {isUser && <NavLink to="/search">Book</NavLink>}
          {isUser && <NavLink to="/history">My Bookings</NavLink>}
          {isAdmin && <NavLink to="/admin/dashboard">Admin Panel</NavLink>}
        </nav>

        <div className="auth-actions">
          {user ? (
            <>
              <span className="user-pill">{user.name} ({user.role})</span>
              <button type="button" className="ghost-button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login/user" className="ghost-button">
                User Login
              </NavLink>
              <NavLink to="/login/admin" className="ghost-button">
                Admin Login
              </NavLink>
              <NavLink to="/register" className="primary-button">
                User Sign Up
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
