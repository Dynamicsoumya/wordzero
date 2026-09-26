import { feedEnabled, ingestReading } from "./store.js";

const SENSORS = [
  ["rahul", "Pulse Oximeter"],
  ["priya", "ECG Patch"],
  ["sita", "Door Sensor"],
];

let timer;

function settle(current, baseline, span) {
  const toward = Number(baseline) - Number(current);
  const jitter = (Math.random() - 0.5) * span;
  return Number(current) + toward * 0.35 + jitter;
}

export function startDeviceFeed(sampleFor) {
  if (timer || process.env.DEVICE_FEED === "off" || !process.env.DEVICE_INGEST_TOKEN) return;
  const send = async () => {
    if (!feedEnabled()) return;
    for (const [patientId, deviceName] of SENSORS) {
      const sample = sampleFor(patientId);
      if (!sample) continue;
      const hr = Math.round(settle(sample.hr, sample.baselineHr, 1.2));
      const spo2 = Math.round(settle(sample.spo2, sample.baselineSpo2, 0.4));
      const temp = Math.round(settle(sample.temp, sample.baselineTemp, 0.08) * 10) / 10;
      const systolic = Math.round(settle(sample.systolic, 120, 1.5));
      const diastolic = Math.round(settle(sample.diastolic, 78, 1));
      await ingestReading(process.env.DEVICE_INGEST_TOKEN, {
        patientId,
        deviceName,
        hr,
        spo2,
        temp,
        systolic,
        diastolic,
        source: "device",
      });
    }
  };
  timer = setInterval(() => {
    send().catch((error) => console.error("Device feed failed.", error.message));
  }, 20000);
  timer.unref();
  send().catch((error) => console.error("Device feed failed.", error.message));
}
