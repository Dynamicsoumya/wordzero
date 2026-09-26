/**
 * Transparent deterioration score for decision support.
 * The same weights are implemented in ml/predict.py.
 * This is not a diagnostic model and has not been clinically validated.
 */
export function assess(patient) {
  const v = patient.vitals;
  const b = patient.baseline;
  const flags = patient.flags || {};
  const spo2Drop = round1(b.spo2 - v.spo2);
  const hrRise = round1(v.hr - b.hr);
  const tempRise = round1(v.temp - b.temp);

  let spo2Pts = 0;
  if (v.spo2 < 90) spo2Pts = 28;
  else if (v.spo2 <= 94) spo2Pts = 18;
  else if (v.spo2 < 96) spo2Pts = 10;
  if (spo2Drop >= 6) spo2Pts += 10;
  else if (spo2Drop >= 2) spo2Pts += 6;

  let hrPts = 0;
  if (v.hr >= 110) hrPts = 16;
  else if (v.hr >= 100) hrPts = 12;
  else if (v.hr >= 92) hrPts = 8;
  else if (v.hr >= 90) hrPts = 4;
  if (hrRise >= 18) hrPts += 8;
  else if (hrRise >= 8) hrPts += 5;

  let tempPts = 0;
  if (v.temp >= 38.5) tempPts = 14;
  else if (v.temp >= 37.6) tempPts = 9;
  else if (v.temp >= 37.2) tempPts = 6;

  let notePts = 0;
  const symptoms = [];
  if (flags.weakness) {
    notePts += 6;
    symptoms.push("Weakness");
  }
  if (flags.breathing) {
    notePts += 7;
    symptoms.push("Breathing difficulty");
  }

  let bpPts = 0;
  if (v.systolic >= 150 || v.systolic < 95) bpPts = 6;

  let score = spo2Pts + hrPts + tempPts + notePts + bpPts;
  const concordant = spo2Pts >= 10 && hrPts >= 8 && tempPts >= 5;
  if (concordant) score += 2;

  if (score < 10) {
    score = Math.round(6 + (100 - v.spo2) * 2 + Math.max(0, v.hr - 80) * 0.15);
  }
  score = Math.max(4, Math.min(96, Math.round(score)));

  const level = score >= 65 ? "high" : score >= 25 ? "medium" : "low";
  const status = level === "high" ? "Alert" : level === "medium" ? "Watch" : "Stable";

  const factors = [
    {
      id: "spo2",
      label: "SpO₂ decreasing",
      direction: "down",
      points: spo2Pts,
      intensity: clamp(Math.round(spo2Pts * 2.3)),
      detail: `${b.spo2}% → ${v.spo2}%`,
      narrative: spo2Drop >= 2 ? "Continuous decrease" : "No meaningful decrease",
    },
    {
      id: "hr",
      label: "Heart rate increasing",
      direction: "up",
      points: hrPts,
      intensity: clamp(Math.round(hrPts * 2.6)),
      detail: `${b.hr} → ${v.hr} BPM`,
      narrative: hrRise >= 8 ? "Increasing trend" : "Stable range",
    },
    {
      id: "temp",
      label: "Temperature elevated",
      direction: "up",
      points: tempPts,
      intensity: clamp(Math.round(tempPts * 4.2)),
      detail: `${b.temp.toFixed(1)}°C → ${Number(v.temp).toFixed(1)}°C`,
      narrative: tempRise >= 0.5 ? "Elevated" : "Within usual range",
    },
  ];

  if (notePts > 0) {
    factors.push({
      id: "note",
      label: "Caregiver note",
      direction: "note",
      points: notePts,
      intensity: clamp(notePts * 5),
      detail: symptoms.join(" · "),
      narrative: flags.text || symptoms.join(", "),
    });
  }

  let recommendation = "No significant deterioration pattern detected.";
  if (level === "medium") recommendation = "Increase observation frequency and recheck vitals.";
  if (level === "high") recommendation = "Immediate caregiver assessment recommended.";

  const forecast = forecastFrom(patient, flags, level);

  return {
    score,
    level,
    status,
    window: forecast.window,
    forecast,
    recommendation,
    factors,
    symptoms,
    concordant,
    disclaimer:
      "Decision-support only. This is not a validated clinical model. WardZero does not diagnose, prescribe, or replace a clinician. The window is a projection of the recent reading trend.",
    contributions: { spo2Pts, hrPts, tempPts, notePts, bpPts, concordant },
  };
}

