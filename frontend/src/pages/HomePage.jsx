import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function HomePage() {
  const { user, isAdmin, isUser } = useAuth();

  return (
    <section className="page-shell auth-page">
      <div className="auth-card">
        <p className="eyebrow">Travel Booking Management System</p>
        <h1>TravelSphere</h1>
        <p className="helper-text">
          Search routes, manage bookings, and access admin operations from one place.
        </p>

        {user ? (
          isAdmin ? (
            <Link to="/admin/dashboard" className="primary-button">
              Open Admin Dashboard
            </Link>
          ) : (
            <Link to="/search" className="primary-button">
              Go To Bookings
            </Link>
          )
        ) : (
          <>
            <Link to="/login/user" className="primary-button">
              User Login
            </Link>
            <Link to="/login/admin" className="ghost-button">
              Admin Login
            </Link>
            <Link to="/register" className="ghost-button">
              Create Account
            </Link>
          </>
        )}

        {isUser && (
          <Link to="/history" className="ghost-button">
            View My Bookings
          </Link>
        )}
      </div>
    </section>
  );
}

export default HomePage;
