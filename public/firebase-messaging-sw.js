importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyBInDV-wE6kcOC6ggFBy8xyjNc31HLuD7w",
  authDomain: "devocional-app-63871.firebaseapp.com",
  projectId: "devocional-app-63871",
  storageBucket: "devocional-app-63871.firebasestorage.app",
  messagingSenderId: "448557677071",
  appId: "1:448557677071:web:36a9227875520a176b817a",
  measurementId: "G-ZYVY151QSP"
});

const messaging = firebase.messaging();

// Explicit raw 'push' event listener to guarantee 100% notification display on Android PWA & Chrome background
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Raw Push event received:', event);

  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (err) {
    try {
      payload = { data: { body: event.data.text() } };
    } catch (_) {}
  }

  console.log('[firebase-messaging-sw.js] Parsed push payload:', payload);

  const notif = payload.notification || {};
  const data = payload.data || {};
  const isSaleAlert = data.type === 'admin_sale_alert' || notif.title?.includes('Venda') || data.title?.includes('Venda');

  const title = data.title || notif.title || (isSaleAlert ? '🎉 Nova Venda Realizada!' : 'Florescer Devocional');
  const body = data.body || notif.body || 'Você tem uma nova notificação do Florescer.';
  const icon = data.icon || notif.icon || (isSaleAlert ? '/images/logo.png' : '/images/rosa.png');
  const badge = data.badge || notif.badge || (isSaleAlert ? '/images/logo.png' : '/images/rosa.png');
  const image = data.image || notif.image || undefined;
  const targetUrl = data.url || notif.click_action || payload.fcmOptions?.link || (isSaleAlert ? '/?tab=admin_users' : '/');

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    image: image,
    tag: data.tag || notif.tag || (isSaleAlert ? `sale-${Date.now()}` : 'florescer-push'),
    renotify: true,
    requireInteraction: true,
    vibrate: isSaleAlert ? [400, 150, 400, 150, 500] : [200, 100, 200],
    data: {
      url: targetUrl,
      ...data
    },
    actions: isSaleAlert ? [
      { action: 'open_admin', title: 'Ver Painel Admin' }
    ] : []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Complementary Firebase onBackgroundMessage handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage received:', payload);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
