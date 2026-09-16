const CACHE_NAME = "lahmtv-shell-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        APP_FILES.map((file) => cache.add(file))
      )
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Las peticiones externas pasan directamente a la red.
  if (url.origin !== self.location.origin) {
    return;
  }

  // No almacenar vídeos, audios ni streams.
  if (["video", "audio", "track"].includes(request.destination)) {
    return;
  }

  // Navegación: caché primero y red como actualización.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();

              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, copy);
              });
            }

            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );

    return;
  }

  // Otros archivos propios: red primero y caché como respaldo.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
