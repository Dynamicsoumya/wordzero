import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Check, KeyRound, Lock, ShieldCheck } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import { useWard } from "../context/WardContext";
import { api } from "../api";
import { CLINICAL_ROLES } from "../access";

export default function Forgot() {
  const { user } = useWard();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && (user.role === "pending" || user.status === "pending")) return <Navigate to="/pending" replace />;
  if (user && CLINICAL_ROLES.includes(user.role)) return <Navigate to="/app" replace />;

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/forgot", { method: "POST", body: { email } });
      setEmail(result.email);
      setCode(result.code);
      setStep("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset", { method: "POST", body: { email, code, password } });
      setStep("done");
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
          <p className="eyebrow">Account recovery</p>
          <h1>Back into the ward in a minute.</h1>
          <ul className="checks">
            {["Use the email on your account", "A one-time code, valid for 15 minutes", "Choose a new password and sign in"].map((item) => (
              <li key={item}><Check size={18} /> {item}</li>
            ))}
          </ul>
        </div>
        <p className="hero-note">The code stays on this screen. Mail is not connected on this ward yet.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="card-brand"><BrandLogo size={36} /><span>WardZero</span><ThemeToggle /></div>
          <div className="reset-steps" aria-hidden="true">
            <span className={step === "email" ? "on" : "done"}>1</span>
            <i />
            <span className={step === "reset" ? "on" : step === "done" ? "done" : ""}>2</span>
            <i />
            <span className={step === "done" ? "on" : ""}>3</span>
          </div>

          {step === "email" ? (
            <form onSubmit={requestCode}>
              <h2>Forgot password</h2>
              <p className="lede">Enter the email on your WardZero account. We will show a one-time code so you can set a new password.</p>
              {error ? <div className="error">{error}</div> : null}
              <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label>
              <button className="btn primary wide" type="submit" disabled={busy}>{busy ? "Checking…" : "Send reset code"}</button>
            </form>
          ) : null}

          {step === "reset" ? (
            <form onSubmit={savePassword}>
              <h2>Set a new password</h2>
              <p className="lede">This code is for {email}. It expires in 15 minutes and works once.</p>
              {error ? <div className="error">{error}</div> : null}
              <div className="reset-code" aria-label={`Reset code ${code}`}>
                {code.split("").map((digit, index) => <span key={`${digit}-${index}`}>{digit}</span>)}
              </div>
              <p className="reset-hint"><KeyRound size={15} /> Keep this code on this screen. It is already applied.</p>
              <label className="field">New password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={6} required /></label>
              <label className="field">Confirm password<input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={6} required /></label>
              <button className="btn primary wide" type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
              <button type="button" className="linkish reset-back" onClick={() => { setStep("email"); setError(""); setPassword(""); setConfirm(""); }}>Use a different email</button>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="reset-done">
              <span className="reset-done-icon"><ShieldCheck size={28} /></span>
              <h2>Password updated</h2>
              <p className="lede">You can sign in with the new password. The old one no longer works.</p>
              <Link className="btn primary wide" to="/">Back to login</Link>
            </div>
          ) : null}

          {step !== "done" ? (
            <div className="secure"><Lock size={16} /> The code is stored hashed and expires on its own</div>
          ) : null}
          {step === "email" ? <Link className="reset-login" to="/">Back to login</Link> : null}
        </div>
      </section>
    </div>
  );
}
