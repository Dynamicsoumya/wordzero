import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useWard } from "../context/WardContext";

export default function Reports() {
  const { state } = useWard();
  const counts = {
    stable: state.patients.filter((item) => item.risk.level === "low").length,
    watch: state.patients.filter((item) => item.risk.level === "medium").length,
    critical: state.patients.filter((item) => item.risk.level === "high").length,
  };
  const sample = [
    { day: "Mon", alerts: 5 },
    { day: "Tue", alerts: 3 },
    { day: "Wed", alerts: 7 },
    { day: "Thu", alerts: 2 },
    { day: "Fri", alerts: 4 },
  ];
  function download() {
    const blob = new Blob([JSON.stringify({ disclaimer: state.disclaimer, patients: state.patients.map((p) => ({ name: p.name, risk: p.risk })), alerts: state.alerts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "wardzero-demo-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>Reports & History</h2><p>Live counts come from this ward. Vital risk and previous alerts are included in the export.</p></div>
        <button className="btn ghost" onClick={download}>Export JSON</button>
      </div>
      <div className="metric-grid">
        <article className="card metric"><div className="muted">Patients monitored</div><b>{state.patients.length}</b></article>
        <article className="card metric"><div className="muted">Stable</div><b>{counts.stable}</b></article>
        <article className="card metric"><div className="muted">Under observation</div><b>{counts.watch}</b></article>
        <article className="card metric"><div className="muted">Critical</div><b>{counts.critical}</b></article>
      </div>
      <div className="two">
        <section className="card pad">
          <h3>Alerts this week</h3>
          <p className="muted">Sample chart for the layout. Not a measured outcome.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sample}><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="alerts" fill="#2563eb" radius={8} /></BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card pad">
          <h3>AI predictions</h3>
          <p>Early warnings in this session: {state.alerts.filter((item) => item.severity === "critical").length}</p>
          <p>Acknowledged: {state.alerts.filter((item) => item.acknowledged).length}</p>
          <p className="disclaimer" style={{ marginTop: 12 }}>No accuracy, precision, or recall is shown. The score is an explainable heuristic, not a validated classifier.</p>
        </section>
      </div>
    </div>
  );
}
