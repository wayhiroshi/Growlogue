/* global self */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Growlogue",
    body: "執事からお知らせがございます。",
    url: "/home",
    tag: "growlogue"
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.tag,
      data: { url: payload.url },
      lang: "ja"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url;
  const path =
    typeof requestedUrl === "string" && requestedUrl.startsWith("/")
      ? requestedUrl
      : "/home";
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const matchingClient = clients.find(
          (client) => new URL(client.url).origin === self.location.origin
        );
        if (matchingClient) {
          return matchingClient
            .navigate(targetUrl)
            .then((client) => client?.focus());
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
