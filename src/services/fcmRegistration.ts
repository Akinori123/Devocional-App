import { getToken } from 'firebase/messaging';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from '../lib/firebase';

export async function registerDeviceFcmToken(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this browser/device.');
      return { success: false, error: 'Notificações não suportadas neste navegador' };
    }

    if (Notification.permission !== 'granted') {
      console.log('[FCM] Notification permission is not granted yet:', Notification.permission);
      return { success: false, error: `Permissão de notificação: ${Notification.permission}` };
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[FCM] Messaging instance could not be initialized.');
      return { success: false, error: 'Firebase Messaging indisponível' };
    }

    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        }
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM] Error registering service worker:', swErr);
      }
    }

    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || undefined;

    console.log('[FCM] Requesting FCM Token with SW registration...');
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: vapidKey || undefined
    });

    if (!token) {
      console.warn('[FCM] getToken returned empty token.');
      return { success: false, error: 'Nenhum token retornado pelo FCM' };
    }

    console.log('[FCM] ✅ Obtained device token:', token.substring(0, 16) + '...' + token.substring(token.length - 8));

    localStorage.setItem('activeFcmToken', token);
    localStorage.setItem('activeFcmUserId', userId);
    localStorage.setItem('pushEnabled', 'true');

    if (userId) {
      const uRef = doc(db, 'users', userId);
      try {
        const userSnap = await getDoc(uRef);
        let currentTokens: string[] = [];
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (Array.isArray(data.fcmTokens)) {
            currentTokens = data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 10 && t !== token);
          }
        }
        // Keep up to 3 recent devices + current active device
        const cleanTokens = [...currentTokens.slice(-3), token];

        await updateDoc(uRef, {
          fcmTokens: cleanTokens,
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString(),
          fcmPlatform: navigator.userAgent.substring(0, 120)
        });
        console.log('[FCM] ✅ Successfully saved FCM token to Firestore user document for UID:', userId);
      } catch (updateErr) {
        console.warn('[FCM] updateDoc failed, attempting setDoc merge:', updateErr);
        await setDoc(uRef, {
          fcmTokens: [token],
          fcmToken: token,
          fcmTokenUpdatedAt: new Date().toISOString(),
          fcmPlatform: navigator.userAgent.substring(0, 120)
        }, { merge: true }).catch((err) => {
          console.error('[FCM] Failed to persist token in Firestore:', err);
        });
      }
    }

    return { success: true, token };
  } catch (err: any) {
    console.error('[FCM] Fatal error registering FCM token:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
