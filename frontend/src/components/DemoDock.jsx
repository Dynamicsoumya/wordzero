import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWard } from "../context/WardContext";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function DemoDock() {
  const { apply, flash } = useWard();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function run(step) {
    setBusy(true);
    try {
      if (step === 1) {
        await apply("/demo/reset");
        navigate("/app");
        flash("Scene 1 — ward is stable");
      }
      if (step === 2) {
        navigate("/app");
        const path = [
          { hr: 91, spo2: 95, temp: 37.1, systolic: 122, diastolic: 80 },
          { hr: 101, spo2: 92, temp: 37.5, systolic: 126, diastolic: 82 },
        ];
        for (const vitals of path) {
          await apply("/patients/rahul/vitals", { ...vitals, source: "demo" });
          await sleep(900);
        }
        flash("Scene 2 — sensors are shifting");
      }
      if (step === 3) {
        await apply("/patients/rahul/vitals", { hr: 108, spo2: 89, temp: 37.8, systolic: 132, diastolic: 86, source: "demo" });
        await apply("/patients/rahul/flags", { weakness: true, breathing: true, text: "Patient reports weakness" });
        navigate("/app");
        flash("Scene 3 — early warning, 24–48 hour window");
      }
      if (step === 4) {
        navigate("/app/ai/rahul");
        flash("Scene 4 — why the system is concerned");
      }
      if (step === 5) {
        navigate("/app/alerts");
        flash("Scene 5 — caregiver alert");
      }
      if (step === 6) {
        const current = await fetch("/api/state").then((r) => r.json());
        const alert = current.alerts.find((item) => item.severity === "critical" && !item.acknowledged);
        if (alert) await apply(`/alerts/${alert.id}/acknowledge`, { caregiverId: "amit" });
        await apply("/caregivers/amit/action", { kind: "assessed" });
        await apply("/caregivers/amit/action", { kind: "equipment" });
        navigate("/app/caregivers/amit");
        flash("Scene 6 — alert acknowledged and patient checked");
      }
      if (step === 7) {
        await apply("/system/offline-burst");
        navigate("/app/iot");
        flash("Scene 7 — offline mode, 12 events waiting");
      }
      if (step === 8) {
        await apply("/system/internet", { online: true });
        navigate("/app/iot");
        flash("Scene 8 — events synchronized");
      }
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function playAll() {
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await run(step);
      await sleep(step === 4 || step === 5 ? 1600 : 700);
    }
  }

  return (
    <div className="walkthrough">
      <button type="button" className="walkthrough-toggle" onClick={() => setOpen((value) => !value)}>
        {open ? "Close walkthrough" : "Walkthrough"}
      </button>
      {open ? (
        <div className="demo-dock">
          <button className="btn primary" disabled={busy} onClick={playAll}>Play</button>
          {["Stable", "Sensors", "AI warning", "Explain", "Alert", "Respond", "Offline", "Sync"].map((label, index) => (
            <button key={label} className="btn ghost" disabled={busy} onClick={() => run(index + 1)}>{index + 1} {label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
