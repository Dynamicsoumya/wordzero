import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useWard } from "../context/WardContext";
import { can } from "../access";
import { formatTime, vitalLabel } from "../format";
import TrendChart from "../components/TrendChart";

export default function PatientProfile() {
  const { id } = useParams();
  const { state, user, apply, flash } = useWard();
  const [range, setRange] = useState("24H");
  const [obs, setObs] = useState(null);
  const patient = state.patients.find((item) => item.id === id);
  if (!patient) return <p>Patient not found.</p>;
  const caregiver = state.caregivers.find((item) => item.id === patient.caregiverId);
  const checks = ["checkin", "medication", "interaction"].map((kind) => caregiver?.timeline.some((event) => event.kind === kind));
  const observation = obs || { hr: patient.vitals.hr, spo2: patient.vitals.spo2, temp: patient.vitals.temp, systolic: patient.vitals.systolic, diastolic: patient.vitals.diastolic };

  async function saveObservation(event) {
    event.preventDefault();
    await apply(`/patients/${patient.id}/vitals`, { ...observation, source: "observation" });
    flash("Observation updated");
  }
  return (
    <div className="stack">
      <Link to="/app/patients">← Back to Patients</Link>
      <div className="page-head">
        <div>
          <h2>{patient.name}</h2>
          <p>{patient.age} years · Room {patient.room}</p>
        </div>
        <span className="pill low">Currently monitored</span>
      </div>
      <div className="card pad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div><b>{patient.vitals.hr} BPM</b><div className="muted">{vitalLabel("hr", patient.vitals)}</div></div>
        <div><b>{patient.vitals.spo2}%</b><div className="muted">{vitalLabel("spo2", patient.vitals)}</div></div>
        <div><b>{Number(patient.vitals.temp).toFixed(1)}°C</b><div className="muted">{vitalLabel("temp", patient.vitals)}</div></div>
      </div>
      <section className="card">
        <div className="card-title">Health trend</div>
        <div className="switcher">{["1H", "6H", "24H", "7D"].map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>
        <TrendChart history={patient.history} metric="hr" range={range} />
      </section>
      {can(user, "insights") ? (
      <section className="card pad">
        <h3>AI assessment</h3>
        <p style={{ margin: "8px 0" }}><span className={`pill ${patient.risk.level}`}>{patient.risk.level} risk · {patient.risk.score}%</span></p>
        <p>{patient.risk.recommendation}</p>
        <p className="disclaimer" style={{ marginTop: 10 }}>{patient.risk.disclaimer}</p>
        <Link to={`/app/ai/${patient.id}`}>View AI explanation</Link>
      </section>
      ) : (
      <section className="card pad">
        <h3>Status</h3>
        <p style={{ marginTop: 8 }}><span className={`pill ${patient.risk.level}`}>{patient.risk.status}</span></p>
      </section>
      )}
      {can(user, "observations") ? (
      <form className="card pad" onSubmit={saveObservation}>
        <h3>Update observation</h3>
        <div className="two" style={{ marginTop: 12 }}>
          {["hr", "spo2", "temp", "systolic", "diastolic"].map((key) => (
            <label className="field" key={key}>{key}<input value={observation[key]} onChange={(e) => setObs({ ...observation, [key]: e.target.value })} required /></label>
          ))}
        </div>
        <button className="btn primary" type="submit">Save observation</button>
      </form>
      ) : null}
      <section className="card pad">
        <h3>Medical history</h3>
        <p style={{ marginTop: 8 }}>{patient.condition}</p>
        <p className="muted" style={{ marginTop: 8 }}>{patient.historyNote || "No extra history note is recorded."}</p>
      </section>
      <section className="card pad">
        <h3>Emergency contact</h3>
        {patient.emergencyContact ? (
          <p style={{ marginTop: 8 }}><b>{patient.emergencyContact.name}</b> · {patient.emergencyContact.relation}<br />{patient.emergencyContact.phone}</p>
        ) : <p className="muted" style={{ marginTop: 8 }}>No emergency contact is recorded.</p>}
      </section>
      <section className="card pad">
        <h3>Caregiver</h3>
        <p style={{ margin: "8px 0" }}><b>{caregiver?.name || "Unassigned"}</b> · checked in {caregiver ? formatTime(caregiver.checkIn) : "—"}</p>
        <p>✓ Presence {checks[0] ? "verified" : "pending"}</p>
        <p>✓ Medication {checks[1] ? "checked" : "pending"}</p>
        <p>✓ Patient interaction {checks[2] ? "recorded" : "pending"}</p>
      </section>
    </div>
  );
}
