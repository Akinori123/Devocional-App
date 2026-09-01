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

// Explicit Push event interceptor for guaranteed 100% notification delivery across all Android PWAs / Browsers
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
  const notifType = data.type || (notif.title?.includes('Venda') || data.title?.includes('Venda') ? 'admin_sale_alert' : 'generic');

  let title = data.title || notif.title;
  let body = data.body || notif.body;
  let icon = data.icon || notif.icon;
  let targetUrl = data.url || notif.click_action || payload.fcmOptions?.link;
  let tag = data.tag || notif.tag;
  let vibrate = [250, 100, 250];
  let requireInteraction = false;
  let renotify = true;
  let actions = [];

  switch (notifType) {
    case 'admin_sale_alert':
      title = title || '🎉 Nova Venda Realizada!';
      body = body || 'Uma nova assinatura Florescer VIP foi confirmada.';
      icon = icon || '/images/logo.png';
      targetUrl = targetUrl || '/?tab=admin_users';
      tag = tag || `sale-${Date.now()}`;
      vibrate = [400, 150, 400, 150, 500];
      requireInteraction = true;
      renotify = true;
      actions = [{ action: 'open_admin', title: 'Ver Painel Admin' }];
      break;

    case 'daily_push':
    case 'daily_devotional':
      title = title || 'Bom dia! ☀️';
      body = body || 'Seu devocional do dia está pronto no Florescer.';
      icon = icon || '/images/rosa.png';
      targetUrl = targetUrl || '/';
      tag = tag || 'daily-push';
      vibrate = [250, 100, 250];
      requireInteraction = false;
      renotify = false;
      actions = [{ action: 'read_devotional', title: 'Ler Devocional' }];
      break;

    case 'coins_reminder':
      title = title || '🪙 Suas moedas estão esperando!';
      body = body || 'Tire 15 minutinhos hoje para sua leitura devocional e garanta sua recompensa.';
      icon = icon || '/images/rosa.png';
      targetUrl = targetUrl || '/?tab=home';
      tag = tag || 'coins-reminder';
      vibrate = [200, 100, 200];
      requireInteraction = false;
      renotify = false;
      actions = [{ action: 'open_home', title: 'Abrir App' }];
      break;

    case 'subscription_dunning':
      title = title || 'Aviso de Assinatura ⏳';
      body = body || 'Seu Florescer VIP está quase vencendo. Renove agora para continuar seu progresso!';
      icon = icon || '/images/rosa.png';
      targetUrl = targetUrl || '/?tab=profile';
      tag = tag || 'subscription-dunning';
      vibrate = [350, 150, 350];
      requireInteraction = true;
      renotify = true;
      actions = [{ action: 'renew_vip', title: 'Renovar VIP' }];
      break;

    case 'vip_activated':
      title = title || '🎉 Parabéns! Seu Plano VIP está ativo!';
      body = body || 'Seu acesso completo ao Florescer VIP foi liberado!';
      icon = icon || '/images/rosa.png';
      targetUrl = targetUrl || '/';
      tag = tag || `vip-${Date.now()}`;
      vibrate = [300, 100, 300, 100, 400];
      requireInteraction = true;
      renotify = true;
      actions = [{ action: 'open_vip', title: 'Acessar Florescer' }];
      break;

    default:
      title = title || 'Florescer Devocional';
      body = body || 'Você tem uma nova mensagem do Florescer.';
      icon = icon || '/images/rosa.png';
      targetUrl = targetUrl || '/';
      tag = tag || 'florescer-general';
      vibrate = [200, 100, 200];
      requireInteraction = false;
      renotify = true;
      break;
  }

  const options = {
    body: body,
    icon: icon,
    tag: tag,
    renotify: renotify,
    requireInteraction: requireInteraction,
    vibrate: vibrate,
    data: {
      url: targetUrl,
      type: notifType,
      ...data
    },
    actions: actions
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Complementary background handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage received:', payload);
});

// User click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
