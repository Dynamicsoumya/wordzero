export const ROLE_LABEL = {
  admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  caregiver: "Caregiver",
  pending: "Pending user",
};

export const CLINICAL_ROLES = ["admin", "doctor", "nurse", "caregiver"];

const FEATURES = {
  dashboard: CLINICAL_ROLES,
  patients: CLINICAL_ROLES,
  monitor: CLINICAL_ROLES,
  alerts: CLINICAL_ROLES,
  insights: ["admin", "doctor"],
  notes: ["admin", "doctor", "nurse"],
  devices: ["admin"],
  users: ["admin"],
  settings: ["admin"],
  caregivers: CLINICAL_ROLES,
  attendance: CLINICAL_ROLES,
  medications: CLINICAL_ROLES,
  reports: ["admin", "doctor", "nurse"],
  audit: ["admin"],
  acknowledge: ["admin", "doctor", "nurse"],
  addPatient: ["admin"],
  observations: ["admin", "nurse"],
};

export function can(user, feature) {
  if (!user || user.status === "pending" || user.role === "pending") return false;
  return (FEATURES[feature] || []).includes(user.role);
}

export function scopeState(state, user) {
  if (!state) return state;
  if (user?.role === "admin" && user.status !== "pending") return state;
  const ids = new Set(user?.assignedPatientIds || []);
  return {
    ...state,
    patients: state.patients.filter((patient) => ids.has(patient.id)),
    alerts: state.alerts.filter((alert) => ids.has(alert.patientId)),
    readings: state.readings.filter((reading) => ids.has(reading.patientId)),
    equipment: state.equipment.filter((item) => ids.has(item.patientId)),
    notes: (state.notes || []).filter((note) => ids.has(note.patientId)),
    devices: state.devices.filter((device) => ids.has(device.scope)),
    medications: (state.medications || []).filter((item) => ids.has(item.patientId)),
    caregivers: (state.caregivers || []).filter((person) => state.patients.some((patient) => ids.has(patient.id) && patient.caregiverId === person.id)),
  };
}
