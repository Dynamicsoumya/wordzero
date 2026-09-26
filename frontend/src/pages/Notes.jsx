import { useState } from "react";
import { useWard } from "../context/WardContext";

const SAMPLE = "Patient ko aaj weakness aur saans lene mein dikkat ho rahi hai.";

export default function Notes() {
  const { state, apply, flash } = useWard();
  const [patientId, setPatientId] = useState(state.patients[0].id);
  const [language, setLanguage] = useState("Hindi");
  const [text, setText] = useState(SAMPLE);
  const [note, setNote] = useState(null);

  async function analyze(event) {
    event.preventDefault();
    const result = await apply("/notes", { patientId, language, text, caregiverId: "amit" });
    setNote(result.note);
    flash("Symptoms extracted from the note");
  }

  return (
    <div>
      <div className="page-head"><div><h2>Patient Care Notes</h2><p>Symptom words are matched in Hindi and English. The match count is not an accuracy score.</p></div></div>
      <div className="two">
        <form className="card pad" onSubmit={analyze}>
          <label className="field">Patient
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              {state.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
            </select>
          </label>
          <label className="field">Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {["Hindi", "English", "Odia", "Bengali"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">Note<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
          <button className="btn primary" type="submit">Extract symptoms</button>
        </form>
        <section className="card pad">
          <h3>Extracted symptoms</h3>
          {!note ? <p className="muted">Submit a note to match symptom words.</p> : (
            <>
              <p style={{ margin: "10px 0" }}>{note.analysis.reading}</p>
              {note.analysis.findings.map((item) => <p key={item.id}>Matched “{item.matched}” · {item.label}</p>)}
              <p>{note.analysis.method}</p>
              {!note.onTimeline ? <button className="btn ghost" onClick={() => apply(`/notes/${note.id}/timeline`).then(() => { setNote({ ...note, onTimeline: true }); flash("Added to the patient timeline"); })}>Add to patient timeline</button> : <span className="pill low">On timeline</span>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
