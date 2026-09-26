import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { useWard } from "../context/WardContext";
import { can } from "../access";
import { ago, formatTime } from "../format";
import TrendChart from "../components/TrendChart";
import { VitalGrid, WardStatus } from "../components/Vitals";

function OverviewCounts({ state }) {
  const high = state.patients.filter((item) => item.risk.level === "high").length;
  const alerts = state.alerts.filter((item) => !item.acknowledged).length;
  const duty = state.caregivers.filter((item) => item.presence === "present").length;
  return (
    <div className="metric-grid" style={{ marginBottom: 14 }}>
      <article className="card metric"><div className="muted">Total patients</div><b>{state.patients.length}</b></article>
      <article className="card metric"><div className="muted">High-risk patients</div><b>{high}</b></article>
      <article className="card metric"><div className="muted">Active alerts</div><b>{alerts}</b></article>
      <article className="card metric"><div className="muted">Caregivers on duty</div><b>{duty}</b></article>
    </div>
  );
}
const METRICS = [["hr", "Heart Rate"], ["spo2", "SpO₂"], ["temp", "Temp"], ["bp", "BP"]];
const RANGES = ["1H", "6H", "24H", "7D"];

export default function Dashboard() {
  const { state, user, apply, flash } = useWard();
  const [focusId, setFocusId] = useState(state.patients[0]?.id || "");
  const [metric, setMetric] = useState("hr");
  const [range, setRange] = useState("24H");
  const patient = state.patients.find((item) => item.id === focusId) || state.patients[0];
  if (!patient) {
    return <section className="card pad"><h2>No patients assigned</h2><p className="muted">An admin has not shared any patient records with this account.</p></section>;
  }
  const critical = state.patients.find((item) => item.risk.level === "high");
  const alert = state.alerts.find((item) => item.severity === "critical" && !item.acknowledged);
  const caregiver = state.caregivers.find((item) => item.id === patient.caregiverId);

  if (user?.role === "caregiver") {
    const sharedAlert = state.alerts[0];
    return (
      <div className="stack">
        <OverviewCounts state={state} />
        <section className="card pad">
          <h2>Shared with you</h2>
          <p className="muted">This view includes only the patient record an admin shared with your account.</p>
        </section>
        <VitalGrid patient={patient} />
        <section className="card pad">
          <h3>{patient.name}</h3>
          <p>{patient.condition}</p>
          <p style={{ marginTop: 8 }}><span className={`pill ${patient.risk.level}`}>{patient.risk.status}</span></p>
          <p className="muted" style={{ marginTop: 8 }}>Caregiver on record · {caregiver?.name || "Unassigned"}</p>
          {sharedAlert ? <p style={{ marginTop: 12 }}>{sharedAlert.title}</p> : <p className="muted" style={{ marginTop: 12 }}>No alerts on this shared record.</p>}
        </section>
      </div>
    );
  }

  return (
    <div>
      <OverviewCounts state={state} />
      {critical ? (
        <section className="banner critical">
          <div>
            <h3>ATTENTION REQUIRED</h3>
            <p>{critical.name}'s SpO₂ dropped to {critical.vitals.spo2}%. AI detected elevated deterioration risk.</p>
          </div>
          <div className="actions">
            <Link className="btn ghost" to={`/app/patients/${critical.id}`}>View Patient</Link>
            {alert && can(user, "acknowledge") ? <button className="btn danger" onClick={() => apply(`/alerts/${alert.id}/acknowledge`).then(() => flash("Alert acknowledged"))}>Acknowledge</button> : null}
          </div>
        </section>
      ) : (
        <section className="banner ok">
          <span className="banner-mark"><Check size={18} /></span>
          <div>
            <h3>All patients are stable</h3>
            <p>{state.patients.some((item) => item.risk.level === "medium") ? "One patient remains under observation. No immediate attention required." : "No immediate attention required."}</p>
          </div>
        </section>
      )}
      {!state.internet ? (
        <section className="banner warning">
          <div>
            <h3>OFFLINE MODE</h3>
            <p>Connection lost. Patient monitoring continues locally. {state.queue.length} events waiting to sync.</p>
          </div>
          <Link className="btn ghost" to={can(user, "devices") ? "/app/iot" : "/app/monitor"}>View status</Link>
        </section>
      ) : null}
      <section className="focus-card card">
        <div className="avatar">{patient.name?.[0] || "P"}</div>
        <div className="focus-copy">
          <b>{patient.name}</b>
          <p className="muted">{[patient.condition, patient.room].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={`pill ${patient.risk.level}`}>{patient.risk.status}</span>
        <label className="focus-select">Patient
          <select value={patient.id} onChange={(e) => setFocusId(e.target.value)}>
            {state.patients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <span className="muted focus-updated">Updated {ago(state.generatedAt)}</span>
      </section>
      <VitalGrid patient={patient} />
      <div className="dash">
        <div className="stack">
          <section className="card">
            <div className="card-title"><span>{METRICS.find((item) => item[0] === metric)?.[1]} — last {range}</span></div>
            <div className="switcher">
              {METRICS.map(([id, label]) => <button key={id} className={metric === id ? "active" : ""} onClick={() => setMetric(id)}>{label}</button>)}
              <span style={{ flex: 1 }} />
              {RANGES.map((id) => <button key={id} className={range === id ? "active" : ""} onClick={() => setRange(id)}>{id}</button>)}
            </div>
            <TrendChart history={patient.history} metric={metric} range={range} />
          </section>
          <div className="trio">
            <section className="card">
              <div className="card-title">Caregiver activity {caregiver ? <Link to={`/app/caregivers/${caregiver.id}`}>View</Link> : null}</div>
              <div className="pad">
                <b>{caregiver?.name || "Unassigned"}</b>
                <p className="muted">Check-in {caregiver ? formatTime(caregiver.checkIn) : "—"}</p>
                {(caregiver?.timeline || []).slice(-4).map((event) => (
                  <div className="timeline-item" key={event.id}><span>{event.label}</span><span className="muted">{formatTime(event.at)}</span></div>
                ))}
              </div>
            </section>
            <section className="card">
              {can(user, "devices") ? <div className="card-title">Equipment <Link to="/app/equipment">View</Link></div> : <div className="card-title">Equipment</div>}
              <div className="pad">
                {state.equipment.slice(0, 4).map((item) => (
                  <div className="home-row" key={item.id}><span>{item.name}</span><b>{item.status === "battery" ? "Battery low" : "Online"}</b></div>
                ))}
              </div>
            </section>
            <section className="card">
              <div className="card-title">Home Ward Status</div>
              <WardStatus state={state} patient={patient} />
            </section>
          </div>
        </div>
        <div className="stack">
          {can(user, "insights") ? (
          <section className="card pad">
            <div className="card-title" style={{ padding: 0 }}>AI Health Insight <Link to={`/app/ai/${patient.id}`}>View AI Explanation</Link></div>
            <p className="muted" style={{ marginTop: 12 }}>Deterioration risk</p>
            <div className="risk-score">{patient.risk.score}%</div>
            <span className={`pill ${patient.risk.level}`}>{patient.risk.level === "high" ? "HIGH RISK" : patient.risk.level === "medium" ? "MEDIUM RISK" : "LOW RISK"}</span>
            <p style={{ margin: "10px 0" }}>Predicted window<br /><b>{patient.risk.window}</b></p>
            <p className="muted">{patient.risk.forecast?.summary}</p>
            {patient.risk.factors.map((factor) => (
              <div className="factor" key={factor.id}>
                <span>{factor.direction === "down" ? "↓" : factor.direction === "up" ? "↑" : "•"} {factor.label}</span>
                <div className={`bar ${factor.points >= 12 ? "high" : factor.points >= 6 ? "medium" : ""}`}><i style={{ width: `${factor.intensity}%` }} /></div>
              </div>
            ))}
            <p className="disclaimer" style={{ marginTop: 12 }}>{patient.risk.disclaimer}</p>
          </section>
          ) : null}
          <section className="card">
            <div className="card-title">Recent alerts <Link to="/app/alerts">View all</Link></div>
            <div className="pad">
              {state.alerts.slice(0, 3).map((item) => (
                <Link key={item.id} to={`/app/alerts/${item.id}`} className="timeline-item">
                  <span>{item.title}</span><span className="muted">{ago(item.at)}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
