import { Link, useParams } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { can } from "../access";
import { formatTime } from "../format";
import { dialDoctor, textDoctor } from "../push";

export default function AlertDetail() {
  const { id } = useParams();
  const { state, user, apply, flash } = useWard();
  const alert = state.alerts.find((item) => item.id === id);
  if (!alert) return <p>Alert not found.</p>;
  const patient = state.patients.find((item) => item.id === alert.patientId);
  const caregiver = state.caregivers.find((item) => item.id === patient?.caregiverId);
  return (
    <div className="stack">
      <Link to="/app/alerts">← Alert Center</Link>
      <section className="card pad">
        <span className={`pill ${alert.severity === "critical" ? "high" : "medium"}`}>{alert.severity}</span>
        <h2 style={{ marginTop: 8 }}>Patient requires attention</h2>
        <p>{patient?.name}</p>
        <div className="trio" style={{ marginTop: 16 }}>
          <div className="card pad"><div className="muted">SpO₂</div><b>{alert.vitals?.spo2 || patient?.vitals.spo2}%</b></div>
          <div className="card pad"><div className="muted">Heart rate</div><b>{alert.vitals?.hr || patient?.vitals.hr} BPM</b></div>
          <div className="card pad"><div className="muted">AI risk</div><b>{alert.score || patient?.risk.score}%</b></div>
        </div>
        <p style={{ margin: "14px 0" }}>Detected {formatTime(alert.at)}</p>
        <h3>Reason</h3>
        <ul>{(alert.reasons || []).map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <p>Caregiver · {caregiver?.name}</p>
        <p className="disclaimer" style={{ margin: "12px 0" }}>This alert supports a caregiver decision. It is not an autonomous diagnosis.</p>
        <div className="actions">
          {!alert.acknowledged && can(user, "acknowledge") ? <button className="btn success" onClick={() => apply(`/alerts/${alert.id}/acknowledge`).then(() => flash("Alert acknowledged"))}>Acknowledge</button> : alert.acknowledged ? <span className="pill low">Acknowledged</span> : <span className="pill medium">View only</span>}
          {can(user, "acknowledge") && patient ? <button className="btn ghost" onClick={() => apply(`/patients/${patient.id}/doctor`).then((result) => { dialDoctor(result.call); flash(result.call?.detail || "Calling the assigned doctor."); })}>Call doctor</button> : null}
          {can(user, "acknowledge") && patient ? <button className="btn ghost" onClick={() => apply(`/patients/${patient.id}/doctor`).then((result) => { textDoctor(result.call); flash(result.call?.smsStatus === "sent" ? "SMS sent to the assigned doctor." : "Your phone will text the assigned doctor."); })}>Text doctor</button> : null}
        </div>
      </section>
    </div>
  );
}
