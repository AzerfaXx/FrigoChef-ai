
// On change le nom de version pour forcer une réinstallation immédiate et purger les caches corrompus
const CACHE_NAME = "frigochef-v18-supernova";

const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.png"
];

// 1. INSTALLATION
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error("Erreur cache initial", err);
      });
    })
  );
});

// 2. ACTIVATION
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

// 3. INTERCEPTION (FETCH)
self.addEventListener("fetch", (event) => {
  // On ne gère que les requêtes GET vers notre propre origine
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) return;

  // STRATÉGIE : NETWORK FIRST pour la Navigation (HTML)
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Si Netlify renvoie une 404 ou une erreur, on ne met PAS en cache cette erreur.
          // On renvoie direct le index.html du cache.
          if (!networkResponse || networkResponse.status === 404 || networkResponse.status >= 500) {
             return caches.match("/index.html");
          }
          
          // Sinon, c'est une bonne page, on la met en cache
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Si pas d'internet, on prend le cache (index.html)
          return caches.match("/index.html");
        })
    );
    return;
  }

  // STRATÉGIE : CACHE FIRST pour les ressources (Images, JS, CSS)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});