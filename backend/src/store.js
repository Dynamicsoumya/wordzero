import bcrypt from "bcryptjs";
import crypto from "crypto";
import { assess } from "./risk.js";
import { analyzeNote } from "./nlp.js";
import { pool } from "./db.js";
import { clearClinical, ensureClinicalTables, hydrateClinical, replaceQueue, saveCareEvent, saveCaregiverStatus, saveDevice, saveFlags, saveMedication, saveNote, saveSystem, saveTelemetry, saveVitals, upsertAlert, writeAudit } from "./persist.js";
import { reachDoctor } from "./notify.js";

let seq = 1;
const uid = (prefix) => `${prefix}_${(seq++).toString(36)}`;

let db = createDb();

function atToday(hours, minutes) {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.getTime();
}

function wave(step, amplitude) {
  return Math.sin(step / 4.7) * amplitude + Math.sin(step / 13) * amplitude * 0.3;
}

function buildSeries(now, base, amplitude, decimals) {
  const points = [];
  for (let hour = 24 * 7; hour > 48; hour -= 1) {
    points.push({
      t: now - hour * 3600000,
      v: roundTo(base + wave(hour, amplitude), decimals),
    });
  }
  for (let minute = 48 * 60; minute >= 10; minute -= 10) {
    points.push({
      t: now - minute * 60000,
      v: roundTo(base + wave(minute / 10, amplitude), decimals),
    });
  }
  points.push({ t: now, v: roundTo(base, decimals) });
  return points;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function createPatient(now, spec) {
  const hr = buildSeries(now, spec.vitals.hr, 2.2, 0);
  const spo2 = buildSeries(now, spec.vitals.spo2, 0.6, 0);
  const temp = buildSeries(now, spec.vitals.temp, 0.12, 1);
  const bp = buildSeries(now, spec.vitals.systolic, 3, 0).map((point) => ({
    ...point,
    dia: roundTo(spec.vitals.diastolic + (point.v - spec.vitals.systolic) * 0.45, 0),
  }));
  hr[hr.length - 1].v = spec.vitals.hr;
  spo2[spo2.length - 1].v = spec.vitals.spo2;
  temp[temp.length - 1].v = spec.vitals.temp;
  bp[bp.length - 1].v = spec.vitals.systolic;
  bp[bp.length - 1].dia = spec.vitals.diastolic;
  return {
    ...spec,
    flags: { weakness: false, breathing: false, text: "" },
    history: { hr, spo2, temp, bp },
  };
}

function createDb() {
  const now = Date.now();
  const patients = [
    createPatient(now, {
      id: "rahul",
      name: "Rahul Sharma",
      age: 62,
      room: "01",
      caregiverId: "amit",
      condition: "Post-discharge respiratory watch",
      historyNote: "Home oxygen at night after a chest infection. No hospital stay in the last 7 days.",
      emergencyContact: { name: "Sunita Sharma", relation: "Spouse", phone: "+91 98400 33011" },
      vitals: { hr: 82, spo2: 97, temp: 36.8, systolic: 120, diastolic: 80 },
      baseline: { hr: 82, spo2: 97, temp: 36.8 },
    }),
    createPatient(now, {
      id: "priya",
      name: "Priya Das",
      age: 54,
      room: "02",
      caregiverId: "neha",
      condition: "Heart failure home monitoring",
      historyNote: "Known heart failure. Weight and swelling are watched at home.",
      emergencyContact: { name: "Arjun Das", relation: "Son", phone: "+91 98400 33022" },
      vitals: { hr: 96, spo2: 94, temp: 37.2, systolic: 128, diastolic: 84 },
      baseline: { hr: 88, spo2: 96, temp: 36.7 },
    }),
    createPatient(now, {
      id: "sita",
      name: "Sita Mohanty",
      age: 71,
      room: "04",
      caregiverId: "anita",
      condition: "Recovery after pneumonia",
      historyNote: "Finished a pneumonia recovery plan. Cough and fever are the watch points.",
      emergencyContact: { name: "Meera Mohanty", relation: "Daughter", phone: "+91 98400 33044" },
      vitals: { hr: 76, spo2: 96, temp: 36.6, systolic: 118, diastolic: 76 },
      baseline: { hr: 76, spo2: 96, temp: 36.6 },
    }),
  ];

  const caregivers = [
    {
      id: "amit",
      name: "Amit Kumar",
      role: "Primary caregiver",
      presence: "present",
      checkIn: atToday(8, 42),
      phone: "+91 98400 11021",
      timeline: [
        { id: uid("ev"), at: atToday(8, 42), label: "Caregiver checked in", kind: "checkin" },
        { id: uid("ev"), at: atToday(9, 5), label: "Medication verified", kind: "medication" },
        { id: uid("ev"), at: atToday(9, 10), label: "Oxygen equipment checked", kind: "equipment" },
        { id: uid("ev"), at: atToday(9, 12), label: "Patient interaction", kind: "interaction" },
        { id: uid("ev"), at: atToday(9, 15), label: "Notes updated", kind: "notes" },
      ],
    },
    {
      id: "neha",
      name: "Neha Singh",
      role: "Caregiver",
      presence: "present",
      checkIn: atToday(8, 55),
      phone: "+91 98400 22018",
      timeline: [
        { id: uid("ev"), at: atToday(8, 55), label: "Caregiver checked in", kind: "checkin" },
        { id: uid("ev"), at: atToday(9, 20), label: "Patient interaction", kind: "interaction" },
      ],
    },
    {
      id: "anita",
      name: "Anita Das",
      role: "Caregiver",
      presence: "present",
      checkIn: atToday(8, 30),
      phone: "+91 98400 44110",
      timeline: [
        { id: uid("ev"), at: atToday(8, 30), label: "Caregiver checked in", kind: "checkin" },
        { id: uid("ev"), at: atToday(9, 2), label: "Medication verified", kind: "medication" },
      ],
    },
    {
      id: "ravi",
      name: "Ravi Patel",
      role: "Relief caregiver",
      presence: "away",
      checkIn: atToday(9, 10),
      phone: "+91 98400 77821",
      timeline: [{ id: uid("ev"), at: atToday(9, 10), label: "Brief check-in", kind: "checkin" }],
    },
  ];

  const equipment = [
    device("ox", "Oxygen Concentrator", "rahul", "online", 78, "4h 32m", now - 2 * 60000),
    device("bp", "BP Monitor", "rahul", "online", 98, "28m", now - 4 * 60000),
    device("oxi", "Pulse Oximeter", "rahul", "online", 97, "6h 10m", now - 20 * 1000),
    device("temp", "Temperature Sensor", "rahul", "online", 100, "6h 10m", now - 30 * 1000),
    device("scale", "Smart Scale", "priya", "battery", 22, "12m", now - 18 * 60000),
  ];

  const devices = [
    iot("Pulse Oximeter", "rahul", "online"),
    iot("BP Monitor", "rahul", "online"),
    iot("Temperature Sensor", "rahul", "online"),
    iot("Oxygen Concentrator", "rahul", "online"),
    iot("ECG Patch", "priya", "online"),
    iot("Smart Scale", "priya", "online"),
    iot("Bed Occupancy", "priya", "online"),
    iot("Door Sensor", "sita", "online"),
    iot("Fall Detector", "sita", "online"),
    iot("Gateway Hub", "ward", "online"),
    iot("Backup Router", "ward", "offline"),
    iot("Power Monitor", "ward", "online"),
  ];

  return {
    patients,
    caregivers,
    equipment,
    devices,
    alerts: [
      {
        id: "alert_scale",
        severity: "warning",
        title: "Oxygen equipment battery low",
        body: "Smart scale battery is at 22%. Room 02.",
        patientId: "priya",
        equipmentId: "scale",
        at: now - 18 * 60000,
        acknowledged: false,
        reasons: ["Battery below 25%"],
      },
      {
        id: "alert_note_seed",
        severity: "info",
        title: "Morning round completed",
        body: "Amit Kumar completed the 08:42 check-in for Rahul Sharma.",
        patientId: "rahul",
        at: now - 32 * 60000,
        acknowledged: false,
        reasons: ["Routine caregiver activity"],
      },
    ],
    notes: [],
    readings: [
      reading("rahul", patients[0].vitals, now - 4000, true),
      reading("rahul", patients[0].vitals, now - 9000, true),
      reading("priya", patients[1].vitals, now - 14000, true),
    ],
    queue: [],
    internet: true,
    restoredAt: 0,
    lastSync: { done: 0, total: 0, at: now },
    power: { mode: "mains", since: now, battery: 100 },
    settings: {
      criticalAlerts: true,
      equipmentWarnings: true,
      dailySummary: false,
      safetyNotice: true,
      auditLogging: true,
    },
    feedRunning: true,
    medications: [
      { id: "med_rahul_1", patientId: "rahul", name: "Amoxicillin", dose: "500 mg", time: "08:00", status: "taken" },
      { id: "med_rahul_2", patientId: "rahul", name: "Vitamin D", dose: "1000 IU", time: "21:00", status: "due" },
      { id: "med_priya_1", patientId: "priya", name: "Furosemide", dose: "40 mg", time: "09:00", status: "due" },
      { id: "med_sita_1", patientId: "sita", name: "Azithromycin", dose: "250 mg", time: "20:00", status: "missed" },
    ],
    audit: [],
    users: [],
  };
}

function device(id, name, patientId, status, battery, usage, lastChecked) {
  return { id, name, patientId, status, battery, usage, lastChecked };
}

function iot(name, scope, status) {
  return { id: uid("dev"), name, scope, status, seenAt: Date.now() - (status === "offline" ? 40 * 60000 : 10 * 1000) };
}

function reading(patientId, vitals, at, synced) {
  return { id: uid("rd"), patientId, ...vitals, at, synced, source: "seed" };
}

function findPatient(id) {
  return db.patients.find((patient) => patient.id === id);
}

function trim(list, max) {
  if (list.length > max) list.splice(0, list.length - max);
}

async function raiseFromRisk(patient) {
  const risk = assess(patient);
  if (risk.level !== "high" || !db.settings.criticalAlerts) return;
  const open = db.alerts.find((alert) => alert.patientId === patient.id && alert.severity === "critical" && !alert.acknowledged);
  const reasons = risk.factors.filter((factor) => factor.points > 0).map((factor) => factor.label);
  if (open) {
    open.body = `${patient.name}'s SpO₂ is ${patient.vitals.spo2}%. AI deterioration risk is ${risk.score}%.`;
    open.reasons = reasons;
    open.score = risk.score;
    open.vitals = { ...patient.vitals };
    await upsertAlert(open, false);
    return;
  }
  const alert = {
    id: uid("alert"),
    severity: "critical",
    title: "HIGH RISK",
    body: `${patient.name}'s SpO₂ dropped to ${patient.vitals.spo2}%. AI detected elevated deterioration risk.`,
    patientId: patient.id,
    at: Date.now(),
    acknowledged: false,
    reasons,
    score: risk.score,
    vitals: { ...patient.vitals },
  };
  db.alerts.unshift(alert);
  await upsertAlert(alert, true);
}

function pushReading(patient, source) {
  const item = { id: uid("rd"), patientId: patient.id, ...patient.vitals, at: Date.now(), source, synced: db.internet };
  if (db.internet) {
    db.readings.unshift(item);
    db.readings = db.readings.slice(0, 40);
  } else {
    db.queue.push(item);
  }
  return item;
}

function appendHistory(patient) {
  const now = Date.now();
  const v = patient.vitals;
  patient.history.hr.push({ t: now, v: v.hr });
  patient.history.spo2.push({ t: now, v: v.spo2 });
  patient.history.temp.push({ t: now, v: Number(v.temp) });
  patient.history.bp.push({ t: now, v: v.systolic, dia: v.diastolic });
  trim(patient.history.hr, 1200);
  trim(patient.history.spo2, 1200);
  trim(patient.history.temp, 1200);
  trim(patient.history.bp, 1200);
}

export function getPublicState(user) {
  const power = publicPower();
  const patients = db.patients.map((patient) => {
    const risk = assess(patient);
    const caregiver = db.caregivers.find((person) => person.id === patient.caregiverId);
    return {
      id: patient.id,
      name: patient.name,
      age: patient.age,
      room: patient.room,
      condition: patient.condition,
      historyNote: patient.historyNote || "",
      emergencyContact: patient.emergencyContact || null,
      caregiverId: patient.caregiverId,
      caregiverName: caregiver?.name || "Unassigned",
      vitals: patient.vitals,
      baseline: patient.baseline,
      flags: patient.flags,
      history: patient.history,
      risk,
    };
  });

  const caregivers = db.caregivers.map((person) => ({
    ...person,
    patients: patients.filter((patient) => patient.caregiverId === person.id).map((patient) => patient.name),
    lastActivity: person.timeline[person.timeline.length - 1]?.at || person.checkIn,
  }));

  const state = {
    generatedAt: Date.now(),
    demo: true,
    internet: db.internet,
    queue: db.queue,
    restoredAt: db.restoredAt,
    lastSync: db.lastSync,
    power,
    patients,
    caregivers,
    equipment: db.equipment,
    devices: db.devices,
    alerts: db.alerts,
    notes: db.notes,
    readings: db.readings,
    medications: db.medications || [],
    sensorFeed: db.feedRunning !== false,
    settings: db.settings,
    audit: db.audit || [],
    disclaimer: "Simulated home-ward data for demonstration. Not for clinical use.",
  };
  return user ? scopePublicState(user, state) : state;
}

export function scopeStateForUser(user, state) {
  if (!state) return state;
  return scopePublicState(user, state);
}

function scopePublicState(user, state) {
  if (!user || user.status === "pending" || user.role === "pending") {
    return { ...state, patients: [], alerts: [], readings: [], equipment: [], notes: [], devices: [], medications: [], caregivers: [], audit: [] };
  }
  if (user.role === "admin") return state;
  const ids = new Set(user.assignedPatientIds || []);
  return {
    ...state,
    patients: state.patients.filter((patient) => ids.has(patient.id)),
    alerts: state.alerts.filter((alert) => ids.has(alert.patientId)),
    readings: state.readings.filter((reading) => ids.has(reading.patientId)),
    equipment: state.equipment.filter((item) => ids.has(item.patientId)),
    notes: state.notes.filter((note) => ids.has(note.patientId)),
    devices: state.devices.filter((device) => ids.has(device.scope)),
    medications: (state.medications || []).filter((item) => ids.has(item.patientId)),
    caregivers: state.caregivers.filter((person) => state.patients.some((patient) => ids.has(patient.id) && patient.caregiverId === person.id)),
    audit: [],
  };
}

function publicPower() {
  if (db.power.mode !== "backup") {
    return { mode: "mains", battery: 100, estimatedMinutes: null, since: null };
  }
  const elapsed = (Date.now() - db.power.since) / 60000;
  const battery = Math.max(12, Math.round(76 - elapsed * 0.35));
  const estimatedMinutes = Math.round((battery / 76) * (3 * 60 + 42));
  return { mode: "backup", battery, estimatedMinutes, since: db.power.since };
}

const ASSIGNABLE_ROLES = ["admin", "doctor", "nurse", "caregiver"];

function publicUser(user) {
  const { password, passwordHash, password_hash, ...safe } = user;
  return safe;
}

export function sessionUser(userId) {
  const user = db.users.find((item) => item.id === userId);
  return user ? publicUser(user) : null;
}

function requireAdmin(actor) {
  const fresh = db.users.find((user) => user.id === actor?.id);
  if (!fresh || fresh.role !== "admin" || fresh.status !== "approved") return null;
  return fresh;
}

function mapDbUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    department: row.department || "",
    role: row.role,
    status: row.status,
    caregiverId: row.caregiver_id || undefined,
    assignedPatientIds: row.assigned_patient_ids || [],
    passwordHash: row.password_hash,
  };
}

