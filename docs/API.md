# WardZero API

Base URL: `http://localhost:8080`

Patients, devices, and readings in this build are simulated. Every route except health, signup, login, forgot-password, reset, and device ingest expects the `wardzero_token` httpOnly cookie from `POST /api/auth/login`.

## Auth

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Liveness. `{ ok, product }` |
| POST | `/api/auth/signup` | Public | Create a pending account. `{ name, email, phone, password, department }` |
| POST | `/api/auth/login` | Public | `{ email, password, remember }`. Sets the cookie. Returns `{ user }` |
| POST | `/api/auth/logout` | Public | Clears the cookie |
| GET | `/api/auth/me` | Signed in | Current user |
| POST | `/api/auth/forgot` | Public | `{ email }`. Returns a 15-minute code when the email exists. No mail is sent |
| POST | `/api/auth/reset` | Public | `{ email, code, password }`. Password must be at least 6 characters |

A pending user can sign in, but approved clinical routes stay closed until an admin assigns a role.

## Ward

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/state` | Signed in | Ward snapshot scoped to that user. Includes derived risk. Audit is included for admin only |
| POST | `/api/demo/reset` | Admin | Restore the stable demo ward |
| POST | `/api/patients` | Admin | Add a patient |
| POST | `/api/patients/:id/vitals` | Approved | Store a reading and refresh risk. A `device` source skips the audit row |
| POST | `/api/patients/:id/flags` | Approved | Caregiver-observed flags such as weakness or breathing |
| POST | `/api/patients/:id/help` | Approved | Patient help request. Raises an alert |
| POST | `/api/patients/:id/doctor` | Approved | Ask the assigned doctor. Returns `{ state, call }` |
| POST | `/api/alerts/:id/acknowledge` | Admin, doctor, nurse | Acknowledge an alert |
| POST | `/api/caregivers/:id/action` | Approved | `{ kind }` timeline event |
| POST | `/api/notes` | Admin, doctor, nurse | Match symptom words in a Hindi or English note |
| POST | `/api/notes/:id/timeline` | Admin, doctor, nurse | Attach that note to the patient timeline |
| POST | `/api/system/internet` | Admin | `{ online: true/false }` |
| POST | `/api/system/offline-burst` | Admin | Queue local events and drop the link |
| POST | `/api/system/power` | Admin | `{ mode: "mains" }` or `{ mode: "backup" }` |
| POST | `/api/settings` | Admin | Notification and safety toggles |
| POST | `/api/admin/users` | Admin | List accounts |
| POST | `/api/admin/users/:id` | Admin | Assign role, department, status, and patients |

`call` from the doctor route is `{ phone, channel, status, detail, smsBody, smsStatus }`. Without Twilio, `channel` is `handset` and the browser opens `tel:` or `sms:`. With `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`, the server places the call and SMS and does not ask the browser to dial.

## Devices and phone alerts

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/ingest/readings` | Device token | `{ patientId, deviceName or deviceId, vitals }`. Header `x-device-token` must match `DEVICE_INGEST_TOKEN`. No cookie |
| GET | `/api/push/vapid` | Signed in | Public VAPID key |
| POST | `/api/push/subscribe` | Signed in | Save a browser push subscription |

The API also posts a sensor sample about every 20 seconds for Rahul, Priya, and Sita, unless `DEVICE_FEED=off`.

## Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@wardzero.care | admin123 |
| Doctor | doctor@wardzero.care | doctor123 |
| Nurse | nurse@wardzero.care | nurse123 |
| Caregiver | amit@wardzero.care | care123 |
| Pending | pending@wardzero.care | pending123 |

Doctor sees Rahul and Priya. Nurse sees Rahul and Sita. Caregiver sees Rahul only.
