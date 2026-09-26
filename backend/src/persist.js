import { pool } from "./db.js";
import { notifyAlert } from "./notify.js";

export async function ensureClinicalTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vital_samples (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      hr NUMERIC NOT NULL,
      spo2 NUMERIC NOT NULL,
      temp NUMERIC NOT NULL,
      systolic NUMERIC NOT NULL,
      diastolic NUMERIC NOT NULL,
      source TEXT NOT NULL,
      recorded_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_flags (
      patient_id TEXT PRIMARY KEY,
      weakness BOOLEAN NOT NULL DEFAULT false,
      breathing BOOLEAN NOT NULL DEFAULT false,
      note_text TEXT NOT NULL DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_meta (
      alert_id TEXT PRIMARY KEY,
      reasons JSONB NOT NULL DEFAULT '[]',
      score NUMERIC,
      vitals JSONB,
      equipment_id TEXT,
      acknowledged_at BIGINT,
      acknowledged_by TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS note_analysis (
      note_id TEXT PRIMARY KEY,
      language TEXT,
      analysis JSONB NOT NULL,
      on_timeline BOOLEAN NOT NULL DEFAULT false,
      caregiver_id TEXT,
      recorded_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth_secret TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_dispatches (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      user_id TEXT,
      channel TEXT NOT NULL,
      destination TEXT,
      status TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS equipment_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      patient_id TEXT,
      status TEXT NOT NULL,
      battery INTEGER NOT NULL,
      usage TEXT,
      last_checked BIGINT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS iot_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      seen_at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS live_readings (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      hr NUMERIC, spo2 NUMERIC, temp NUMERIC, systolic NUMERIC, diastolic NUMERIC,
      source TEXT, recorded_at BIGINT NOT NULL, synced BOOLEAN NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      hr NUMERIC, spo2 NUMERIC, temp NUMERIC, systolic NUMERIC, diastolic NUMERIC,
      source TEXT, recorded_at BIGINT NOT NULL, synced BOOLEAN NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_state (
      id TEXT PRIMARY KEY,
      internet BOOLEAN NOT NULL,
      restored_at BIGINT NOT NULL,
      power_mode TEXT NOT NULL,
      power_since BIGINT NOT NULL,
      power_battery INTEGER NOT NULL,
      last_sync JSONB NOT NULL,
      settings JSONB NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caregiver_events (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS caregiver_status (
      id TEXT PRIMARY KEY,
      presence TEXT NOT NULL,
      check_in BIGINT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT,
      action TEXT NOT NULL,
      subject TEXT,
      detail TEXT,
      at BIGINT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      dose TEXT NOT NULL,
      time_label TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at BIGINT
    )
  `);
}

export async function hydrateClinical(db) {
  const count = await pool.query("SELECT COUNT(*)::int AS n FROM vital_samples");
  if (count.rows[0].n === 0) {
    const rows = [];
    for (const patient of db.patients) rows.push(...rowsFromHistory(patient));
    await insertSamples(rows);
  }
  const samples = await pool.query("SELECT * FROM vital_samples ORDER BY recorded_at");
  const grouped = new Map();
  for (const row of samples.rows) {
    const list = grouped.get(row.patient_id) || [];
    list.push(sampleFromRow(row));
    grouped.set(row.patient_id, list);
  }
  for (const patient of db.patients) {
    const list = grouped.get(patient.id);
    if (!list?.length) continue;
    patient.samples = list;
    const latest = list[list.length - 1];
    patient.vitals = {
      hr: latest.hr,
      spo2: latest.spo2,
      temp: latest.temp,
      systolic: latest.systolic,
      diastolic: latest.diastolic,
    };
    patient.history = {
      hr: list.map((item) => ({ t: item.t, v: item.hr })),
      spo2: list.map((item) => ({ t: item.t, v: item.spo2 })),
      temp: list.map((item) => ({ t: item.t, v: item.temp })),
      bp: list.map((item) => ({ t: item.t, v: item.systolic, dia: item.diastolic })),
    };
  }

  const flags = await pool.query("SELECT * FROM patient_flags");
  for (const row of flags.rows) {
    const patient = db.patients.find((item) => item.id === row.patient_id);
    if (!patient) continue;
    patient.flags = { weakness: row.weakness, breathing: row.breathing, text: row.note_text || "" };
  }

  const alerts = await pool.query(`
    SELECT a.id, a.patient_id, a.severity, a.title, a.body, a.acknowledged,
           EXTRACT(EPOCH FROM a.created_at) * 1000 AS at,
           m.reasons, m.score, m.vitals, m.equipment_id, m.acknowledged_at, m.acknowledged_by
    FROM alerts a
    LEFT JOIN alert_meta m ON m.alert_id = a.id
    ORDER BY a.created_at DESC
  `);
  if (alerts.rows.length) {
    db.alerts = alerts.rows.map(alertFromRow);
  } else {
    for (const alert of db.alerts) await upsertAlert(alert, false);
  }

  const notes = await pool.query(`
    SELECT c.id, c.patient_id, c.body, EXTRACT(EPOCH FROM c.created_at) * 1000 AS at,
           n.language, n.analysis, n.on_timeline, n.caregiver_id
    FROM care_notes c
    LEFT JOIN note_analysis n ON n.note_id = c.id
    ORDER BY c.created_at DESC
  `);
  if (notes.rows.length) {
    db.notes = notes.rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      caregiverId: row.caregiver_id || "amit",
      language: row.language || "Hindi",
      text: row.body,
      analysis: row.analysis || { findings: [], reading: row.body, method: "Stored note." },
      at: Number(row.at),
      onTimeline: Boolean(row.on_timeline),
    }));
  }
  await hydrateMedications(db);
  await hydrateWard(db);
}

export async function clearClinical() {
  await pool.query("DELETE FROM alert_dispatches");
  await pool.query("DELETE FROM alert_meta");
  await pool.query("DELETE FROM alerts");
  await pool.query("DELETE FROM vital_samples");
  await pool.query("DELETE FROM patient_flags");
  await pool.query("DELETE FROM note_analysis");
  await pool.query("DELETE FROM care_notes");
  await pool.query("DELETE FROM equipment_items");
  await pool.query("DELETE FROM iot_devices");
  await pool.query("DELETE FROM live_readings");
  await pool.query("DELETE FROM offline_queue");
  await pool.query("DELETE FROM system_state");
  await pool.query("DELETE FROM caregiver_events");
  await pool.query("DELETE FROM caregiver_status");
  await pool.query("DELETE FROM audit_log");
  await pool.query("DELETE FROM medications");
}

export async function saveMedication(item) {
  await pool.query(
    `INSERT INTO medications (id, patient_id, name, dose, time_label, status, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    [item.id, item.patientId, item.name, item.dose, item.time, item.status, item.updatedAt || null],
  );
}

async function hydrateMedications(db) {
  const count = await pool.query("SELECT COUNT(*)::int AS n FROM medications");
  if (count.rows[0].n === 0) {
    for (const item of db.medications || []) await saveMedication(item);
    return;
  }
  const { rows } = await pool.query("SELECT * FROM medications ORDER BY time_label");
  db.medications = rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    dose: row.dose,
    time: row.time_label,
    status: row.status,
    updatedAt: row.updated_at ? Number(row.updated_at) : null,
  }));
}

export async function saveVitals(patient, source) {
  const vitals = patient.vitals;
  const at = Date.now();
  await pool.query(
    `UPDATE patients SET hr = $1, spo2 = $2, temp = $3, systolic = $4, diastolic = $5 WHERE id = $6`,
    [vitals.hr, vitals.spo2, vitals.temp, vitals.systolic, vitals.diastolic, patient.id],
  );
  await pool.query(
    `INSERT INTO vital_samples (id, patient_id, hr, spo2, temp, systolic, diastolic, source, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [`${patient.id}:${at}`, patient.id, vitals.hr, vitals.spo2, vitals.temp, vitals.systolic, vitals.diastolic, source, at],
  );
  patient.samples = patient.samples || [];
  patient.samples.push({
    t: at,
    hr: vitals.hr,
    spo2: vitals.spo2,
    temp: vitals.temp,
    systolic: vitals.systolic,
    diastolic: vitals.diastolic,
  });
}

export async function saveFlags(patient) {
  await pool.query(
    `INSERT INTO patient_flags (patient_id, weakness, breathing, note_text)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (patient_id) DO UPDATE SET weakness = EXCLUDED.weakness, breathing = EXCLUDED.breathing, note_text = EXCLUDED.note_text`,
    [patient.id, Boolean(patient.flags.weakness), Boolean(patient.flags.breathing), patient.flags.text || ""],
  );
}

export async function upsertAlert(alert, shouldNotify) {
  const existing = await pool.query("SELECT id FROM alerts WHERE id = $1", [alert.id]);
  const created = existing.rowCount === 0;
  await pool.query(
    `INSERT INTO alerts (id, patient_id, severity, title, body, acknowledged, created_at)
     VALUES ($1,$2,$3,$4,$5,$6, to_timestamp($7 / 1000.0))
     ON CONFLICT (id) DO UPDATE SET
       severity = EXCLUDED.severity,
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       acknowledged = EXCLUDED.acknowledged`,
    [alert.id, alert.patientId || null, alert.severity, alert.title, alert.body, Boolean(alert.acknowledged), alert.at || Date.now()],
  );
  await pool.query(
    `INSERT INTO alert_meta (alert_id, reasons, score, vitals, equipment_id, acknowledged_at, acknowledged_by)
     VALUES ($1,$2::jsonb,$3,$4::jsonb,$5,$6,$7)
     ON CONFLICT (alert_id) DO UPDATE SET
       reasons = EXCLUDED.reasons,
       score = EXCLUDED.score,
       vitals = EXCLUDED.vitals,
       equipment_id = EXCLUDED.equipment_id,
       acknowledged_at = EXCLUDED.acknowledged_at,
       acknowledged_by = EXCLUDED.acknowledged_by`,
    [
      alert.id,
      JSON.stringify(alert.reasons || []),
      alert.score ?? null,
      alert.vitals ? JSON.stringify(alert.vitals) : null,
      alert.equipmentId || null,
      alert.acknowledgedAt || null,
      alert.acknowledgedBy || null,
    ],
  );
  if (shouldNotify && created && (alert.severity === "critical" || alert.severity === "warning")) {
    await notifyAlert(alert);
  }
}

export async function saveNote(note) {
  await pool.query(
    `INSERT INTO care_notes (id, patient_id, author_id, body)
     VALUES ($1, $2, (SELECT id FROM users WHERE caregiver_id = $3 LIMIT 1), $4)
     ON CONFLICT (id) DO NOTHING`,
    [note.id, note.patientId, note.caregiverId, note.text],
  );
  await pool.query(
    `INSERT INTO note_analysis (note_id, language, analysis, on_timeline, caregiver_id, recorded_at)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6)
     ON CONFLICT (note_id) DO UPDATE SET on_timeline = EXCLUDED.on_timeline, analysis = EXCLUDED.analysis`,
    [note.id, note.language, JSON.stringify(note.analysis), Boolean(note.onTimeline), note.caregiverId, note.at],
  );
}

function rowsFromHistory(patient) {
  return patient.history.hr.map((point, index) => ({
    id: `${patient.id}:${point.t}`,
    patientId: patient.id,
    hr: point.v,
    spo2: patient.history.spo2[index].v,
    temp: patient.history.temp[index].v,
    systolic: patient.history.bp[index].v,
    diastolic: patient.history.bp[index].dia,
    source: "seed",
    at: point.t,
  }));
}

async function insertSamples(rows) {
  const size = 150;
  for (let offset = 0; offset < rows.length; offset += size) {
    const chunk = rows.slice(offset, offset + size);
    const params = [];
    const values = chunk.map((row, index) => {
      const base = index * 9;
      params.push(row.id, row.patientId, row.hr, row.spo2, row.temp, row.systolic, row.diastolic, row.source, row.at);
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
    });
    await pool.query(
      `INSERT INTO vital_samples (id, patient_id, hr, spo2, temp, systolic, diastolic, source, recorded_at)
       VALUES ${values.join(",")} ON CONFLICT (id) DO NOTHING`,
      params,
    );
  }
}

function sampleFromRow(row) {
  return {
    t: Number(row.recorded_at),
    hr: Number(row.hr),
    spo2: Number(row.spo2),
    temp: Number(row.temp),
    systolic: Number(row.systolic),
    diastolic: Number(row.diastolic),
  };
}

function alertFromRow(row) {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    body: row.body,
    patientId: row.patient_id,
    equipmentId: row.equipment_id || undefined,
    at: Number(row.at),
    acknowledged: row.acknowledged,
    acknowledgedAt: row.acknowledged_at ? Number(row.acknowledged_at) : undefined,
    acknowledgedBy: row.acknowledged_by || undefined,
    reasons: row.reasons || [],
    score: row.score == null ? undefined : Number(row.score),
    vitals: row.vitals || undefined,
  };
}

async function hydrateWard(db) {
  const equipmentCount = await pool.query("SELECT COUNT(*)::int AS n FROM equipment_items");
  if (equipmentCount.rows[0].n === 0) {
    for (const item of db.equipment) {
      await pool.query(
        `INSERT INTO equipment_items (id, name, patient_id, status, battery, usage, last_checked) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [item.id, item.name, item.patientId, item.status, item.battery, item.usage, item.lastChecked],
      );
    }
  }
  const equipment = await pool.query("SELECT * FROM equipment_items ORDER BY name");
  if (equipment.rows.length) {
    db.equipment = equipment.rows.map((row) => ({
      id: row.id,
      name: row.name,
      patientId: row.patient_id,
      status: row.status,
      battery: row.battery,
      usage: row.usage,
      lastChecked: Number(row.last_checked),
    }));
  }

  const deviceCount = await pool.query("SELECT COUNT(*)::int AS n FROM iot_devices");
  if (deviceCount.rows[0].n === 0) {
    for (const item of db.devices) {
      await pool.query(
        `INSERT INTO iot_devices (id, name, scope, status, seen_at) VALUES ($1,$2,$3,$4,$5)`,
        [item.id, item.name, item.scope, item.status, item.seenAt],
      );
    }
  }
  const devices = await pool.query("SELECT * FROM iot_devices ORDER BY name");
  if (devices.rows.length) {
    db.devices = devices.rows.map((row) => ({
      id: row.id,
      name: row.name,
      scope: row.scope,
      status: row.status,
      seenAt: Number(row.seen_at),
    }));
  }

  const readingCount = await pool.query("SELECT COUNT(*)::int AS n FROM live_readings");
  if (readingCount.rows[0].n === 0) {
    for (const item of db.readings) await saveTelemetry(item, false);
  }
  const readings = await pool.query("SELECT * FROM live_readings ORDER BY recorded_at DESC LIMIT 40");
  db.readings = readings.rows.map(telemetryFromRow);

  const queued = await pool.query("SELECT * FROM offline_queue ORDER BY recorded_at");
  db.queue = queued.rows.map(telemetryFromRow);

  const systemCount = await pool.query("SELECT COUNT(*)::int AS n FROM system_state");
  if (systemCount.rows[0].n === 0) await saveSystem(db);
  const system = await pool.query("SELECT * FROM system_state WHERE id = 'ward'");
  if (system.rows[0]) {
    const row = system.rows[0];
    db.internet = row.internet;
    db.restoredAt = Number(row.restored_at);
    db.power = { mode: row.power_mode, since: Number(row.power_since), battery: row.power_battery };
    db.lastSync = row.last_sync;
    db.settings = row.settings;
  }

  const eventCount = await pool.query("SELECT COUNT(*)::int AS n FROM caregiver_events");
  if (eventCount.rows[0].n === 0) {
    for (const person of db.caregivers) {
      await pool.query(
        `INSERT INTO caregiver_status (id, presence, check_in) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
        [person.id, person.presence, person.checkIn],
      );
      for (const event of person.timeline) await saveCareEvent(person.id, event);
    }
  }
  const events = await pool.query("SELECT * FROM caregiver_events ORDER BY at");
  const status = await pool.query("SELECT * FROM caregiver_status");
  for (const person of db.caregivers) {
    const mine = events.rows.filter((row) => row.caregiver_id === person.id);
    if (mine.length) person.timeline = mine.map((row) => ({ id: row.id, at: Number(row.at), label: row.label, kind: row.kind }));
    const presence = status.rows.find((row) => row.id === person.id);
    if (presence) {
      person.presence = presence.presence;
      person.checkIn = presence.check_in ? Number(presence.check_in) : person.checkIn;
    }
  }

  const audit = await pool.query("SELECT * FROM audit_log ORDER BY at DESC LIMIT 100");
  db.audit = audit.rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    subject: row.subject,
    detail: row.detail,
    at: Number(row.at),
  }));
}

export async function saveSystem(db) {
  await pool.query(
    `INSERT INTO system_state (id, internet, restored_at, power_mode, power_since, power_battery, last_sync, settings)
     VALUES ('ward',$1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       internet = EXCLUDED.internet,
       restored_at = EXCLUDED.restored_at,
       power_mode = EXCLUDED.power_mode,
       power_since = EXCLUDED.power_since,
       power_battery = EXCLUDED.power_battery,
       last_sync = EXCLUDED.last_sync,
       settings = EXCLUDED.settings`,
    [db.internet, db.restoredAt || 0, db.power.mode, db.power.since, db.power.battery, JSON.stringify(db.lastSync), JSON.stringify(db.settings)],
  );
}

export async function saveDevice(device) {
  await pool.query(
    `INSERT INTO iot_devices (id, name, scope, status, seen_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, seen_at = EXCLUDED.seen_at`,
    [device.id, device.name, device.scope, device.status, device.seenAt],
  );
}

export async function saveTelemetry(item, queued) {
  const table = queued ? "offline_queue" : "live_readings";
  await pool.query(
    `INSERT INTO ${table} (id, patient_id, hr, spo2, temp, systolic, diastolic, source, recorded_at, synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
    [item.id, item.patientId, item.hr, item.spo2, item.temp, item.systolic, item.diastolic, item.source || "sensor", item.at, Boolean(item.synced)],
  );
  if (!queued) {
    await pool.query(`DELETE FROM live_readings WHERE id NOT IN (SELECT id FROM live_readings ORDER BY recorded_at DESC LIMIT 40)`);
  }
}

export async function replaceQueue(queue) {
  await pool.query("DELETE FROM offline_queue");
  for (const item of queue) await saveTelemetry(item, true);
}

export async function saveCareEvent(caregiverId, event) {
  await pool.query(
    `INSERT INTO caregiver_events (id, caregiver_id, label, kind, at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
    [event.id, caregiverId, event.label, event.kind, event.at],
  );
}

export async function saveCaregiverStatus(person) {
  await pool.query(
    `INSERT INTO caregiver_status (id, presence, check_in) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET presence = EXCLUDED.presence, check_in = EXCLUDED.check_in`,
    [person.id, person.presence, person.checkIn],
  );
}

export async function writeAudit(db, entry) {
  const row = {
    id: `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    actor: entry.actor || "system",
    action: entry.action,
    subject: entry.subject || "",
    detail: entry.detail || "",
    at: Date.now(),
  };
  db.audit = [row, ...(db.audit || [])].slice(0, 100);
  await pool.query(
    `INSERT INTO audit_log (id, actor, action, subject, detail, at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [row.id, row.actor, row.action, row.subject, row.detail, row.at],
  );
  return row;
}

function telemetryFromRow(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    hr: Number(row.hr),
    spo2: Number(row.spo2),
    temp: Number(row.temp),
    systolic: Number(row.systolic),
    diastolic: Number(row.diastolic),
    source: row.source,
    at: Number(row.recorded_at),
    synced: row.synced,
  };
}
