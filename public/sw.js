const CACHE_NAME = "local-font-studio-v19";
const APP_BASE = new URL("./", self.location.href);
const CORE_ASSETS = [
  APP_BASE,
  new URL("manifest.webmanifest", APP_BASE),
  new URL("icon.svg", APP_BASE),
  new URL("icon-192.png", APP_BASE),
  new URL("icon-512.png", APP_BASE),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        return response;
      })
      .catch(() => caches.match(request).then((cachedResponse) => cachedResponse || caches.match(APP_BASE))),
  );
});
