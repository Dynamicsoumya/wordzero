import { Link, useParams } from "react-router-dom";
import { useWard } from "../context/WardContext";
import { formatTime } from "../format";

export default function CaregiverActivity() {
  const { id } = useParams();
  const { state } = useWard();
  const person = state.caregivers.find((item) => item.id === id);
  if (!person) return <p>Caregiver not found.</p>;
  const find = (kind) => person.timeline.findLast?.((event) => event.kind === kind) || [...person.timeline].reverse().find((event) => event.kind === kind);
  return (
    <div className="stack">
      <Link to="/app/caregivers">← Caregivers</Link>
      <div className="page-head">
        <div><h2>Caregiver activity</h2><p>{person.name}</p></div>
        <span className={`pill ${person.presence === "present" ? "low" : "medium"}`}>{person.presence}</span>
      </div>
      <section className="card pad">
        {[["Check-in", person.checkIn], ["Last activity", person.lastActivity], ["Patient interaction", find("interaction")?.at], ["Equipment check", find("equipment")?.at], ["Medication check", find("medication")?.at]].map(([label, ts]) => (
          <div className="home-row" key={label}><span>{label}</span><b>{ts ? formatTime(ts) : "—"}</b></div>
        ))}
      </section>
      <section className="card pad">
        <h3>Timeline</h3>
        {[...person.timeline].reverse().map((event) => (
          <div className="timeline-item" key={event.id}><span>{event.label}</span><span className="muted">{formatTime(event.at)}</span></div>
        ))}
      </section>
    </div>
  );
}
