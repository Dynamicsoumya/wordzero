import { Droplets, Heart, Thermometer, Wind } from "lucide-react";
import { vitalLabel } from "../format";

const META = {
  hr: ["Heart Rate", Heart, "BPM", "#fee2e2", "#dc2626"],
  spo2: ["SpO₂", Wind, "%", "#e0f2fe", "#0284c7"],
  temp: ["Temperature", Thermometer, "°C", "#ede9fe", "#7c3aed"],
  bp: ["Blood Pressure", Droplets, "", "#fce7f3", "#db2777"],
};

export function Spark({ points }) {
  const tail = (points || []).slice(-24);
  if (!tail.length) return null;
  const values = tail.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = tail.map((point, index) => {
    const x = (index / Math.max(1, tail.length - 1)) * 120;
    const y = 28 - ((point.v - min) / Math.max(0.1, max - min)) * 24;
    return `${index === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");
  return <svg className="spark" viewBox="0 0 120 32"><path d={d} fill="none" stroke="#2563eb" strokeWidth="2" /></svg>;
}

export function VitalGrid({ patient }) {
  const v = patient.vitals;
  const cards = [
    ["hr", v.hr, patient.history.hr],
    ["spo2", v.spo2, patient.history.spo2],
    ["temp", Number(v.temp).toFixed(1), patient.history.temp],
    ["bp", `${v.systolic} / ${v.diastolic}`, patient.history.bp],
  ];
  return (
    <div className="vital-grid">
      {cards.map(([key, value, history]) => {
        const [label, Icon, unit, bg, color] = META[key];
        const tone = vitalLabel(key, v);
        return (
          <article key={key} className="card vital-card">
            <div className="vital-top">
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: bg, color }}><Icon size={16} /></span>
                {label}
              </span>
            </div>
            <div className="vital-value">{value} <span>{unit}</span></div>
            <Spark points={history} />
            <span className={`pill ${tone === "Normal" ? "low" : tone === "Watch" ? "medium" : "high"}`}>{tone}</span>
          </article>
        );
      })}
    </div>
  );
}

export function WardStatus({ state, patient }) {
  const anyHigh = state.patients.some((item) => item.risk.level === "high");
  const anyWatch = state.patients.some((item) => item.risk.level === "medium");
  const battery = state.equipment.some((item) => item.status === "battery");
  const rows = [
    ["Patient", patient?.risk.status || "Stable", patient?.risk.level || "low"],
    ["Caregiver", state.caregivers.find((item) => item.id === patient?.caregiverId)?.presence === "present" ? "Present" : "Away", "low"],
    ["Equipment", battery ? "Needs check" : "Healthy", battery ? "medium" : "low"],
    ["Internet", state.internet ? "Connected" : "Offline", state.internet ? "low" : "medium"],
    ["Power", state.power.mode === "mains" ? "Normal" : "Backup", state.power.mode === "mains" ? "low" : "medium"],
    ["AI Monitoring", "Active", "low"],
  ];
  const overall = anyHigh ? "critical" : anyWatch || battery || !state.internet || state.power.mode === "backup" ? "attention" : "healthy";
  const label = overall === "healthy" ? "HEALTHY" : overall === "attention" ? "ATTENTION" : "CRITICAL";
  return (
    <div className="pad">
      {rows.map(([name, value, tone]) => (
        <div className="home-row" key={name}><span>{name}</span><b style={{ color: tone === "high" ? "var(--critical)" : tone === "medium" ? "var(--warn-ink)" : "var(--success)" }}>{value}</b></div>
      ))}
      <div className={`ward-total ${overall}`}>Overall Ward Status · {label}</div>
    </div>
  );
}
