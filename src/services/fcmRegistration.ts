import { getToken } from 'firebase/messaging';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from '../lib/firebase';

export async function registerDeviceFcmToken(userId: string, userEmail?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this browser/device.');
      return { success: false, error: 'Notificações não suportadas neste navegador' };
    }

    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { success: false, error: `Permissão de notificação não concedida: ${perm}` };
      }
    } else if (Notification.permission !== 'granted') {
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
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        console.log('[FCM] Service worker active and ready:', swRegistration.scope);
      } catch (swErr) {
        console.warn('[FCM] Error registering service worker:', swErr);
        try {
          swRegistration = await navigator.serviceWorker.getRegistration('/');
        } catch (_) {}
      }
    }

    const getTokenOptions: { serviceWorkerRegistration?: ServiceWorkerRegistration; vapidKey?: string } = {};
    if (swRegistration) {
      getTokenOptions.serviceWorkerRegistration = swRegistration;
    }
    const vapidKey = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY;
    if (vapidKey && typeof vapidKey === 'string' && vapidKey.trim().length > 10) {
      getTokenOptions.vapidKey = vapidKey.trim();
    }

    console.log('[FCM] Requesting FCM Token with options:', getTokenOptions);
    const token = await getToken(messaging, getTokenOptions);

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      console.warn('[FCM] getToken returned empty or invalid token.');
      return { success: false, error: 'Nenhum token retornado pelo FCM' };
    }

    const cleanToken = token.trim();
    console.log('[FCM] ✅ Obtained device token:', cleanToken.substring(0, 16) + '...' + cleanToken.substring(cleanToken.length - 8));

    localStorage.setItem('activeFcmToken', cleanToken);
    localStorage.setItem('activeFcmUserId', userId);
    localStorage.setItem('pushEnabled', 'true');

    // 1. Persist directly in Firestore via Client SDK
    if (userId) {
      const uRef = doc(db, 'users', userId);
      try {
        const userSnap = await getDoc(uRef);
        let currentTokens: string[] = [];
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (Array.isArray(data.fcmTokens)) {
            currentTokens = data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 10 && t !== cleanToken);
          }
        }
        const cleanTokens = [...currentTokens.slice(-4), cleanToken];

        await setDoc(uRef, {
          fcmTokens: cleanTokens,
          fcmToken: cleanToken,
          fcmTokenUpdatedAt: new Date().toISOString(),
          fcmPlatform: navigator.userAgent.substring(0, 120)
        }, { merge: true });
        console.log('[FCM] ✅ Successfully saved FCM token to Firestore user document for UID:', userId);
      } catch (updateErr) {
        console.warn('[FCM] Client Firestore save error, will rely on backend sync:', updateErr);
      }
    }

    // 2. Persist in Firestore via Backend Admin SDK (guaranteed bypass of client-side rules/offline cache)
    try {
      const syncRes = await fetch('/api/admin/save-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token: cleanToken,
          userEmail: userEmail || localStorage.getItem('userEmail') || undefined,
          platform: navigator.userAgent.substring(0, 120)
        })
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        console.log('[FCM] ✅ Backend Admin sync confirmed:', syncData);
      } else {
        console.warn('[FCM] Backend Admin sync returned non-200:', syncRes.status);
      }
    } catch (syncErr) {
      console.warn('[FCM] Could not sync token to backend API:', syncErr);
    }

    return { success: true, token: cleanToken };
  } catch (err: any) {
    console.error('[FCM] Fatal error registering FCM token:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
