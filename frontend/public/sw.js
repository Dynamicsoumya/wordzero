self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const actions = data.phone
    ? [
        { action: "call", title: "Call doctor" },
        { action: "text", title: "Text doctor" },
      ]
    : [];
  event.waitUntil(self.registration.showNotification(data.title || "WardZero alert", {
    body: data.body || "A patient alert needs attention.",
    data,
    actions,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const phone = data.phone || "";
  if (event.action === "call" && phone) {
    event.waitUntil(clients.openWindow(`tel:${phone}`));
    return;
  }
  if (event.action === "text" && phone) {
    const body = encodeURIComponent(data.smsBody || data.body || "WardZero patient alert");
    const joiner = /iPhone|iPad|iPod/i.test(self.navigator.userAgent || "") ? "&" : "?";
    event.waitUntil(clients.openWindow(`sms:${phone}${joiner}body=${body}`));
    return;
  }
  const url = new URL(data.url || "/app/alerts", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const open = windows.find((window) => window.url.startsWith(self.location.origin));
    if (open) {
      open.navigate(url);
      return open.focus();
    }
    return clients.openWindow(url);
  }));
});