async function reloadUsers() {
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.department, u.status, u.caregiver_id,
      COALESCE(
        (SELECT role_code FROM user_roles WHERE user_id = u.id AND role_code <> 'pending' LIMIT 1),
        'pending'
      ) AS role,
      COALESCE(
        (SELECT array_agg(patient_id) FROM patient_assignments WHERE user_id = u.id),
        '{}'
      ) AS assigned_patient_ids
    FROM users u
  `);
  db.users = rows.map(mapDbUser);
}

const SEED_USERS = [
  ["admin", "Dr. Meera Shah", "admin@wardzero.care", "+91 98400 10001", "admin123", "Administration", "admin", "approved", null, ["rahul", "priya", "sita"]],
  ["doctor", "Dr. Kabir Iyer", "doctor@wardzero.care", "+91 98400 10002", "doctor123", "General Ward", "doctor", "approved", null, ["rahul", "priya"]],
  ["nurse", "Nurse Sana Reddy", "nurse@wardzero.care", "+91 98400 10003", "nurse123", "ICU", "nurse", "approved", null, ["rahul", "sita"]],
  ["amit-user", "Amit Kumar", "amit@wardzero.care", "+91 98400 11021", "care123", "General Ward", "caregiver", "approved", "amit", ["rahul"]],
  ["pending-demo", "Riya Joshi", "pending@wardzero.care", "+91 98400 10009", "pending123", "Emergency", "pending", "pending", null, []],
];

const SEED_ROLES = [
  ["pending", "Pending user", "Account is waiting for an admin to assign a role."],
  ["admin", "Admin", "Manages users, roles, devices, and system settings."],
  ["doctor", "Doctor", "Views assigned patients, alerts, health insights, and care notes."],
  ["nurse", "Nurse", "Monitors assigned patients, updates observations, and manages care notes."],
  ["caregiver", "Caregiver", "Sees only the information shared for assigned patients."],
];

async function ensureCoreTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      department TEXT,
      role TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'pending',
      caregiver_id TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      room TEXT NOT NULL,
      condition TEXT,
      caregiver_id TEXT,
      hr NUMERIC,
      spo2 NUMERIC,
      temp NUMERIC,
      systolic INTEGER,
      diastolic INTEGER
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      patient_id TEXT REFERENCES patients(id),
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      acknowledged BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function initDatabase() {
  await ensureCoreTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);
  for (const [code, label, description] of SEED_ROLES) {
    await pool.query(
      `INSERT INTO roles (code, label, description) VALUES ($1,$2,$3)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description`,
      [code, label, description],
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_code TEXT NOT NULL REFERENCES roles(code),
      PRIMARY KEY (user_id, role_code)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_assignments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      UNIQUE (user_id, patient_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_notes (
      id TEXT PRIMARY KEY,
      patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO user_roles (user_id, role_code)
    SELECT id, role FROM users
    WHERE role IN ('admin', 'doctor', 'nurse', 'caregiver')
    ON CONFLICT DO NOTHING
  `);
  for (const patient of db.patients) {
    const vitals = patient.vitals;
    await pool.query(
      `INSERT INTO patients (id, name, age, room, condition, caregiver_id, hr, spo2, temp, systolic, diastolic)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [patient.id, patient.name, patient.age, patient.room, patient.condition, patient.caregiverId, vitals.hr, vitals.spo2, vitals.temp, vitals.systolic, vitals.diastolic],
    );
  }
  for (const [id, name, email, phone, password, department, role, status, caregiverId, patientIds] of SEED_USERS) {
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO users (id, name, email, phone, password_hash, department, role, status, caregiver_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [id, name, email, phone, passwordHash, department, role, status, caregiverId],
    );
    if (!inserted.rows[0]) continue;
    const userId = inserted.rows[0].id;
    if (role !== "pending") {
      await pool.query(
        `INSERT INTO user_roles (user_id, role_code) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, role],
      );
    }
    for (const patientId of patientIds) {
      await pool.query(
        `INSERT INTO patient_assignments (id, user_id, patient_id) VALUES ($1,$2,$3) ON CONFLICT (user_id, patient_id) DO NOTHING`,
        [`${userId}:${patientId}`, userId, patientId],
      );
    }
  }
  await reloadUsers();
  await ensureClinicalTables();
  await hydrateClinical(db);
}

