import { useWard } from "../context/WardContext";
import { ago, formatTime, respiratoryRate } from "../format";

export default function LiveMonitor() {
  const { state, user } = useWard();
  const limited = user?.role === "caregiver";
  return (
    <div>
      <div className="page-head">
        <div><h2>Live Monitoring</h2><p>{limited ? "Current readings for the patient shared with you." : "Heart rate, SpO₂, temperature, blood pressure, and an estimated respiratory rate."}</p></div>
        <span className="pill low">Live · {ago(state.generatedAt)}</span>
      </div>
      <div className="equip-grid">
        {state.patients.flatMap((patient) => [
          ["Heart rate", `${patient.vitals.hr} BPM`, patient],
          ["SpO₂", `${patient.vitals.spo2}%`, patient],
          ["Temperature", `${Number(patient.vitals.temp).toFixed(1)}°C`, patient],
          ["Blood pressure", `${patient.vitals.systolic} / ${patient.vitals.diastolic}`, patient],
          ["Respiratory rate", `${respiratoryRate(patient.vitals)} /min`, patient],
        ]).map(([label, value, patient]) => (
          <article key={`${patient.id}-${label}`} className="card pad">
            <h3>{patient.name}</h3>
            <p className="muted">{label} · Room {patient.room}</p>
            <div className="vital-value">{value}</div>
            <span className={`pill ${patient.risk.level}`}>{patient.risk.status}</span>
          </article>
        ))}
      </div>
      {limited ? null : (
      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Telemetry stream</div>
        <table>
          <thead><tr><th>Time</th><th>Patient</th><th>Heart</th><th>SpO₂</th><th>Temp</th><th>Source</th></tr></thead>
          <tbody>
            {state.readings.slice(0, 8).map((reading) => {
              const patient = state.patients.find((item) => item.id === reading.patientId);
              return (
                <tr key={reading.id}>
                  <td>{formatTime(reading.at)}</td>
                  <td>{patient?.name || reading.patientId}</td>
                  <td>{reading.hr}</td>
                  <td>{reading.spo2}%</td>
                  <td>{Number(reading.temp).toFixed(1)}</td>
                  <td>{reading.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      )}
    </div>
  );
}
