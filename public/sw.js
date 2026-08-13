const CACHE = 'katalog-shell-v13';
const SHELL = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/talk-icon-192.png',
  '/icons/talk-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Kenochem Talk',
    body: 'Nowa wiadomosc',
    url: '/',
    icon: '/icons/talk-notification-icon-192.png',
    badge: '/icons/talk-notification-badge-96.png',
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Ignore malformed push payloads and show a generic notification.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Kenochem Talk', {
      body: data.body || '',
      icon: data.icon || '/icons/talk-notification-icon-192.png',
      badge: data.badge || '/icons/talk-notification-badge-96.png',
      image: data.image,
      tag: data.threadId ? `talk-${data.threadId}` : 'talk-message',
      renotify: true,
      timestamp: Date.now(),
      data: { url: data.url || '/', threadId: data.threadId },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => undefined);
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.pathname.startsWith('/data/')) return;

  const isHtml =
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/index.html';

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match('/index.html').then((c) => c || Response.error())),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && url.pathname.startsWith('/icons/')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
