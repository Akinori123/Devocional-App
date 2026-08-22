importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

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
  const notificationTitle = payload.notification?.title || 'Florescer';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/logo.png', // Reusing logo as icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
