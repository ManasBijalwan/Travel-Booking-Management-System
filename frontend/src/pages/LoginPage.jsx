import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const roleContent = {
  user: {
    title: "User Login",
    subtitle: "Sign in first, then search and book train, bus, or flight tickets.",
    demo: "Demo user: user_id U002 / password user123",
    successPath: "/search"
  },
  admin: {
    title: "Admin Login",
    subtitle: "Sign in to manage vehicles, routes, bookings, and payments.",
    demo: "Demo admin: user_id A001 / password admin123",
    successPath: "/admin/dashboard"
  }
};

function LoginPage({ role = "user" }) {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ user_id: "", password: "" });
  const [error, setError] = useState("");

  const content = roleContent[role];
  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get("redirect");
  const fromState = location.state?.from?.pathname;
  const from = redirectParam || fromState || content.successPath;

  if (user?.role === role) {
    return <Navigate to={content.successPath} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await login({ ...form, expectedRole: role });
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <section className="page-shell auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">{role === "admin" ? "Operations Access" : "Traveler Access"}</p>
        <h1>{content.title}</h1>
        <p className="helper-text">{content.subtitle}</p>
        <p className="helper-text">{content.demo}</p>
        {error && <p className="error-text">{error}</p>}
        <input
          type="text"
          placeholder="User ID"
          value={form.user_id}
          onChange={(event) => setForm({ ...form, user_id: event.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <button type="submit" className="primary-button">
          Login as {role === "admin" ? "Admin" : "User"}
        </button>
        {role === "user" ? (
          <p className="helper-text">
            New traveler? <Link to="/register">Create a user account</Link>
          </p>
        ) : (
          <p className="helper-text">
            Need customer access? <Link to="/login/user">Go to user login</Link>
          </p>
        )}
      </form>
    </section>
  );
}

export default LoginPage;
