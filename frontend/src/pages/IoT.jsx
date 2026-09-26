import { useState } from "react";
import { useWard } from "../context/WardContext";
import { ago, formatTime } from "../format";

export default function IoT() {
  const { state, apply, flash } = useWard();
  const [showQueue, setShowQueue] = useState(false);
  const online = state.devices.filter((item) => item.status === "online").length;
  const restored = state.internet && Date.now() - state.restoredAt < 30000 && state.lastSync.total > 0;
  const minutes = state.power.estimatedMinutes;
  return (
    <div className="stack">
      <div className="page-head">
        <div><h2>Device & IoT Simulator</h2><p>{online} sensors are online. The sensor service {state.sensorFeed === false ? "is stopped" : "is streaming readings into PostgreSQL"}.</p></div>
        <div className="actions">
          <button className="btn ghost" onClick={() => apply("/system/feed", { running: state.sensorFeed === false }).then(() => flash(state.sensorFeed === false ? "Sensor simulation started." : "Sensor simulation stopped."))}>{state.sensorFeed === false ? "Start simulation" : "Stop simulation"}</button>
          <button className="btn ghost" onClick={() => apply(state.internet ? "/system/offline-burst" : "/system/internet", state.internet ? {} : { online: true }).then(() => flash(state.internet ? "Link dropped. Events will queue locally." : "Link restored."))}>{state.internet ? "Simulate internet loss" : "Restore connection"}</button>
          <button className="btn ghost" onClick={() => apply("/system/power", { mode: state.power.mode === "mains" ? "backup" : "mains" })}>{state.power.mode === "mains" ? "Simulate power cut" : "Restore mains"}</button>
        </div>
      </div>
      <div className="metric-grid">
        <article className="card metric"><div className="muted">Internet</div><b>{state.internet ? "Connected" : "Offline"}</b></article>
        <article className="card metric"><div className="muted">Last sync</div><b>{state.internet ? ago(state.generatedAt) : "Paused"}</b></article>
        <article className="card metric"><div className="muted">Pending</div><b>{state.queue.length}</b></article>
        <article className="card metric"><div className="muted">Power</div><b>{state.power.mode === "mains" ? "Normal" : "Backup"}</b></article>
      </div>
      {!state.internet ? (
        <section className="banner warning">
          <div><h3>OFFLINE MODE</h3><p>Connection lost. Patient monitoring continues locally. {state.queue.length} events waiting to sync.</p></div>
          <button className="btn ghost" onClick={() => setShowQueue(true)}>View pending data</button>
        </section>
      ) : null}
      {restored ? <section className="banner ok"><div><h3>CONNECTION RESTORED</h3><p>{state.lastSync.done}/{state.lastSync.total} events synchronized.</p></div></section> : null}
      <section className="card pad">
        <h3>Data pipeline</h3>
        <div className="pipeline" style={{ marginTop: 12 }}>
          {["IoT", "API", "Database", "AI"].map((node) => (
            <div key={node} className="pipe-node"><b>{node}</b><div>{state.internet || node === "IoT" ? "✓" : "Queued"}</div></div>
          ))}
        </div>
      </section>
      <section className="card pad">
        <h3>Power status</h3>
        {state.power.mode === "backup" ? (
          <>
            <p>Backup power active. Main power disconnected {formatTime(state.power.since)}.</p>
            <p>Battery {state.power.battery}% · estimated backup {minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "—"}</p>
            <p>Critical monitoring remains active.</p>
          </>
        ) : <p>Mains power is normal. Backup battery is ready.</p>}
      </section>
      <section className="card table-wrap">
        <table>
          <thead><tr><th>Device</th><th>Scope</th><th>Status</th><th>Seen</th></tr></thead>
          <tbody>
            {state.devices.map((device) => (
              <tr key={device.id}><td>{device.name}</td><td>{device.scope}</td><td>{device.status}</td><td>{ago(device.seenAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {showQueue ? (
        <div className="modal-back" onClick={() => setShowQueue(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pending local events</h3>
            {state.queue.map((item) => <div className="timeline-item" key={item.id}><span>SpO₂ {item.spo2}% · HR {item.hr}</span><span>{formatTime(item.at)}</span></div>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
