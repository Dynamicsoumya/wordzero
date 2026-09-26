import { createRequire } from "module";
import { pool } from "./db.js";

const webpush = createRequire(import.meta.url)("web-push");

const uid = () => `push_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function configurePush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails("mailto:admin@wardzero.care", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
}

export function pushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function saveSubscription(userId, subscription) {
  const keys = subscription?.keys || {};
  if (!subscription?.endpoint || !keys.p256dh || !keys.auth) {
    return { error: "A browser push subscription is required.", status: 400 };
  }
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth_secret)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth_secret = EXCLUDED.auth_secret`,
    [subscription.endpoint, userId, keys.p256dh, keys.auth],
  );
  return { ok: true };
}

export async function notifyAlert(alert) {
  if (!alert.patientId) return;
  const people = await pool.query(
    `SELECT DISTINCT u.id, u.phone FROM users u
     JOIN patient_assignments pa ON pa.user_id = u.id
     WHERE pa.patient_id = $1`,
    [alert.patientId],
  );
  if (twilioReady()) {
    for (const person of people.rows) {
      await textNumber(alert.id, person.phone, `${alert.title}. ${alert.body}`);
    }
  }
  if (!configurePush()) {
    if (!people.rows.length) await recordDispatch(alert.id, null, "push", null, "no-subscriber", "No phone has allowed WardZero notifications for this patient.");
    return;
  }
  const { rows } = await pool.query(
    `SELECT DISTINCT s.endpoint, s.p256dh, s.auth_secret, s.user_id, u.phone
     FROM push_subscriptions s
     JOIN users u ON u.id = s.user_id
     JOIN patient_assignments pa ON pa.user_id = s.user_id
     WHERE pa.patient_id = $1`,
    [alert.patientId],
  );
  if (!rows.length) {
    await recordDispatch(alert.id, null, "push", null, "no-subscriber", "No phone has allowed WardZero notifications for this patient.");
    return;
  }
  const doctor = await pool.query(
    `SELECT u.phone FROM users u
     JOIN user_roles ur ON ur.user_id = u.id AND ur.role_code = 'doctor'
     JOIN patient_assignments pa ON pa.user_id = u.id AND pa.patient_id = $1
     WHERE u.phone IS NOT NULL AND u.phone <> ''
     LIMIT 1`,
    [alert.patientId],
  );
  const phone = String(doctor.rows[0]?.phone || "").replace(/[^\d+]/g, "");
  const payload = JSON.stringify({
    title: `WardZero · ${alert.title}`,
    body: alert.body,
    url: `/app/alerts/${alert.id}`,
    phone,
    smsBody: `${alert.title}. ${alert.body}`,
  });
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_secret } },
        payload,
      );
      await recordDispatch(alert.id, row.user_id, "push", row.phone, "sent", "Delivered to the signed-in phone or browser.");
    } catch (error) {
      const gone = error.statusCode === 404 || error.statusCode === 410;
      if (gone) await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [row.endpoint]);
      await recordDispatch(alert.id, row.user_id, "push", row.phone, "failed", error.message);
    }
  }
}

export async function reachDoctor(phone, message) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  const smsBody = message;
  if (!twilioReady()) {
    return {
      phone: digits,
      channel: "handset",
      status: "ready",
      detail: "Your phone will call the assigned doctor. Text uses your phone's message app.",
      smsBody,
      smsStatus: "handset",
    };
  }
  const result = await twilioCall(digits, message);
  const sms = await sendSms(digits, message);
  await recordDispatch("doctor-call", null, "call", digits, result.status, result.detail);
  await recordDispatch("doctor-call", null, "sms", digits, sms.status, sms.detail);
  return { phone: digits, channel: "call", status: result.status, detail: result.detail, smsBody, smsStatus: sms.status };
}

async function sendSms(to, message) {
  const destination = String(to || "").replace(/[^\d+]/g, "");
  if (!destination) return { status: "failed", detail: "No doctor phone number is stored." };
  const body = new URLSearchParams({ To: destination, From: process.env.TWILIO_FROM, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return response.ok
    ? { status: "sent", detail: "SMS sent." }
    : { status: "failed", detail: "SMS was rejected." };
}

function twilioReady() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

async function twilioCall(to, message) {
  const spoken = String(message || "A WardZero patient needs review.").replace(/[<>&]/g, "");
  const body = new URLSearchParams({
    To: to,
    From: process.env.TWILIO_FROM,
    Twiml: `<Response><Say>${spoken}</Say></Response>`,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) return { status: "failed", detail: "The phone network rejected the call. Use the handset button." };
  return { status: "sent", detail: "A call was placed to the assigned doctor." };
}

async function textNumber(alertId, to, message) {
  const destination = String(to || "").replace(/[^\d+]/g, "");
  if (!twilioReady() || !destination) {
    await recordDispatch(alertId, null, "sms", destination || null, "not-configured", "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM to send SMS.");
    return;
  }
  const body = new URLSearchParams({ To: destination, From: process.env.TWILIO_FROM, Body: message });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  await recordDispatch(alertId, null, "sms", destination, response.ok ? "sent" : "failed", response.ok ? "SMS sent." : "SMS was rejected.");
}

async function recordDispatch(alertId, userId, channel, destination, status, detail) {
  await pool.query(
    `INSERT INTO alert_dispatches (id, alert_id, user_id, channel, destination, status, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [uid(), alertId, userId, channel, destination, status, detail],
  );
}