export async function login(email, password) {
  const user = db.users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user) return null;
  const matches = await bcrypt.compare(String(password || ""), user.passwordHash || "");
  if (!matches) return null;
  return publicUser(user);
}

export async function signup(input) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const department = String(input.department || "").trim();
  if (!name || !email || !phone || !password) return { error: "Name, email, phone, and password are required.", status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address.", status: 400 };
  if (phone.replace(/\D/g, "").length < 8) return { error: "Enter a valid phone number.", status: 400 };
  if (password.length < 6) return { error: "Password must be at least 6 characters.", status: 400 };
  if (db.users.some((user) => user.email.toLowerCase() === email)) return { error: "This email is already registered. Log in with the same password.", status: 400 };
  const passwordHash = await bcrypt.hash(password, 10);
  const id = uid("user");
  try {
    await pool.query(
      `INSERT INTO users (id, name, email, phone, password_hash, department, role, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending','pending')`,
      [id, name, email, phone, passwordHash, department],
    );
  } catch (error) {
    if (error.code === "23505") return { error: "This email is already registered. Log in with the same password.", status: 400 };
    throw error;
  }
  const user = { id, name, email, phone, department, role: "pending", status: "pending", assignedPatientIds: [], passwordHash };
  db.users.push(user);
  return { user: publicUser(user) };
}

