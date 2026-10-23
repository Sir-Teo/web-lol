/* Generated per production build. Installation requires a verified complete pack. */
const pack = /*__PACK__*/ null;
const base = self.registration.scope;
const cacheName = `rift-offline-v1:${base}:${pack.id}`;
const marker = new URL('.offline-complete', base).href;
const manifestURL = new URL('offline-pack.json', base).href;
const paths = new Set(pack.files.map((file) => new URL(file.path, base).href));
async function complete() {
  if (!(await caches.has(cacheName))) return null;
  const cache = await caches.open(cacheName);
  return (await cache.match(marker)) ? cache : null;
}
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!(await complete()))
        throw new Error('Download the current game pack before enabling offline use.');
    })()
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'pack-id') event.ports[0]?.postMessage({ id: pack.id });
  if (event.data?.type !== 'activate-pack') return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const others = clients.filter(
        (client) => client.id !== event.source?.id && client.url.startsWith(base)
      );
      if (others.length)
        return event.ports[0]?.postMessage({
          error: 'Close other game tabs before reloading the update.',
        });
      if (!(await complete()))
        return event.ports[0]?.postMessage({
          error: 'The offline pack is incomplete. Download it again.',
        });
      event.ports[0]?.postMessage({ id: pack.id });
      await self.skipWaiting();
    })()
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(base)) return;
  // Explicit update checks use the network, with the installed manifest offline.
  if (url.href === manifestURL) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = (await caches.has(cacheName)) ? await caches.open(cacheName) : null;
        const saved = await cache?.match(manifestURL);
        if (!saved) return Response.error();
        return new Response(await saved.arrayBuffer(), {
          headers: {
            'Content-Type': 'application/json',
            'X-Rift-Offline-Manifest': pack.id,
          },
        });
      })
    );
    return;
  }
  if (request.cache === 'no-store') return;
  const navigation =
    request.mode === 'navigate' &&
    (url.pathname === new URL(base).pathname ||
      url.pathname === new URL('index.html', base).pathname);
  const key = navigation ? new URL('index.html', base).href : url.href;
  if (!navigation && !paths.has(key)) return;
  event.respondWith(
    (async () => {
      const cache = await complete();
      if (cache) {
        const response = await cache.match(key);
        if (response) return response;
        // Evicted/removed data must not keep advertising a complete pack.
        await cache.delete(marker);
      }
      return fetch(request);
    })()
  );
});
