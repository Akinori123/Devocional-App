import { useState, useCallback, useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, getMessagingInstance } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { registerDeviceFcmToken } from '../services/fcmRegistration';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;

  // Helper to obtain and save token
  const registerToken = useCallback(async (userId: string) => {
    const res = await registerDeviceFcmToken(userId);
    return res.token || null;
  }, []);

  // Sync function that checks permission and updates state / subscriptions
  const syncPermission = useCallback(async (forcedPermission?: NotificationPermission) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsSupported(false);
      return;
    }

    const currentPerm = forcedPermission || Notification.permission;
    setPermission(currentPerm);

    if (currentPerm === 'granted') {
      const storedPref = localStorage.getItem('pushEnabled');
      // If user had enabled it before or if permission was just granted in OS settings
      const shouldBeSubscribed = storedPref !== 'false';
      setIsSubscribed(shouldBeSubscribed);

      if (shouldBeSubscribed && userRef.current) {
        // Register token in background if granted
        registerToken(userRef.current.uid);
      }
    } else if (currentPerm === 'denied') {
      setIsSubscribed(false);
      localStorage.setItem('pushEnabled', 'false');
    } else {
      // 'default'
      setIsSubscribed(false);
    }
  }, [registerToken]);

  // Listen to Visibility API, Focus, and Permissions API
  useEffect(() => {
    syncPermission();

    // 1. Visibility change listener (when returning from phone settings)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncPermission();
      }
    };

    // 2. Window focus listener (additional safety when switching tabs/windows)
    const handleWindowFocus = () => {
      syncPermission();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // 3. Permissions API listener (real-time notification permission change)
    let permissionStatus: PermissionStatus | null = null;
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
      try {
        navigator.permissions.query({ name: 'notifications' as PermissionName })
          .then((status) => {
            permissionStatus = status;
            const handleChange = () => {
              const newPerm = status.state as NotificationPermission;
              syncPermission(newPerm);
            };
            status.addEventListener('change', handleChange);
          })
          .catch((err) => {
            console.debug("Permissions query not available for notifications:", err);
          });
      } catch (err) {
        console.debug("Permissions API error:", err);
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [syncPermission]);

  const toggleSubscription = useCallback(async () => {
    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsSupported(false);
      throw new Error("Notificações não são suportadas neste dispositivo ou navegador.");
    }

    setLoading(true);
    try {
      if (isSubscribed) {
        // Soft Disable
        try {
          const messaging = await getMessagingInstance();
          if (messaging) {
            const token = await getToken(messaging).catch(() => null);
            if (token) {
              const uRef = doc(db, 'users', user.uid);
              await updateDoc(uRef, {
                fcmTokens: arrayRemove(token)
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn("Erro ao remover token FCM:", e);
        }

        localStorage.setItem('pushEnabled', 'false');
        localStorage.removeItem('activeFcmToken');
        localStorage.removeItem('activeFcmUserId');
        setIsSubscribed(false);
        return false;
      } else {
        // Enable
        let currentPermission = Notification.permission;

        if (currentPermission === 'denied') {
          setPermission('denied');
          throw new Error("PERMISSION_DENIED");
        }

        if (currentPermission === 'default') {
          currentPermission = await Notification.requestPermission();
          setPermission(currentPermission);

          if (currentPermission === 'denied') {
            setIsSubscribed(false);
            localStorage.setItem('pushEnabled', 'false');
            throw new Error("PERMISSION_DENIED");
          }

          if (currentPermission !== 'granted') {
            return false;
          }
        }

        if (currentPermission === 'granted') {
          const token = await registerToken(user.uid);
          localStorage.setItem('pushEnabled', 'true');
          setIsSubscribed(true);
          return true;
        }

        return false;
      }
    } finally {
      setLoading(false);
    }
  }, [user, isSubscribed, registerToken]);

  return {
    permission,
    isSupported,
    loading,
    isSubscribed,
    toggleSubscription,
    syncPermission
  };
}

