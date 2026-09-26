import { api } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function subscribeThisPhone() {
  const registration = await navigator.serviceWorker.register("/sw.js");
  const { publicKey } = await api("/push/vapid");
  if (!publicKey) throw new Error("Phone push is not configured on the server.");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api("/push/subscribe", { method: "POST", body: subscription.toJSON() });
}

export async function resumePhoneAlerts() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;
  await subscribeThisPhone();
  return true;
}

export async function enablePhoneAlerts() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser cannot receive phone notifications.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Allow notifications so alerts can reach this phone.");
  await subscribeThisPhone();
}

function smsLink(phone, text) {
  const body = encodeURIComponent(text || "WardZero: a patient needs a doctor review.");
  const joiner = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  return `sms:${phone}${joiner}body=${body}`;
}

export function dialDoctor(call) {
  if (call?.channel === "handset" && call.phone) window.location.href = `tel:${call.phone}`;
}

export function textDoctor(call) {
  if (call?.smsStatus === "sent" || !call?.phone) return;
  window.location.href = smsLink(call.phone, call.smsBody);
}
