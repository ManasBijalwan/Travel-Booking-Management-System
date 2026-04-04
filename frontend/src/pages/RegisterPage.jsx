import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    user_id: "",
    full_name: "",
    email: "",
    phone: "",
    password: ""
  });
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await register(form);
      navigate("/");
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return (
    <section className="page-shell auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Create Account</p>
        <h1>Create your traveler account</h1>
        {error && <p className="error-text">{error}</p>}
        <input
          type="text"
          placeholder="User ID"
          value={form.user_id}
          onChange={(event) => setForm({ ...form, user_id: event.target.value })}
        />
        <input
          placeholder="Full Name"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          type="tel"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        <button type="submit" className="primary-button">
          Create Account
        </button>
      </form>
    </section>
  );
}

export default RegisterPage;
