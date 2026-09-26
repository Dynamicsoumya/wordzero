export function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const titles = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."]);
  const parts = String(name || "there").trim().split(/\s+/).filter(Boolean);
  const given = parts.length > 1 && titles.has(parts[0].toLowerCase()) ? parts[1] : (parts[0] || "there");
  return `${part}, ${given}`;
}

export function formatDay(ts = Date.now()) {
  return new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ago(ts) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function vitalLabel(kind, vitals) {
  if (kind === "hr") {
    if (vitals.hr >= 60 && vitals.hr <= 99) return "Normal";
    if (vitals.hr <= 109) return "Watch";
    return "High";
  }
  if (kind === "spo2") {
    if (vitals.spo2 >= 95) return "Normal";
    if (vitals.spo2 >= 92) return "Watch";
    return "Low";
  }
  if (kind === "temp") {
    if (vitals.temp < 37.3) return "Normal";
    if (vitals.temp < 38) return "Watch";
    return "High";
  }
  if (vitals.systolic < 130 && vitals.systolic >= 100) return "Normal";
  if (vitals.systolic < 145) return "Watch";
  return "High";
}

export function sliceHistory(points, range) {
  const hours = { "1H": 1, "6H": 6, "24H": 24, "7D": 24 * 7 }[range] || 24;
  const cutoff = Date.now() - hours * 3600000;
  const filtered = points.filter((point) => point.t >= cutoff);
  const step = Math.max(1, Math.ceil(filtered.length / 48));
  return filtered.filter((_, index) => index % step === 0 || index === filtered.length - 1).map((point) => ({
    ...point,
    label: new Date(point.t).toLocaleTimeString([], range === "7D"
      ? { weekday: "short", hour: "numeric" }
      : { hour: "numeric", minute: "2-digit" }),
  }));
}

export function respiratoryRate(vitals) {
  const spo2 = Number(vitals?.spo2) || 97;
  const hr = Number(vitals?.hr) || 80;
  return Math.max(12, Math.min(32, Math.round(14 + (97 - spo2) * 0.55 + Math.max(0, hr - 80) * 0.04)));
}
