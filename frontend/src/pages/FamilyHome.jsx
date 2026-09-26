import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { ago, formatTime } from "../format";

export default function FamilyHome() {
  const { state, user, logout } = useWard();
  const navigate = useNavigate();
  const [details, setDetails] = useState(false);
  if (!state) return <p className="pad">Connecting…</p>;
  const patient = state.patients.find((item) => item.id === user.patientId) || state.patients[0];
  const caregiver = state.caregivers.find((item) => item.id === patient.caregiverId);
  const stable = patient.risk.level !== "high";
  return (
    <div className="family">
      <div className="simple-wrap stack">
        <div className="row-between"><div><b>{user?.name || "WardZero"}</b><div className="muted">{user?.guest ? "Guest family" : "My family"}</div></div><button className="btn ghost" onClick={() => { logout(); navigate("/"); }}>Sign out</button></div>
        <section className="card pad">
          <h2>{patient.name}</h2>
          <p><span className={`pill ${patient.risk.level}`}>{stable ? "Stable" : "Needs attention"}</span></p>
          <p className="muted">Last updated {ago(state.generatedAt)}</p>
          <div className="trio" style={{ marginTop: 16 }}>
            <div><b>{patient.vitals.hr}</b><div className="muted">BPM</div></div>
            <div><b>{patient.vitals.spo2}%</b><div className="muted">SpO₂</div></div>
            <div><b>{Number(patient.vitals.temp).toFixed(1)}°C</b><div className="muted">Temperature</div></div>
          </div>
          <p style={{ marginTop: 12 }}>Caregiver {caregiver.name} · {caregiver.presence}</p>
        </section>
        <section className="card pad">
          <h3>Today's summary</h3>
          <p>✓ Vitals {stable ? "in the watched range" : "need a caregiver"}</p>
          <p>✓ Medication recorded at {formatTime(caregiver.timeline.find((event) => event.kind === "medication")?.at || caregiver.checkIn)}</p>
          <p>✓ Caregiver checked in</p>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setDetails((value) => !value)}>{details ? "Hide details" : "View details"}</button>
          {details ? <p className="disclaimer" style={{ marginTop: 10 }}>{patient.risk.recommendation} {patient.risk.disclaimer}</p> : null}
        </section>
      </div>
    </div>
  );
}
