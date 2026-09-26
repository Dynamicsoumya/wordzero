import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, Lock, UserPlus } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import { useWard } from "../context/WardContext";
import { CLINICAL_ROLES } from "../access";

const ACCOUNTS = [
  ["Admin", "admin@wardzero.care", "admin123"],
  ["Doctor", "doctor@wardzero.care", "doctor123"],
  ["Nurse", "nurse@wardzero.care", "nurse123"],
  ["Caregiver", "amit@wardzero.care", "care123"],
];

function destination(user) {
  if (!user) return null;
  if (user.role === "pending" || user.status === "pending") return "/pending";
  if (CLINICAL_ROLES.includes(user.role)) return "/app";
  return null;
}

export default function Login() {
  const { login, user, authReady } = useWard();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notice] = useState(location.state?.notice || "");
  const [error, setError] = useState("");
  const next = destination(user);
  if (!authReady) return null;
  if (next) return <Navigate to={next} replace />;

  async function submit(event) {
    event.preventDefault();
    try {
      const signedIn = await login(email, password, remember);
      navigate(destination(signedIn) || "/");
    } catch (err) {
      setError(err.message);
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
          <p className="eyebrow">Care that stays close</p>
          <h1>A hospital's intelligence, right inside the patient's home.</h1>
          <ul className="checks">
            {["Real-time monitoring", "Early warning from recent vitals", "Caregiver coordination", "Offline resilience"].map((item) => (
              <li key={item}><Check size={18} /> {item}</li>
            ))}
          </ul>
          <div className="hero-float">
            <div><span>Heart rate</span><b>82</b><small>BPM</small></div>
            <div><span>SpO₂</span><b>97</b><small>%</small></div>
            <div><span>Risk</span><b>Low</b><small>Stable</small></div>
          </div>
        </div>
        <p className="hero-note">Decision support for the home ward. A clinician still makes the call.</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="card-brand"><BrandLogo size={36} /><span>WardZero</span><ThemeToggle /></div>
          <h2>Welcome back</h2>
          <p className="lede">Sign in with the email and password from your account.</p>
          {notice ? <div className="notice">{notice}</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@email.com" required /></label>
          <label className="field">Password
            <span className="password-field">
              <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Your password" required />
              <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <div className="row-between">
            <label className="check-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
            <button type="button" className="linkish" onClick={() => navigate("/forgot")}>Forgot password?</button>
          </div>
          <button className="btn primary wide" style={{ marginTop: 16 }} type="submit">Login</button>
          <div className="secure"><Lock size={16} /> Your patient data is protected</div>
          <Link className="create-cta" to="/signup">
            <span className="create-cta-icon"><UserPlus size={18} /></span>
            <span>
              <small>First time on WardZero?</small>
              <strong>Create an account</strong>
            </span>
          </Link>
          <details className="demo-fold">
            <summary>Use a demo account</summary>
            <div className="demo-accounts">
              {ACCOUNTS.map(([label, mail, pass]) => (
                <button type="button" key={label} onClick={() => { setEmail(mail); setPassword(pass); }}>
                  {label}<small>{mail}</small>
                </button>
              ))}
            </div>
          </details>
        </form>
      </section>
    </div>
  );
}
