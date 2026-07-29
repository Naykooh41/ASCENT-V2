const V = "ascent-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.url.includes("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((r) => { const c = r.clone(); caches.open(V).then((ca) => ca.put(req, c)); return r; })
      .catch(() => caches.match(req).then((m) => m || caches.match("/")))
  );
});