async function ensureResetTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      code_hash text NOT NULL,
      expires_at bigint NOT NULL,
      used boolean NOT NULL DEFAULT false
    )
  `);
}

function hashResetCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export async function requestPasswordReset(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const user = db.users.find((item) => item.email.toLowerCase() === normalized);
  if (!user) return { error: "No account uses that email.", status: 404 };
  await ensureResetTable();
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = Date.now() + 15 * 60 * 1000;
  await pool.query("UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false", [user.id]);
  await pool.query(
    "INSERT INTO password_resets (id, user_id, code_hash, expires_at, used) VALUES ($1,$2,$3,$4,false)",
    [uid("reset"), user.id, hashResetCode(code), expiresAt],
  );
  return { email: user.email, code, expiresInMinutes: 15 };
}

export async function resetPassword(email, code, password) {
  const normalized = String(email || "").trim().toLowerCase();
  const next = String(password || "");
  if (next.length < 6) return { error: "Password must be at least 6 characters.", status: 400 };
  const user = db.users.find((item) => item.email.toLowerCase() === normalized);
  if (!user) return { error: "That reset code is not valid.", status: 400 };
  await ensureResetTable();
  const { rows } = await pool.query(
    `SELECT id, code_hash FROM password_resets
     WHERE user_id = $1 AND used = false AND expires_at > $2
     ORDER BY expires_at DESC LIMIT 1`,
    [user.id, Date.now()],
  );
  const row = rows[0];
  const given = hashResetCode(String(code || "").trim());
  const matches = row && row.code_hash.length === given.length && crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(given));
  if (!matches) return { error: "That reset code is not valid or it has expired.", status: 400 };
  const passwordHash = await bcrypt.hash(next, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user.id]);
  await pool.query("UPDATE password_resets SET used = true WHERE id = $1", [row.id]);
  user.passwordHash = passwordHash;
  return { ok: true };
}

export async function listAccounts(actor) {
  if (!requireAdmin(actor)) return { error: "Only an approved admin can manage users.", status: 403 };
  await reloadUsers();
  return { accounts: db.users.map(publicUser) };
}

export async function assignAccount(actorUser, userId, patch) {
  const actor = requireAdmin(actorUser);
  if (!actor) return { error: "Only an approved admin can assign roles.", status: 403 };
  const user = db.users.find((item) => item.id === userId);
  if (!user) return { error: "User not found.", status: 404 };
  const role = String(patch.role || "");
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: "Assign Admin, Doctor, Nurse, or Caregiver.", status: 400 };
  const ids = (Array.isArray(patch.assignedPatientIds) ? patch.assignedPatientIds : [])
    .filter((id) => db.patients.some((patient) => patient.id === id));
  if (role !== "admin" && ids.length === 0) return { error: "Assign at least one patient for this role.", status: 400 };
  if (user.id === actor.id && role !== "admin") {
    const admins = db.users.filter((item) => item.role === "admin" && item.status === "approved");
    if (admins.length <= 1) return { error: "Keep at least one approved admin.", status: 400 };
  }
  const department = patch.department !== undefined ? String(patch.department || "").trim() : user.department;
  const assigned = role === "admin" ? db.patients.map((patient) => patient.id) : ids;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET role = $1, status = 'approved', department = $2 WHERE id = $3`,
      [role, department, userId],
    );
    await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
    await client.query(`INSERT INTO user_roles (user_id, role_code) VALUES ($1,$2)`, [userId, role]);
    await client.query(`DELETE FROM patient_assignments WHERE user_id = $1`, [userId]);
    for (const patientId of assigned) {
      await client.query(
        `INSERT INTO patient_assignments (id, user_id, patient_id) VALUES ($1,$2,$3)`,
        [`${userId}:${patientId}`, userId, patientId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  await reloadUsers();
  return { accounts: db.users.map(publicUser) };
}

export async function resetDemo() {
  await clearClinical();
  db = createDb();
  await reloadUsers();
  await hydrateClinical(db);
  return getPublicState();
}

export async function setVitals(patientId, patch, source = "manual") {
  const patient = findPatient(patientId);
  if (!patient) return null;
  patient.vitals = {
    ...patient.vitals,
    ...numericPatch(patch),
  };
  appendHistory(patient);
  const reading = pushReading(patient, source);
  await saveTelemetry(reading, !db.internet);
  await saveVitals(patient, source);
  await raiseFromRisk(patient);
  if (source !== "device") {
    await writeAudit(db, { actor: source, action: "record_vitals", subject: patient.id, detail: `SpO₂ ${patient.vitals.spo2}%, heart rate ${patient.vitals.hr}` });
  }
  return getPublicState();
}

function numericPatch(patch) {
  const next = {};
  for (const key of ["hr", "spo2", "temp", "systolic", "diastolic"]) {
    if (patch[key] !== undefined && patch[key] !== "") next[key] = Number(patch[key]);
  }
  return next;
}

export async function addPatient(input) {
  const name = String(input.name || "").trim();
  const age = Number(input.age);
  const room = String(input.room || "").trim();
  if (!name || !room || !age) return { error: "Name, age, and room are required." };
  const caregiverId = db.caregivers.some((person) => person.id === input.caregiverId) ? input.caregiverId : "amit";
  const vitals = { hr: 80, spo2: 97, temp: 36.7, systolic: 120, diastolic: 78 };
  const patient = createPatient(Date.now(), {
    id: uid("pt"),
    name,
    age,
    room,
    caregiverId,
    condition: input.condition || "Home monitoring",
    vitals,
    baseline: { hr: vitals.hr, spo2: vitals.spo2, temp: vitals.temp },
  });
  db.patients.push(patient);
  await pool.query(
    `INSERT INTO patients (id, name, age, room, condition, caregiver_id, hr, spo2, temp, systolic, diastolic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [patient.id, name, age, room, patient.condition, caregiverId, vitals.hr, vitals.spo2, vitals.temp, vitals.systolic, vitals.diastolic],
  );
  return getPublicState();
}

export async function acknowledgeAlert(alertId, actor = "amit") {
  const alert = db.alerts.find((item) => item.id === alertId);
  if (!alert) return null;
  const actorName = typeof actor === "string" ? actor : (actor.email || actor.name || "staff");
  const caregiverId = typeof actor === "string" ? actor : (actor.caregiverId || "amit");
  alert.acknowledged = true;
  alert.acknowledgedAt = Date.now();
  alert.acknowledgedBy = actorName;
  const caregiver = db.caregivers.find((person) => person.id === caregiverId);
  if (caregiver && db.settings.auditLogging) {
    const event = { id: uid("ev"), at: Date.now(), label: "Alert acknowledged", kind: "ack" };
    caregiver.timeline.push(event);
    await saveCareEvent(caregiver.id, event);
  }
  await upsertAlert(alert, false);
  await writeAudit(db, { actor: actorName, action: "acknowledge_alert", subject: alert.id, detail: alert.title });
  return getPublicState();
}

export async function caregiverAction(caregiverId, kind, actor = "staff") {
  const caregiver = db.caregivers.find((person) => person.id === caregiverId);
  if (!caregiver) return null;
  const labels = {
    checkin: "Caregiver checked in",
    checkout: "Caregiver checked out",
    medication: "Medication verified",
    equipment: "Oxygen equipment checked",
    interaction: "Patient interaction",
    notes: "Notes updated",
    assessed: "Patient checked",
    doctor: "Doctor contact requested",
  };
  caregiver.presence = kind === "checkout" ? "away" : "present";
  if (kind === "checkin") caregiver.checkIn = Date.now();
  const event = { id: uid("ev"), at: Date.now(), label: labels[kind] || "Care update", kind };
  caregiver.timeline.push(event);
  await saveCareEvent(caregiver.id, event);
  await saveCaregiverStatus(caregiver);
  await writeAudit(db, { actor, action: "caregiver_action", subject: caregiverId, detail: event.label });
  return getPublicState();
}

export async function setFlags(patientId, flags) {
  const patient = findPatient(patientId);
  if (!patient) return null;
  patient.flags = { ...patient.flags, ...flags };
  await saveFlags(patient);
  await raiseFromRisk(patient);
  return getPublicState();
}

export async function createNote(input) {
  const patient = findPatient(input.patientId);
  if (!patient) return { error: "Patient not found." };
  const text = String(input.text || "").trim();
  if (!text) return { error: "Write a note before analyzing it." };
  const analysis = analyzeNote(text, input.language);
  const note = {
    id: uid("note"),
    patientId: patient.id,
    caregiverId: input.caregiverId || patient.caregiverId,
    language: input.language || "Hindi",
    text,
    analysis,
    at: Date.now(),
    onTimeline: false,
  };
  db.notes.unshift(note);
  await saveNote(note);
  patient.flags = {
    ...patient.flags,
    weakness: patient.flags.weakness || analysis.findings.some((item) => item.id === "weakness"),
    breathing: patient.flags.breathing || analysis.findings.some((item) => item.id === "breathing"),
    text,
  };
  await saveFlags(patient);
  await raiseFromRisk(patient);
  if (analysis.findings.length) {
    const alert = {
      id: uid("alert"),
      severity: "info",
      title: "Caregiver note",
      body: `${patient.name}: ${analysis.findings.map((item) => item.label).join(", ")}.`,
      patientId: patient.id,
      at: Date.now(),
      acknowledged: false,
      reasons: analysis.findings.map((item) => item.label),
    };
    db.alerts.unshift(alert);
    await upsertAlert(alert, false);
  }
  return { state: getPublicState(), note };
}

export async function addNoteToTimeline(noteId) {
  const note = db.notes.find((item) => item.id === noteId);
  if (!note) return null;
  note.onTimeline = true;
  const caregiver = db.caregivers.find((person) => person.id === note.caregiverId);
  if (caregiver) {
    const event = { id: uid("ev"), at: Date.now(), label: "Multilingual note added to timeline", kind: "notes" };
    caregiver.timeline.push(event);
    await saveCareEvent(caregiver.id, event);
  }
  await saveNote(note);
  await writeAudit(db, { action: "note_timeline", subject: note.id, detail: note.text.slice(0, 120) });
  return getPublicState();
}

export async function setInternet(online) {
  if (!online) {
    db.internet = false;
    db.restoredAt = 0;
    await saveSystem(db);
    await writeAudit(db, { action: "internet_offline", detail: "Link marked offline. New readings stay in the queue." });
    return getPublicState();
  }
  const total = db.queue.length;
  for (const item of db.queue) {
    item.synced = true;
    db.readings.unshift(item);
    await saveTelemetry(item, false);
  }
  db.queue = [];
  await replaceQueue([]);
  db.readings = db.readings.slice(0, 40);
  db.internet = true;
  db.restoredAt = Date.now();
  db.lastSync = { done: total, total, at: Date.now() };
  await saveSystem(db);
  await writeAudit(db, { action: "internet_restored", detail: `${total} queued readings synchronized.` });
  return getPublicState();
}

export async function burstOffline() {
  db.internet = false;
  db.restoredAt = 0;
  db.queue = [];
  const stamps = [97, 96, 95, 95, 94, 93, 93, 92, 92, 91, 90, 89];
  for (const [index, spo2] of stamps.entries()) {
    db.queue.push({
      id: uid("rd"),
      patientId: "rahul",
      hr: 82 + index * 2,
      spo2,
      temp: roundTo(36.8 + index * 0.08, 1),
      systolic: 120,
      diastolic: 80,
      at: Date.now() - (12 - index) * 15000,
      source: "local-buffer",
      synced: false,
    });
  }
  await replaceQueue(db.queue);
  await saveSystem(db);
  await writeAudit(db, { action: "offline_buffer", detail: `${db.queue.length} readings held on the local buffer.` });
  return getPublicState();
}

export async function setPower(mode) {
  if (mode === "backup") db.power = { mode: "backup", since: Date.now(), battery: 76 };
  else db.power = { mode: "mains", since: Date.now(), battery: 100 };
  await saveSystem(db);
  await writeAudit(db, { action: "power_mode", detail: db.power.mode });
  return getPublicState();
}

export function feedEnabled() {
  return db.feedRunning !== false && process.env.DEVICE_FEED !== "off";
}

export async function setFeedRunning(running) {
  db.feedRunning = Boolean(running);
  await writeAudit(db, { action: "sensor_feed", detail: db.feedRunning ? "Sensor simulation started." : "Sensor simulation stopped." });
  return getPublicState();
}

export async function markMedication(id, status) {
  const item = (db.medications || []).find((row) => row.id === id);
  if (!item) return null;
  if (status !== "taken" && status !== "missed" && status !== "due") return { error: "Status must be taken, missed, or due.", status: 400 };
  item.status = status;
  item.updatedAt = Date.now();
  await saveMedication(item);
  await writeAudit(db, { action: "medication", subject: item.patientId, detail: `${item.name} marked ${status}.` });
  return getPublicState();
}

export async function updateSettings(patch) {
  db.settings = { ...db.settings, ...patch };
  await saveSystem(db);
  await writeAudit(db, { action: "settings", detail: Object.keys(patch).join(", ") });
  return getPublicState();
}

export async function helpRequest(patientId) {
  const patient = findPatient(patientId);
  if (!patient) return null;
  const alert = {
    id: uid("alert"),
    severity: "critical",
    title: "PATIENT HELP REQUEST",
    body: `${patient.name} pressed I Need Help.`,
    patientId: patient.id,
    at: Date.now(),
    acknowledged: false,
    reasons: ["Patient-initiated help request"],
    score: assess(patient).score,
    vitals: { ...patient.vitals },
  };
  db.alerts.unshift(alert);
  await upsertAlert(alert, true);
  return getPublicState();
}

export async function contactDoctor(patientId) {
  const patient = findPatient(patientId);
  if (!patient) return null;
  const caregiver = db.caregivers.find((person) => person.id === patient.caregiverId);
  if (caregiver) {
    const event = { id: uid("ev"), at: Date.now(), label: "Doctor contact requested", kind: "doctor" };
    caregiver.timeline.push(event);
    await saveCareEvent(caregiver.id, event);
  }
  const phone = await doctorPhone(patient.id);
  const smsBody = `WardZero: ${patient.name} needs a doctor review. This is decision support, not a diagnosis.`;
  const call = await reachDoctor(phone, smsBody);
  const alert = {
    id: uid("alert"),
    severity: "info",
    title: "Doctor contact requested",
    body: call.detail,
    patientId: patient.id,
    at: Date.now(),
    acknowledged: false,
    reasons: ["Manual escalation"],
  };
  db.alerts.unshift(alert);
  await upsertAlert(alert, false);
  await writeAudit(db, { action: "contact_doctor", subject: patient.id, detail: `${call.detail} ${phone}` });
  return { state: getPublicState(), call };
}

export function deviceSample(patientId) {
  const patient = findPatient(patientId);
  if (!patient) return null;
  return {
    hr: patient.vitals.hr,
    spo2: patient.vitals.spo2,
    temp: patient.vitals.temp,
    systolic: patient.vitals.systolic,
    diastolic: patient.vitals.diastolic,
    baselineHr: patient.baseline.hr,
    baselineSpo2: patient.baseline.spo2,
    baselineTemp: patient.baseline.temp,
  };
}

export async function ingestReading(token, body) {
  if (!process.env.DEVICE_INGEST_TOKEN || token !== process.env.DEVICE_INGEST_TOKEN) {
    return { error: "Device token is invalid.", status: 401 };
  }
  const patient = findPatient(body.patientId);
  if (!patient) return { error: "Patient not found.", status: 404 };
  const device = db.devices.find((item) => item.id === body.deviceId || item.name === body.deviceName);
  if (device) {
    device.status = "online";
    device.seenAt = Date.now();
    await saveDevice(device);
  }
  const state = await setVitals(patient.id, body, "device");
  return state ? { ok: true } : { error: "Reading was not stored.", status: 400 };
}

async function doctorPhone(patientId) {
  const { rows } = await pool.query(
    `SELECT u.phone FROM users u
     JOIN user_roles ur ON ur.user_id = u.id AND ur.role_code = 'doctor'
     JOIN patient_assignments pa ON pa.user_id = u.id AND pa.patient_id = $1
     WHERE u.phone IS NOT NULL AND u.phone <> ''
     LIMIT 1`,
    [patientId],
  );
  return rows[0]?.phone || "+91 98400 10002";
}
