import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import { useWard } from "../context/WardContext";
import { CLINICAL_ROLES } from "../access";

const DEPARTMENTS = ["", "Emergency", "ICU", "General Ward"];

export default function Signup() {
  const { signup, user } = useWard();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "", department: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user?.role === "pending" || user?.status === "pending") return <Navigate to="/pending" replace />;
  if (CLINICAL_ROLES.includes(user?.role)) return <Navigate to="/app" replace />;

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError("Password and confirm password must match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await signup({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        department: form.department,
      });
      navigate("/", {
        replace: true,
        state: {
          email: created.email,
          notice: `${created.email} is registered. Log in with the same password. An admin assigns your role before the dashboard opens. Next time, log in directly.`,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand-lockup">
          <BrandLogo size={52} />
          <div><b>WardZero</b><small>Smart Home Hospital</small></div>
        </div>
        <div>
          <h1>First time? Create your account.</h1>
          <p>Enter your name, email, and password once. Then log in with that same email and password. An admin verifies the account and assigns Admin, Doctor, Nurse, or Caregiver.</p>
        </div>
        <p className="hero-note">An admin assigns the role after the account is created.</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="card-brand"><BrandLogo size={36} /><span>WardZero</span><ThemeToggle /></div>
          <h2>Create account</h2>
          <p className="lede">This step is only for a new email. After signup you return to login and use the same password.</p>
          {error ? <div className="error">{error}</div> : null}
          <label className="field">Full name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
          <label className="field">Email address<input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" required /></label>
          <label className="field">Phone number<input value={form.phone} onChange={(e) => set("phone", e.target.value)} type="tel" placeholder="+91 98400 00000" required /></label>
          <label className="field">Password<input value={form.password} onChange={(e) => set("password", e.target.value)} type="password" minLength={6} required /></label>
          <label className="field">Confirm password<input value={form.confirm} onChange={(e) => set("confirm", e.target.value)} type="password" minLength={6} required /></label>
          <label className="field">Department
            <select value={form.department} onChange={(e) => set("department", e.target.value)}>
              {DEPARTMENTS.map((item) => <option key={item || "none"} value={item}>{item || "Optional"}</option>)}
            </select>
          </label>
          <button className="btn primary wide" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
          <p className="lede" style={{ margin: "16px 0 0" }}>Already registered? <Link to="/">Login</Link>. Do not create the account again.</p>
        </form>
      </section>
    </div>
  );
}
