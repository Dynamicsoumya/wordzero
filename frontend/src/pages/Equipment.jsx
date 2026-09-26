import { useWard } from "../context/WardContext";
import { ago } from "../format";

export default function Equipment() {
  const { state, flash } = useWard();
  const online = state.equipment.filter((item) => item.status === "online").length;
  return (
    <div>
      <div className="page-head">
        <div><h2>Equipment health</h2><p>Device power, usage, and last check. Simulated hardware.</p></div>
        <button className="btn primary" onClick={() => flash("Pairing mode is simulated.")}>+ Pair device</button>
      </div>
      <div className="equip-grid">
        {state.equipment.map((item) => (
          <article key={item.id} className="card equip-card">
            <h3>{item.name}</h3>
            <div className="home-row"><span>Status</span><b>{item.status === "battery" ? "Battery low" : "Online"}</b></div>
            <div className="home-row"><span>Power</span><b>{item.battery}%</b></div>
            <div className="home-row"><span>Usage</span><b>{item.usage}</b></div>
            <p className="muted">Last checked {ago(item.lastChecked)}</p>
          </article>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>{online} of {state.equipment.length} devices online without a battery warning.</p>
    </div>
  );
}
