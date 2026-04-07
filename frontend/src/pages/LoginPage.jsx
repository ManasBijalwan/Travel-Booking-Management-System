import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const roleContent = {
  user: {
    title: "User Login",
    subtitle: "Sign in first, then search and book train, bus, or flight tickets.",
    successPath: "/search",
  },
  admin: {
    title: "Admin Login",
    subtitle: "Sign in to manage vehicles, routes, bookings, and payments.",
    successPath: "/admin/dashboard",
  },
};

function LoginPage({ role = "user" }) {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ user_id: "", password: "" });
  const [error, setError] = useState("");

  const content = roleContent[role];
  const from =
    new URLSearchParams(location.search).get("redirect") ||
    location.state?.from?.pathname ||
    content.successPath;

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
      setError(submitError.response?.data?.error || submitError.message);
    }
  };

  return (
    <section className="page-shell auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">
          {role === "admin" ? "Operations Access" : "Traveler Access"}
        </p>
        <h1>{content.title}</h1>
        <p className="helper-text">{content.subtitle}</p>

        {error && <p className="error-text">{error}</p>}

        <input
          type="text"
          placeholder="User ID"
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
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
