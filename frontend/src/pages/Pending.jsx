import { useNavigate } from "react-router-dom";
import { useWard } from "../context/WardContext";
import ThemeToggle from "../components/ThemeToggle";

export default function Pending() {
  const { user, logout } = useWard();
  const navigate = useNavigate();
  return (
    <div className="login">
      <section className="login-panel" style={{ gridColumn: "1 / -1" }}>
        <section className="login-card">
          <div className="card-brand"><span>WardZero</span><ThemeToggle /></div>
          <h2>Waiting for approval</h2>
          <p className="lede">{user?.name}, your account is a pending user. An admin must verify you and assign Admin, Doctor, Nurse, or Caregiver before a dashboard opens.</p>
          <p><b>{user?.email}</b></p>
          {user?.department ? <p className="muted">Department · {user.department}</p> : null}
          <p className="muted" style={{ marginTop: 12 }}>You do not need to sign up again. After an admin assigns your role, sign out and log in with this same email and password to open your dashboard.</p>
          <button className="btn primary" style={{ marginTop: 18 }} onClick={() => { logout(); navigate("/"); }}>Sign out</button>
        </section>
      </section>
    </div>
  );
}
