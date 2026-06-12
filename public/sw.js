/* Puzzle Lounge service worker — offline-first app shell.
   Registered only from the production app (see register-sw.ts guards).
   Cache Storage is origin-scoped; we only touch our own buckets. */

const VERSION = "puzzle-v1";
const APP_SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const PRECACHE = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) =>
      Promise.allSettled(PRECACHE.map((u) => cache.add(u).catch(() => {}))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("puzzle-") && k !== APP_SHELL && k !== RUNTIME)
        .map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && url.origin !== "https://fonts.gstatic.com" && url.origin !== "https://fonts.googleapis.com") {
    return;
  }

  // Navigations: network-first, fall back to cached "/" then offline.html
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put("/", fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match("/");
        return cached || (await caches.match("/offline.html")) || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Static: cache-first with background update
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) {
      fetch(req).then((res) => {
        if (res && res.ok) caches.open(RUNTIME).then((c) => c.put(req, res.clone()));
      }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(RUNTIME);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      return caches.match("/offline.html") || new Response("Offline", { status: 503 });
    }
  })());
});
