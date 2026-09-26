# Architecture

```text
React (Vite, :5173)
        │  cookie session, /api proxied to the API
        ▼
Express ward API (:8080)
        │
        ├── PostgreSQL
        │     accounts, assignments, vitals, alerts, notes,
        │     devices, equipment, queue, power, audit, password resets
        │
        ├── risk.js heuristic
        │     same rules as ml/predict.py
        │     Low / Medium / High plus a 24–48 hour window
        │     from the recent reading trend
        │
        ├── device feed
        │     about every 20s → POST /api/ingest/readings
        │
        └── notify.js
              browser push when permission was granted
              Twilio call and SMS only when the three TWILIO_* values are set

iot-simulator/simulator.py  →  POST /api/ingest/readings
                               header x-device-token
```

One Node process serves the API. It keeps a working copy of the ward in memory and writes clinical and ward changes to PostgreSQL. A restart reloads that state from the database.

Sign-in is a JWT in the httpOnly cookie `wardzero_token`. The browser does not store the token in `localStorage`. `GET /api/state` returns only the patients assigned to that user. Admin receives the audit list. Other roles receive an empty audit list.

There is no separate model service. `backend/src/risk.js` and `ml/predict.py` implement the same explainable rule. The screen states that this is not a validated clinical model. Caregiver notes are keyword matches in Hindi and English, not a measured accuracy score.

Device ingest does not use the login cookie. The simulator and the in-process feed both send `x-device-token`. Readings from that path are stored as source `device`.
