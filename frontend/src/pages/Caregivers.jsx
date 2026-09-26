import { Link } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { formatTime } from "../format";

export default function Caregivers() {
  const { state, flash } = useWard();
  return (
    <div>
      <div className="page-head">
        <div><h2>Caregiver Management</h2><p>Profiles, assigned patients, and who is available now.</p></div>
        <button className="btn primary" onClick={() => flash("Invites are not sent in this demo.")}>+ Invite caregiver</button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Caregiver</th><th>Patients</th><th>Check-in</th><th>Last activity</th><th>Presence</th><th></th></tr></thead>
          <tbody>
            {state.caregivers.map((person) => (
              <tr key={person.id}>
                <td><b>{person.name}</b><div className="muted">{person.role}</div></td>
                <td>{person.patients.join(", ") || "—"}</td>
                <td>{formatTime(person.checkIn)}</td>
                <td>{formatTime(person.lastActivity)}</td>
                <td><span className={`pill ${person.presence === "present" ? "low" : "medium"}`}>{person.presence}</span></td>
                <td><Link className="btn ghost" to={`/app/caregivers/${person.id}`}>Timeline</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
