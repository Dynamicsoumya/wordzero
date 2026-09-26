import { useEffect, useMemo, useState } from "react";
import { useWard } from "../context/WardContext";
import { ROLE_LABEL } from "../access";

const ROLES = ["admin", "doctor", "nurse", "caregiver"];
const PAGE_SIZE = 4;

function PrettyCheck({ checked, onChange, label, chip, hideLabel }) {
  return (
    <label className={`pretty-check${chip ? " chip" : ""}${checked ? " on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label || "Select"} />
      <span className="box" />
      {label && !hideLabel ? <span>{label}</span> : null}
    </label>
  );
}

export default function Users() {
  const { state, accounts, loadAccounts, assignAccount, flash } = useWard();
  const [drafts, setDrafts] = useState({});
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccounts().catch((err) => setError(err.message));
  }, [loadAccounts]);

  const pages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return accounts.slice(start, start + PAGE_SIZE);
  }, [accounts, safePage]);

  function draftFor(account) {
    return drafts[account.id] || {
      role: account.role === "pending" ? "caregiver" : account.role,
      department: account.department || "",
      assignedPatientIds: account.assignedPatientIds || [],
    };
  }

  function update(id, patch) {
    const account = accounts.find((item) => item.id === id);
    setDrafts((current) => ({ ...current, [id]: { ...draftFor(account), ...current[id], ...patch } }));
  }

  function togglePatient(id, patientId) {
    const account = accounts.find((item) => item.id === id);
    const current = draftFor(account).assignedPatientIds;
    const assignedPatientIds = current.includes(patientId)
      ? current.filter((item) => item !== patientId)
      : [...current, patientId];
    update(id, { assignedPatientIds });
  }

  function toggleRow(id) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const pageIds = rows.map((account) => account.id);
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function togglePage() {
    setSelected((current) => (
      pageSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])]
    ));
  }

  async function save(account) {
    setError("");
    try {
      const draft = draftFor(account);
      await assignAccount(account.id, draft);
      flash(`${account.name} is now ${ROLE_LABEL[draft.role] || draft.role}`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[account.id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const from = accounts.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, accounts.length);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>User management</h2>
          <p>Verify pending accounts and assign Admin, Doctor, Nurse, or Caregiver.</p>
        </div>
        <span className="pill low">{selected.length} selected</span>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <section className="card table-wrap">
        <table className="user-table">
          <thead>
            <tr>
              <th><PrettyCheck hideLabel checked={pageSelected} onChange={togglePage} label="Select page" /></th>
              <th>User</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Patients</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8}>No accounts yet.</td></tr>
            ) : rows.map((account) => {
              const draft = draftFor(account);
              const on = selected.includes(account.id);
              return (
                <tr key={account.id} className={on ? "selected" : ""}>
                  <td><PrettyCheck hideLabel checked={on} onChange={() => toggleRow(account.id)} label={`Select ${account.name}`} /></td>
                  <td>
                    <div className="person">
                      <div className="avatar">{account.name?.[0] || "U"}</div>
                      <div><b>{account.name}</b><div className="muted">{account.email}</div></div>
                    </div>
                  </td>
                  <td>{account.phone || "—"}</td>
                  <td>
                    <select className="table-input" value={draft.role} onChange={(e) => update(account.id, { role: e.target.value })}>
                      {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="table-input" value={draft.department} onChange={(e) => update(account.id, { department: e.target.value })} placeholder="Department" />
                  </td>
                  <td><span className={`pill ${account.status === "approved" ? "low" : "medium"}`}>{account.status === "approved" ? "Approved" : "Pending"}</span></td>
                  <td>
                    {draft.role === "admin" ? <span className="muted">All patients</span> : (
                      <div className="patient-picks">
                        {(state?.patients || []).map((patient) => (
                          <PrettyCheck
                            chip
                            key={patient.id}
                            label={patient.name.split(" ")[0]}
                            checked={draft.assignedPatientIds.includes(patient.id)}
                            onChange={() => togglePatient(account.id, patient.id)}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <button className="btn primary" onClick={() => save(account)}>
                      {account.status === "pending" ? "Approve" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pager">
          <span className="muted">Showing {from}–{to} of {accounts.length}</span>
          <div className="pager-controls">
            <button className="btn ghost" type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</button>
            {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
              <button key={number} type="button" className={`page-num${number === safePage ? " active" : ""}`} onClick={() => setPage(number)}>{number}</button>
            ))}
            <button className="btn ghost" type="button" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
