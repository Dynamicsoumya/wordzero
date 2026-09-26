import { useWard } from "../context/WardContext";
import { can } from "../access";
import { formatTime } from "../format";

export default function Attendance() {
  const { state, user, apply, flash } = useWard();
  const mine = user?.role === "caregiver" ? state.caregivers.filter((person) => person.id === user.caregiverId) : state.caregivers;
  const rows = mine.length ? mine : state.caregivers;
  return (
    <div>
      <div className="page-head">
        <div><h2>Visit & Attendance</h2><p>Check-in and check-out times for the caregivers on this ward.</p></div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Caregiver</th><th>Patients</th><th>Check-in</th><th>Last activity</th><th>Presence</th><th></th></tr></thead>
          <tbody>
            {rows.map((person) => (
              <tr key={person.id}>
                <td><b>{person.name}</b><div className="muted">{person.role}</div></td>
                <td>{person.patients.join(", ") || "—"}</td>
                <td>{formatTime(person.checkIn)}</td>
                <td>{formatTime(person.lastActivity)}</td>
                <td><span className={`pill ${person.presence === "present" ? "low" : "medium"}`}>{person.presence === "present" ? "On duty" : "Checked out"}</span></td>
                <td>
                  {can(user, "attendance") ? (
                    <button className="btn ghost" onClick={() => apply(`/caregivers/${person.id}/action`, { kind: person.presence === "present" ? "checkout" : "checkin" }).then(() => flash(person.presence === "present" ? "Checked out." : "Checked in."))}>
                      {person.presence === "present" ? "Check out" : "Check in"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
