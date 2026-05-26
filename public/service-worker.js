const CACHE_NAME = 'flow-notes-v3'; // Increment version to force cache refresh
const urlsToCache = [
  '/',
  '/index.html',
  '/FlowIcon-Main.png',
  '/Flow-icon.webp'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - network-first for API/HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Network-first strategy for API calls and HTML (always get fresh data)
  const isApiCall = url.hostname.includes('supabase') || 
                    url.pathname.includes('/api/') ||
                    event.request.url.includes('supabase.co');
  const isHtmlRequest = event.request.destination === 'document' || 
                        event.request.headers.get('accept')?.includes('text/html');
  
  if (isApiCall || isHtmlRequest) {
    // Network-first for API/HTML — never cache POST/HEAD/PATCH/DELETE (Cache API is GET-only)
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          if (event.request.method !== 'GET') {
            return Response.error();
          }
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }
  
  // Cache-first strategy for static assets (images, fonts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Return cached asset
        }
        
        // Not in cache, fetch from network
        return fetch(event.request).then((response) => {
          // Cache static assets only
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
