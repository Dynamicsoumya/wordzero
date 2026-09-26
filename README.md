# WardZero — Smart Home Hospital

WardZero is a home-care console. Simulated sensors send vitals to the platform, a risk rule explains what changed, and the care team can acknowledge an alert and record a response.

Patients, devices, and readings are simulated. No hardware is required. The risk score is a transparent heuristic, not a diagnosis, and it has no clinical accuracy claim.

## What the demo shows

Sense → Understand → Predict → Alert → Respond

- Sensors stream heart rate, SpO₂, temperature, and blood pressure into PostgreSQL.
- The dashboard shows the focused patient, equipment, and caregiver activity.
- Risk is Low, Medium, or High, with a short reason and a 24–48 hour window projected from the recent reading trend.
- A critical change raises an alert. Admin, doctor, and nurse can acknowledge it.
- Caregiver check-in and activity stay on a timeline.
- If the link drops, readings queue locally and sync when the connection returns. A power cut switches the ward to backup.

## Run

PostgreSQL must already be running, with a database named `wardzero`.

```bash
npm install
npm run install:all
npm run dev
```

Open http://localhost:5173

The API listens on http://localhost:8080. `GET /api/health` returns `{ "ok": true, "product": "WardZero" }`.

Create `backend/.env` before the first start:

```bash
DATABASE_URL=postgres://wardzero:YOUR_PASSWORD@localhost:5432/wardzero
JWT_SECRET=a-long-random-string
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
DEVICE_INGEST_TOKEN=a-long-random-string
```

Optional. Without these, Call doctor opens the phone dialer and Text doctor opens the message app. With all three set, Twilio places the call and SMS.

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
```

`DEVICE_FEED=off` stops the built-in sensor loop. The loop otherwise posts a reading about every 20 seconds.

Sign-in uses an httpOnly cookie. A new signup stays pending until an admin assigns Admin, Doctor, Nurse, or Caregiver. Forgot password shows a one-time code on the screen, because this ward has no mail server. The code expires in 15 minutes.

## Accounts

| Role | Email | Password | What they see |
| --- | --- | --- | --- |
| Admin | admin@wardzero.care | admin123 | All patients, devices, users, and settings |
| Doctor | doctor@wardzero.care | doctor123 | Rahul and Priya, insights, and notes |
| Nurse | nurse@wardzero.care | nurse123 | Rahul and Sita, and notes |
| Caregiver | amit@wardzero.care | care123 | Rahul only |
| Pending | pending@wardzero.care | pending123 | Waiting screen until an admin assigns a role |

## Demo story

Sign in as admin. Use the sidebar. There is no separate walkthrough button.

1. **Overview** shows patient counts, high-risk patients, active alerts, and caregivers on duty.
2. **Live Monitoring** shows heart rate, SpO₂, temperature, blood pressure, and an estimated respiratory rate.
3. **AI Risk Prediction** shows Low, Medium, or High, with the reason. The score is not a validated clinical model.
4. **Alerts & Emergencies** is where an open alert is acknowledged.
5. **Visit & Attendance** records a check-in or check-out.
6. **Patient Care Notes** matches a Hindi or English note.
7. **Device & IoT Simulator** starts or stops the sensor feed, and can drop the link so queued readings sync when it returns.

You can also post readings yourself. The simulator reads `DEVICE_INGEST_TOKEN` from the environment or from `backend/.env`.

```bash
python iot-simulator/simulator.py --scenario deteriorate --once
```

The same heuristic can be run from the command line. It is not a trained model.

```bash
python ml/predict.py --spo2 89 --hr 108 --temp 37.8 --weakness --breathing
```

## Layout

- `frontend` — React console for admin, doctor, nurse, and caregiver
- `backend` — Express API, PostgreSQL persistence, sensor feed, and alerts
- `ml` — the same risk heuristic, plus a synthetic CSV that is not for metric claims
- `iot-simulator` — posts vitals to `POST /api/ingest/readings`
- `docs/API.md` — route notes

## Clinical safety

WardZero is decision support. It does not diagnose, prescribe, or replace a clinician. The on-screen disclaimer says the window is a projection of the recent reading trend, not a validated clinical model. Caregiver notes match symptom words in Hindi and English. The match is not an accuracy score.

Phone notifications appear only after the browser allows them. A Twilio trial can text and call only a verified number. An unconfigured Twilio account never claims that an SMS was sent.
