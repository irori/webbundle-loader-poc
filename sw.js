self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith((async () => {
        let resp = await caches.match(e.request);
        if (!resp) {
            resp = await fetch(e.request);
        }
        return resp;
    })());
});
