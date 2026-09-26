import { Link } from "react-router-dom";
import { useWard } from "../context/WardContext";

const FIELDS = [
  ["criticalAlerts", "Critical patient alerts", "Notify when deterioration risk becomes high."],
  ["equipmentWarnings", "Equipment warnings", "Notify when battery or connectivity is low."],
  ["dailySummary", "Daily summary", "Morning ward summary for this demo."],
  ["safetyNotice", "Clinical safety notice", "Keep the decision-support disclaimer visible."],
  ["auditLogging", "Audit logging", "Store caregiver actions in the PostgreSQL audit log."],
];

export default function Settings() {
  const { state, apply, logout } = useWard();
  return (
    <div>
      <div className="page-head">
        <div><h2>Settings</h2><p>Users, roles, notification preferences, and the risk thresholds for this ward.</p></div>
        <div className="actions">
          <Link className="btn ghost" to="/app/users">Users and roles</Link>
          <Link className="btn ghost" to="/app/audit">Audit logs</Link>
        </div>
      </div>
      <section className="card pad">
        {FIELDS.map(([key, title, copy]) => (
          <div className="setting" key={key}>
            <div><strong>{title}</strong><div className="muted">{copy}</div></div>
            <button className={`toggle ${state.settings[key] ? "on" : ""}`} onClick={() => apply("/settings", { [key]: !state.settings[key] })} aria-label={title}><i /></button>
          </div>
        ))}
        <div className="setting"><div><strong>Clinical record</strong><div className="muted">Vitals, alerts, devices, power, the offline queue, and the audit log are stored in PostgreSQL.</div></div><b style={{ color: "var(--success)" }}>Saved</b></div>
        <h3 style={{ marginTop: 18 }}>Thresholds</h3>
        <p className="muted">SpO₂ under 94 adds watch points, and under 90 adds the high band. Heart rate at 100 or above adds points. Temperature at 37.6°C or above adds points. These rules are not a validated clinical model.</p>
      </section>
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={logout}>Sign out</button>
    </div>
  );
}
