import { useState } from "react";
import { Link } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { can } from "../access";

export default function Patients() {
  const { state, user, apply, flash } = useWard();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", age: "", room: "", caregiverId: "amit" });
  const rows = state.patients.filter((patient) => {
    const text = `${patient.name} ${patient.room}`.toLowerCase().includes(query.toLowerCase());
    const status = filter === "All" || patient.risk.status === filter || (filter === "Critical" && patient.risk.status === "Alert");
    return text && status;
  });

  async function add(event) {
    event.preventDefault();
    await apply("/patients", form);
    setOpen(false);
    flash("Patient added to the simulated ward");
  }

  return (
    <div>
      <div className="page-head">
        <div><h2>Patients</h2><p>{user?.role === "admin" ? "Every home-monitoring record." : user?.role === "caregiver" ? "Only the record shared with you." : "Patients assigned to you."}</p></div>
        <div className="page-actions">
          <input className="search" placeholder="Search patients" value={query} onChange={(e) => setQuery(e.target.value)} />
          {can(user, "addPatient") ? <button className="btn primary" onClick={() => setOpen(true)}>+ Add Patient</button> : null}
        </div>
      </div>
      <div className="filters">
        {["All", "Stable", "Watch", "Critical"].map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Patient</th><th>SpO₂</th><th>Heart Rate</th><th>Risk</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((patient) => (
              <tr key={patient.id}>
                <td><b>{patient.name}</b><div className="muted">{patient.age} years · Room {patient.room}</div></td>
                <td>{patient.vitals.spo2}%</td>
                <td>{patient.vitals.hr}</td>
                <td><span className={`pill ${patient.risk.level}`}>{patient.risk.level} {patient.risk.score}%</span></td>
                <td>{patient.risk.status}</td>
                <td><Link className="btn ghost" to={`/app/patients/${patient.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={add}>
            <h3>Add patient</h3>
            <label className="field">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="field">Age<input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} required /></label>
            <label className="field">Room<input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} required /></label>
            <label className="field">Caregiver
              <select value={form.caregiverId} onChange={(e) => setForm({ ...form, caregiverId: e.target.value })}>
                {state.caregivers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <button className="btn primary" type="submit">Save</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
