import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { greeting } from "../format";

export default function PatientHome() {
  const { state, user, apply, flash, logout } = useWard();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  if (!state) return <p className="pad">Connecting…</p>;
  const patient = state.patients.find((item) => item.id === user.patientId) || state.patients[0];
  const caregiver = state.caregivers.find((item) => item.id === patient.caregiverId);
  const good = patient.risk.level === "low";
  return (
    <div className="patient-home">
      <div className="simple-wrap stack">
        <div className="row-between"><div><h2>{greeting(user?.guest ? user.name : patient.name)} 👋</h2><p className="muted">{user?.guest ? `Guest patient · record for ${patient.name}` : "Your health today"}</p></div><button className="btn ghost" onClick={() => { logout(); navigate("/"); }}>Sign out</button></div>
        <section className="card look">
          <div className={`pill ${patient.risk.level}`}>{good ? "Looking good" : "Your caregiver is watching"}</div>
          <div className="trio" style={{ marginTop: 18 }}>
            <div><b>{patient.vitals.hr}</b><div className="muted">BPM</div></div>
            <div><b>{patient.vitals.spo2}%</b><div className="muted">SpO₂</div></div>
            <div><b>{Number(patient.vitals.temp).toFixed(1)}°C</b><div className="muted">Temperature</div></div>
          </div>
        </section>
        <section className="card pad">
          <h3>Your caregiver</h3>
          <p>{caregiver.name} · {caregiver.presence === "present" ? "Available" : "Away"}</p>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => flash(`A message was left for ${caregiver.name}. No real call was placed.`)}>Contact caregiver</button>
        </section>
        <button className="help-btn" disabled={sent} onClick={() => apply(`/patients/${patient.id}/help`).then(() => { setSent(true); flash("Help request sent to your caregiver."); })}>
          {sent ? "Help request sent" : "I Need Help"}
        </button>
        <p className="disclaimer">If this were an emergency outside the demo, call local emergency services.</p>
      </div>
    </div>
  );
}
