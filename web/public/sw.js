// Service Worker - No-op
// This file exists to prevent 404 errors from browsers that check for a service worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);
