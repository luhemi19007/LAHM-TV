/* LAHM TV — service worker
   Cachea únicamente el "cascarón" de la app (HTML/CSS/JS propios) para que
   la interfaz cargue instantáneamente y funcione sin conexión.
   El video/streaming SIEMPRE se pide en vivo a su origen (nunca se cachea),
   así que el contenido nunca queda desactualizado ni ocupa espacio. */

const CACHE_NAME = "lahmtv-shell-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => { /* si falla el precache, la app sigue funcionando online */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nunca interceptar streams de video, HLS, ni orígenes externos (YouTube, CDNs, etc).
  // Solo el documento HTML propio se sirve con estrategia cache-first + actualización en segundo plano.
  const url = new URL(req.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isDoc = req.mode === "navigate" || (isOwnOrigin && req.destination === "document");

  if (!isOwnOrigin || !isDoc) {
    return; // deja pasar la petición normal (red)
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
