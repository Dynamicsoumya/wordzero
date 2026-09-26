import { useWard } from "../context/WardContext";

export default function Medications() {
  const { state, apply, flash } = useWard();
  const rows = state.medications || [];
  return (
    <div>
      <div className="page-head">
        <div><h2>Medication & Reminders</h2><p>Simulated home schedules. Marking a dose does not prescribe or dispense medicine.</p></div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Patient</th><th>Medicine</th><th>Dose</th><th>Time</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((item) => {
              const patient = state.patients.find((person) => person.id === item.patientId);
              return (
                <tr key={item.id}>
                  <td>{patient?.name || item.patientId}</td>
                  <td><b>{item.name}</b></td>
                  <td>{item.dose}</td>
                  <td>{item.time}</td>
                  <td><span className={`pill ${item.status === "taken" ? "low" : item.status === "missed" ? "high" : "medium"}`}>{item.status}</span></td>
                  <td className="actions">
                    <button className="btn ghost" onClick={() => apply(`/medications/${item.id}`, { status: "taken" }).then(() => flash(`${item.name} marked taken.`))}>Taken</button>
                    <button className="btn ghost" onClick={() => apply(`/medications/${item.id}`, { status: "missed" }).then(() => flash(`${item.name} marked missed.`))}>Missed</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
