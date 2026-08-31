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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // When Firebase send payload contains a 'notification' object, 
  // the browser WebPush handler natively displays it automatically.
  // We only manually call showNotification if this was a data-only push payload,
  // preventing duplicate notifications on Android/iOS/Desktop.
  if (!payload.notification) {
    const isSaleAlert = payload.data?.type === 'admin_sale_alert';
    const notificationTitle = payload.data?.title || (isSaleAlert ? '🎉 Nova Venda Realizada!' : 'Florescer Devocional');
    const notificationOptions = {
      body: payload.data?.body || 'Um novo versículo e reflexão esperam por você hoje.',
      icon: payload.data?.icon || (isSaleAlert ? '/images/logo.png' : '/images/rosa.png'),
      badge: payload.data?.badge || (isSaleAlert ? '/images/logo.png' : '/images/rosa.png'),
      image: payload.data?.image || undefined,
      tag: payload.data?.tag || (isSaleAlert ? `admin-sale-${Date.now()}` : 'florescer-daily-push'),
      renotify: isSaleAlert ? true : false,
      requireInteraction: isSaleAlert ? true : false,
      vibrate: isSaleAlert ? [300, 100, 300, 100, 400] : [200, 100, 200],
      data: {
        url: payload.data?.url || payload.fcmOptions?.link || (isSaleAlert ? '/?tab=usersAdmin' : '/')
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
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
