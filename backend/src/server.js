import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clearAuthCookie, requireAdmin, requireApproved, requireAuth, requireRole, setAuthCookie } from "./auth.js";
import { startDeviceFeed } from "./deviceFeed.js";
import { configurePush, pushPublicKey, saveSubscription } from "./notify.js";
import {
  acknowledgeAlert,
  addNoteToTimeline,
  addPatient,
  burstOffline,
  caregiverAction,
  contactDoctor,
  createNote,
  getPublicState,
  helpRequest,
  deviceSample,
  ingestReading,
  initDatabase,
  assignAccount,
  listAccounts,
  login,
  requestPasswordReset,
  resetPassword,
  resetDemo,
  scopeStateForUser,
  signup,
  setFlags,
  setInternet,
  setPower,
  setVitals,
  setFeedRunning,
  markMedication,
  updateSettings,
} from "./store.js";

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());

const ok = (res, data) => res.json(data);
const fail = (res, status, error) => res.status(status).json({ error });

function send(req, res, payload, missing = "Not found.") {
  if (!payload) return fail(res, 404, missing);
  if (payload.error) return fail(res, payload.status || 400, payload.error);
  if (payload.state) return ok(res, { ...payload, state: scopeStateForUser(req.user, payload.state) });
  if (payload.patients) return ok(res, scopeStateForUser(req.user, payload));
  return ok(res, payload);
}

app.get("/api/health", (_req, res) => ok(res, { ok: true, product: "WardZero" }));

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = await login(req.body.email, req.body.password);
    if (!user) return fail(res, 401, "Email or password is incorrect.");
    setAuthCookie(res, user, Boolean(req.body.remember));
    return ok(res, { user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/forgot", async (req, res, next) => {
  try {
    return send(req, res, await requestPasswordReset(req.body?.email));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset", async (req, res, next) => {
  try {
    return send(req, res, await resetPassword(req.body?.email, req.body?.code, req.body?.password));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  return ok(res, { ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => ok(res, { user: req.user }));

app.get("/api/push/vapid", requireAuth, (_req, res) => ok(res, { publicKey: pushPublicKey() }));

app.post("/api/push/subscribe", requireAuth, async (req, res, next) => {
  try {
    const result = await saveSubscription(req.user.id, req.body || {});
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const result = await signup(req.body || {});
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/state", requireAuth, (req, res) => ok(res, getPublicState(req.user)));

app.post("/api/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const result = await listAccounts(req.user);
    if (result?.error) return fail(res, result.status || 403, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await assignAccount(req.user, req.params.id, req.body || {});
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/demo/reset", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await resetDemo());
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await addPatient(req.body || {}), "Name, age, and room are required.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients/:id/vitals", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await setVitals(req.params.id, req.body || {}, req.body?.source || "api"), "Patient not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients/:id/flags", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await setFlags(req.params.id, req.body || {}), "Patient not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients/:id/help", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await helpRequest(req.params.id), "Patient not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients/:id/doctor", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await contactDoctor(req.params.id), "Patient not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/alerts/:id/acknowledge", requireRole("admin", "doctor", "nurse"), async (req, res, next) => {
  try {
    return send(req, res, await acknowledgeAlert(req.params.id, req.user), "Alert not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/caregivers/:id/action", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await caregiverAction(req.params.id, req.body?.kind || "interaction", req.user.email), "Caregiver not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/notes", requireRole("admin", "doctor", "nurse"), async (req, res, next) => {
  try {
    return send(req, res, await createNote(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/notes/:id/timeline", requireRole("admin", "doctor", "nurse"), async (req, res, next) => {
  try {
    return send(req, res, await addNoteToTimeline(req.params.id), "Note not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/ingest/readings", async (req, res, next) => {
  try {
    const result = await ingestReading(req.get("x-device-token"), req.body || {});
    if (result?.error) return fail(res, result.status || 400, result.error);
    return ok(res, result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/system/internet", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await setInternet(Boolean(req.body?.online)));
  } catch (error) {
    next(error);
  }
});
app.post("/api/system/offline-burst", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await burstOffline());
  } catch (error) {
    next(error);
  }
});
app.post("/api/system/power", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await setPower(req.body?.mode === "backup" ? "backup" : "mains"));
  } catch (error) {
    next(error);
  }
});
app.post("/api/system/feed", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await setFeedRunning(req.body?.running !== false));
  } catch (error) {
    next(error);
  }
});

app.post("/api/medications/:id", requireApproved, async (req, res, next) => {
  try {
    return send(req, res, await markMedication(req.params.id, req.body?.status), "Medication not found.");
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings", requireAdmin, async (req, res, next) => {
  try {
    return send(req, res, await updateSettings(req.body || {}));
  } catch (error) {
    next(error);
  }
});

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist");
const indexFile = path.join(web, "index.html");
if (fs.existsSync(indexFile)) {
  app.use(express.static(web));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(indexFile);
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Ward API failed" });
});

const port = Number(process.env.PORT || process.env.WARDZERO_PORT || 8080);
initDatabase()
  .then(() => {
    const server = app.listen(port, () => {
      configurePush();
      startDeviceFeed(deviceSample);
      console.log(`WardZero API listening on http://localhost:${port}`);
      console.log("PostgreSQL connected: wardzero");
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Close the other WardZero terminal, then run npm run dev once.`);
        process.exit(1);
      }
      throw error;
    });
  })
  .catch((error) => {
    console.error("PostgreSQL connection failed.", error.message);
    process.exit(1);
  });
