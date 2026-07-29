/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const CACHE_NAME = 'ruqayya-transport-erp-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png'
];

// Install Event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: network falling back to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local/same-origin requests
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass API requests so we don't serve stale API results
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache new successful requests
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
});

// Push Event: Handle background push notifications
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: 'RUQAYYA TRANSPORT LIMITED',
        body: event.data.text()
      };
    }
  }

  const showNotificationPromise = (async () => {
    let title = payload.title;
    let body = payload.body;
    let url = payload.url || '/notifications';

    if (!title || !body) {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          const list = data.notifications || data || [];
          const unread = list.find((n) => !n.read_status && !n.read);
          if (unread) {
            title = unread.title_en || unread.title || 'RUQAYYA TRANSPORT LIMITED';
            body = unread.message_en || unread.body || 'New operational update received.';
            url = '/notifications';
          }
        }
      } catch (err) {
        console.error('Failed to fetch fallback notification in SW:', err);
      }
    }

    title = title || 'RUQAYYA TRANSPORT LIMITED';
    body = body || 'New secure ERP transmission received.';

    const options = {
      body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      vibrate: payload.vibrate || [200, 100, 200],
      tag: payload.tag || 'ruqayya-notification',
      renotify: true,
      data: {
        url,
        id: payload.id
      },
      actions: payload.actions || [
        { action: 'open', title: 'Open ERP' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    return self.registration.showNotification(title, options);
  })();

  event.waitUntil(showNotificationPromise);
});

// Notification Click Event: navigate to deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Find any open window client of our origin
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
