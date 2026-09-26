import { useWard } from "../context/WardContext";
import { formatTime } from "../format";

export default function AuditLog() {
  const { state } = useWard();
  const rows = state.audit || [];
  return (
    <div>
      <div className="page-head">
        <div><h2>Safety & Audit Logs</h2><p>Alert acknowledgements and other caregiver actions stored for this ward.</p></div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan="3">No caregiver actions have been recorded yet.</td></tr>
            ) : rows.map((item) => (
              <tr key={item.id}>
                <td>{item.at ? formatTime(item.at) : "—"}</td>
                <td><b>{item.action}</b></td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
