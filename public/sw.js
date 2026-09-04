/*
  BellTab's service worker - and deliberately almost nothing.

  There is NO fetch handler here, on purpose. A fetch handler is what makes a
  service worker cache pages, and a cache is what serves last week's HTML after
  a deploy; the manifest decision (Docs/build-log.md, 2026-09-02) refused a
  service worker for exactly that reason. This file exists for one thing that
  has no other route: on Android, Chrome refuses `new Notification()` from a
  page and requires `registration.showNotification()` instead. The page
  registers this, asks it to show the bell, and that is the whole contract.

  Plain JavaScript in `public/` rather than TypeScript in `src/`: it is served
  as-is at /bell/sw.js and never bundled.
*/

self.addEventListener("install", () => {
  // Take over on the first load rather than waiting for every BellTab tab to
  // close, since there is nothing here whose version could disagree with the
  // page's.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Tapping the bell's toast brings a BellTab tab forward, or opens one if none
// is left. `matchAll` returns every window on the ORIGIN, not the scope - and
// biscuitlab.net is shared with the hub and Puzzle Lab - so the path is
// checked, or a tap could raise the wrong app. Caught in review, 2026-09-04.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const belltab = clients.find(
        (client) => "focus" in client && new URL(client.url).pathname.startsWith("/bell"),
      );
      return belltab ? belltab.focus() : self.clients.openWindow("/bell");
    }),
  );
});