function forecastFrom(patient, flags, currentLevel) {
  const series = readingSeries(patient);
  const recent = series.filter((row) => row.t >= Date.now() - 6 * 3600000);
  const used = recent.length >= 3 ? recent : series.slice(-12);
  if (used.length < 3) {
    return {
      window: "Not enough recorded readings to forecast",
      summary: "At least three stored readings are required before a 24 or 48 hour projection.",
      basis: "stored readings",
      at24: null,
      at48: null,
    };
  }
  const at24 = projectRow(used, flags, patient.baseline, 24);
  const at48 = projectRow(used, flags, patient.baseline, 48);
  const rank = { low: 0, medium: 1, high: 2 };
  const last = used[used.length - 1];
  const worsening = (projected) => rank[projected.level] > rank[currentLevel]
    || last.spo2 - projected.spo2 >= 3
    || projected.hr - last.hr >= 15
    || projected.temp - last.temp >= 0.6;
  let window = "No acute deterioration window";
  if (currentLevel === "high") window = "Already high on current readings";
  else if (worsening(at24)) window = "Within 24 hours";
  else if (worsening(at48)) window = "Within 24–48 hours";
  else if (currentLevel === "medium") window = "Current watch level is expected to continue";
  const spo2Now = round1(used[used.length - 1].spo2);
  return {
    window,
    basis: "Rate of change across stored readings from the last 6 hours. Tiny wobble is ignored, and the hourly change is capped.",
    at24,
    at48,
    summary: `${window}. If the recent rate continues, SpO₂ ${spo2Now}% is projected to ${at24.spo2}% in 24 hours and ${at48.spo2}% in 48 hours.`,
  };
}

function readingSeries(patient) {
  if (patient.samples?.length >= 3) return patient.samples;
  const heart = patient.history?.hr || [];
  if (heart.length < 3) return [];
  return heart.map((point, index) => ({
    t: point.t,
    hr: point.v,
    spo2: patient.history.spo2[index]?.v ?? patient.vitals.spo2,
    temp: patient.history.temp[index]?.v ?? patient.vitals.temp,
    systolic: patient.history.bp[index]?.v ?? patient.vitals.systolic,
    diastolic: patient.history.bp[index]?.dia ?? patient.vitals.diastolic,
  }));
}

function projectRow(rows, flags, baseline, hours) {
  const caps = { spo2: 1.5, hr: 8, temp: 0.15, systolic: 4 };
  const limits = { spo2: [70, 100], hr: [40, 180], temp: [35, 41], systolic: [80, 200] };
  const last = rows[rows.length - 1];
  const vitals = {
    spo2: projectValue(rows, "spo2", hours, caps.spo2, limits.spo2, 0),
    hr: projectValue(rows, "hr", hours, caps.hr, limits.hr, 0),
    temp: projectValue(rows, "temp", hours, caps.temp, limits.temp, 1),
    systolic: projectValue(rows, "systolic", hours, caps.systolic, limits.systolic, 0),
    diastolic: last.diastolic,
  };
  const scored = scoreOnly(vitals, baseline, flags);
  return { ...vitals, level: scored.level, score: scored.score };
}

function projectValue(rows, key, hours, cap, [min, max], digits) {
  const points = rows.map((row) => ({ t: row.t, v: Number(row[key]) }));
  const floor = { spo2: 0.15, hr: 1, temp: 0.03, systolic: 0.8 }[key] || 0;
  let slope = ratePerHour(points);
  if (Math.abs(slope) < floor) slope = 0;
  slope = Math.max(-cap, Math.min(cap, slope));
  const value = points[points.length - 1].v + slope * hours;
  const clamped = Math.max(min, Math.min(max, value));
  const factor = 10 ** digits;
  return Math.round(clamped * factor) / factor;
}

function ratePerHour(points) {
  const mid = Math.floor(points.length / 2);
  const early = points.slice(0, mid);
  const late = points.slice(mid);
  const average = (list, pick) => list.reduce((sum, point) => sum + pick(point), 0) / list.length;
  const hours = (average(late, (point) => point.t) - average(early, (point) => point.t)) / 3600000;
  if (hours <= 0.05) return 0;
  return (average(late, (point) => point.v) - average(early, (point) => point.v)) / hours;
}

function scoreOnly(v, b, flags) {
  const spo2Drop = round1(b.spo2 - v.spo2);
  const hrRise = round1(v.hr - b.hr);
  let spo2Pts = 0;
  if (v.spo2 < 90) spo2Pts = 28;
  else if (v.spo2 <= 94) spo2Pts = 18;
  else if (v.spo2 < 96) spo2Pts = 10;
  if (spo2Drop >= 6) spo2Pts += 10;
  else if (spo2Drop >= 2) spo2Pts += 6;
  let hrPts = 0;
  if (v.hr >= 110) hrPts = 16;
  else if (v.hr >= 100) hrPts = 12;
  else if (v.hr >= 92) hrPts = 8;
  else if (v.hr >= 90) hrPts = 4;
  if (hrRise >= 18) hrPts += 8;
  else if (hrRise >= 8) hrPts += 5;
  let tempPts = 0;
  if (v.temp >= 38.5) tempPts = 14;
  else if (v.temp >= 37.6) tempPts = 9;
  else if (v.temp >= 37.2) tempPts = 6;
  let notePts = 0;
  if (flags.weakness) notePts += 6;
  if (flags.breathing) notePts += 7;
  const bpPts = v.systolic >= 150 || v.systolic < 95 ? 6 : 0;
  let score = spo2Pts + hrPts + tempPts + notePts + bpPts;
  if (spo2Pts >= 10 && hrPts >= 8 && tempPts >= 5) score += 2;
  if (score < 10) score = Math.round(6 + (100 - v.spo2) * 2 + Math.max(0, v.hr - 80) * 0.15);
  score = Math.max(4, Math.min(96, Math.round(score)));
  return { score, level: score >= 65 ? "high" : score >= 25 ? "medium" : "low" };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function clamp(n) {
  return Math.max(6, Math.min(100, n));
}
