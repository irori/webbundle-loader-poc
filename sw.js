self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith((async () => {
        let url = new URL(e.request.url);
        if (url.origin === self.origin && url.pathname === '/loadMainResource') {
            let cache_url = url.searchParams.get('url');
            let resp = await caches.match(cache_url);
            let text = await resp.text();
            let init = {
                status: resp.status,
                headers: resp.headers
            };
            init.headers.delete('content-security-policy'); // Hehe...
            return new Response(`<base href='${cache_url}'>` + text, init);
        }
        console.log(e.request.url);
        let resp = await caches.match(e.request);
        if (!resp)
            resp = await fetch(e.request);
        return resp;
    })());
});
