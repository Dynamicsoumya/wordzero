import { Link, useParams } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { dialDoctor, textDoctor } from "../push";

function tail(points, digits = 0) {
  return points.slice(-3).map((point) => Number(point.v).toFixed(digits)).join(" → ");
}

export default function AIExplanation() {
  const { id } = useParams();
  const { state, apply, flash } = useWard();
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) return <p>Patient not found.</p>;
  const alert = state.alerts.find((item) => item.patientId === patient.id && item.severity === "critical" && !item.acknowledged);
  const steps = [
    ["SpO₂ trend", `${tail(patient.history.spo2)}%`, patient.risk.factors[0].narrative],
    ["Heart rate", `${tail(patient.history.hr)} BPM`, patient.risk.factors[1].narrative],
    ["Temperature", `${tail(patient.history.temp, 1)}°C`, patient.risk.factors[2].narrative],
    ["Caregiver note", patient.flags.text || "No symptom note yet", patient.flags.weakness || patient.flags.breathing ? "Symptom language detected" : "No concerning note"],
  ];
  return (
    <div className="stack">
      <Link to="/app/ai">← AI Insights</Link>
      <div className="page-head"><div><h2>AI Health Analysis</h2><p>{patient.name}</p></div></div>
      <section className="card pad">
        <p>Risk level</p>
        <h3><span className={`pill ${patient.risk.level}`}>{patient.risk.level}</span> {patient.risk.score}%</h3>
        <p style={{ marginTop: 8 }}>{patient.risk.forecast?.summary || patient.risk.window}</p>
        <h3 style={{ margin: "18px 0 8px" }}>Why the system is concerned</h3>
        <div className="steps">
          {steps.map(([title, detail, note], index) => (
            <div className="step" key={title}>
              <div className="num">{String(index + 1).padStart(2, "0")}</div>
              <div><b>{title}</b><div>{detail}</div><div className="muted">{note}</div></div>
            </div>
          ))}
        </div>
        <div className="disclaimer" style={{ margin: "16px 0" }}>
          {patient.risk.disclaimer}
        </div>
        <div className="actions">
          {alert ? <button className="btn success" onClick={() => apply(`/alerts/${alert.id}/acknowledge`).then(() => flash("Alert acknowledged"))}>Acknowledge alert</button> : null}
          <button className="btn ghost" onClick={() => apply(`/patients/${patient.id}/doctor`).then((result) => { dialDoctor(result.call); flash(result.call?.detail || "Calling the assigned doctor."); })}>Call doctor</button>
          <button className="btn ghost" onClick={() => apply(`/patients/${patient.id}/doctor`).then((result) => { textDoctor(result.call); flash(result.call?.smsStatus === "sent" ? "SMS sent to the assigned doctor." : "Your phone will text the assigned doctor."); })}>Text doctor</button>
        </div>
      </section>
    </div>
  );
}
