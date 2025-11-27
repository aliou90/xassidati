const cacheName = 'Xassidati-cache-v1';
const filesToCache = [
  // Ajout des fichiers critiques (indépendants pour le bon chargement et la mise en cache)
  // Fichiers PHP et txt
  '/index.html',
  
  // Fichier CSS 
  '/assets/css/bootstrap.min.css',
  '/assets/css/bootstrap.min.css.map',
  '/assets/css/fontawesome.min.css',
  '/assets/css/shepherd.min.css',
  '/assets/css/styles.css',

  // Fichiers JS
  '/assets/js/jquery.min.js',
  '/assets/js/jquery.min.js.map',
  '/assets/js/popper.min.js',
  '/assets/js/popper.min.js.map',
  '/assets/js/bootstrap.min.js',
  '/assets/js/bootstrap.min.js.map',
  '/assets/js/fontawesome.min.js',
  '/assets/js/hammer.min.js',
  '/assets/js/hammer.min.js.map',
  '/assets/js/shepherd.min.js',
  '/assets/js/shepherd.min.js.map',
  '/assets/js/script.js',

  // FONTS
  '/assets/fonts/AlMushafQuran.ttf',
  '/assets/fonts/AmiriQuran.ttf',
  '/assets/fonts/LateefRegular.ttf',
  '/assets/fonts/Neirizi.ttf',

  // ICONES & IMAGES
  '/assets/images/icons/icon-192x192.png',
  '/assets/images/icons/icon-512x512.png',
  '/assets/images/icons/fall-icon-512x512.png',
  '/assets/images/icons/fall-icon-192x192.png',
  '/assets/images/icons/icon-offline.png',
  '/assets/images/icons/icon-online.png',
  '/assets/images/icons/icon-whatsapp.png',
  '/assets/images/icons/icon-mail.png',
  '/assets/images/brands/banner.png',
  '/assets/images/logos/ahmadou.png',
  '/assets/images/covers/pre.png',
  '/assets/images/covers/processing.gif',

  // Captures d'écran et autres ressources
  '/assets/images/screenshots/screenshot1.png',
  '/assets/images/screenshots/screenshot2.png',
  
  // Ajoute d'autres fichiers critiques si nécessaires
];

// Installation et mise en cache initiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      const safeCaching = filesToCache.map((url) =>
        cache.add(url).catch(err => {
          console.warn(`Échec du cache pour : ${url}`, err);
        })
      );
      return Promise.allSettled(safeCaching);
    })
  );
  self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [cacheName];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((key) => {
          if (!cacheWhitelist.includes(key)) {
            console.log(`Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Interception des requêtes réseau avec priorité au cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(cacheName).then((cache) =>
      cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
        return response || fetchPromise;
      })
    )
  );
});
