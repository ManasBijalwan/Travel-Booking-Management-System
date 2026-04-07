import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // No user_id — the DB auto-generates it from the sequence
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      await register({
        full_name: form.full_name,
        email:     form.email,
        phone:     form.phone,
        password:  form.password,
      });
      navigate("/search");
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message);
    }
  };

  return (
    <section className="page-shell auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Create Account</p>
        <h1>Create your traveler account</h1>
        <p className="helper-text">
          Already have an account? <Link to="/login/user">Sign in</Link>
        </p>

        {error && <p className="error-text">{error}</p>}

        <input
          name="full_name"
          placeholder="Full Name"
          value={form.full_name}
          onChange={handleChange}
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email address"
          value={form.email}
          autoComplete="email"
          onChange={handleChange}
          required
        />
        <input
          name="phone"
          type="tel"
          placeholder="Phone number (optional)"
          value={form.phone}
          onChange={handleChange}
        />
        <input
          name="password"
          type="password"
          placeholder="Password (min 6 characters)"
          value={form.password}
          autoComplete="new-password"
          onChange={handleChange}
          required
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm password"
          value={form.confirmPassword}
          autoComplete="new-password"
          onChange={handleChange}
          required
        />

        <button type="submit" className="primary-button">
          Create Account
        </button>
      </form>
    </section>
  );
}

export default RegisterPage;
