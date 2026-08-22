importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

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
  const notificationTitle = payload.notification?.title || 'Florescer Devocional';
  const notificationOptions = {
    body: payload.notification?.body || 'Um novo versículo e reflexão esperam por você hoje.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
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
