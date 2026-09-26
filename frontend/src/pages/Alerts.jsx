import { Link } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { can } from "../access";
import { ago } from "../format";

export default function Alerts() {
  const { state, user, apply, flash } = useWard();
  const groups = [
    ["critical", "Critical"],
    ["warning", "Warning"],
    ["info", "Information"],
  ];
  return (
    <div>
      <div className="page-head">
        <div><h2>Alerts & Emergencies</h2><p>{user?.role === "caregiver" ? "Alerts shared for your patient. Acknowledgement stays with the care team." : "Critical alerts, acknowledgement, and whether each one is still open."}</p></div>
      </div>
      <div className="filters">
        {groups.map(([id, label]) => <span key={id} className={`pill ${id === "critical" ? "high" : id === "warning" ? "medium" : "low"}`}>{label}</span>)}
      </div>
      <div className="stack">
        {state.alerts.map((alert) => (
          <article key={alert.id} className="card pad" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <span className={`pill ${alert.severity === "critical" ? "high" : alert.severity === "warning" ? "medium" : "low"}`}>{alert.severity}</span>
              <h3 style={{ marginTop: 8 }}>{alert.title}</h3>
              <p className="muted">{alert.body}</p>
              <p className="muted">{ago(alert.at)} · {alert.acknowledged ? "Acknowledged" : "Open"}</p>
            </div>
            <div className="actions">
              <Link className="btn ghost" to={`/app/alerts/${alert.id}`}>View</Link>
              {!alert.acknowledged && can(user, "acknowledge") ? <button className="btn danger" onClick={() => apply(`/alerts/${alert.id}/acknowledge`).then(() => flash("Alert acknowledged"))}>Acknowledge</button> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
