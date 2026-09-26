import { Link } from "react-router-dom";
import { useWard } from "../context/WardContext";

export default function AIInsights() {
  const { state } = useWard();
  return (
    <div>
      <div className="page-head">
        <div><h2>AI Risk Prediction</h2><p>Low, medium, or high risk, with the score, the reasons, and the recent trend. This is not a validated clinical model.</p></div>
      </div>
      <div className="stack">
        {state.patients.map((patient) => (
          <article key={patient.id} className="card pad">
            <div className="row-between">
              <div>
                <h3>{patient.name}</h3>
                <div className="risk-score">{patient.risk.score}%</div>
                <span className={`pill ${patient.risk.level}`}>{patient.risk.level} risk</span>
                <p style={{ marginTop: 8 }}>{patient.risk.forecast?.summary || patient.risk.window}</p>
              </div>
              <Link className="btn primary" to={`/app/ai/${patient.id}`}>View AI Explanation</Link>
            </div>
            {patient.risk.factors.map((factor) => (
              <div className="factor" key={factor.id}><span>{factor.label}</span><div className="bar"><i style={{ width: `${factor.intensity}%` }} /></div></div>
            ))}
          </article>
        ))}
        <p className="disclaimer">Model metrics such as accuracy and F1 are omitted on purpose. This score has not been validated on a clinical dataset.</p>
      </div>
    </div>
  );
}
