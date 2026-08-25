import type { Request, Response } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount)
      });
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY in cron:', error);
    }
  }
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    const isForce = req.query.force === 'true' || req.body?.force === true;
    
    // Only check CRON_SECRET if it has been explicitly configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isForce) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!getApps().length) {
      return res.status(500).json({ error: "FIREBASE_SERVICE_ACCOUNT_KEY não configurada ou inválida." });
    }

    const firestore = getFirestore();

    // 1. Timezone Check & Daily Idempotency Guard (Horário de Brasília)
    const todayBrasilia = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Sao_Paulo' 
    }).format(new Date()); // Formato YYYY-MM-DD

    const logRef = firestore.collection("settings").doc("daily_push_log");
    const logDoc = await logRef.get().catch(() => null);

    if (logDoc && logDoc.exists && !isForce) {
      const logData = logDoc.data();
      if (logData?.lastSentDate === todayBrasilia) {
        return res.status(200).json({ 
          success: true, 
          skipped: true, 
          message: `Notificação matinal já foi disparada hoje (${todayBrasilia}). Para forçar o reenvio manual, envie o parâmetro ?force=true.`,
          lastSentAt: logData?.sentAt
        });
      }
    }

    // 2. Fetch Daily Scripture / Verse Content
    let wordOfTheDay = "Um novo dia, uma nova oportunidade para buscar a Deus.";
    try {
      const dailyRef = await firestore.collection("settings").doc("daily_content").get();
      if (dailyRef.exists) {
        const dailyData = dailyRef.data();
        if (dailyData?.verseText) {
          wordOfTheDay = dailyData.verseText;
        }
      }
    } catch (e) {
      console.warn("Could not fetch daily_content doc:", e);
    }

    // 3. Collect and Strictly Deduplicate Tokens Across All Users
    const usersSnapshot = await firestore.collection("users").get();
    
    // Map: token -> Array of { userId, updatedAt }
    const tokenToUsersMap = new Map<string, Array<{ userId: string; updatedAt?: string }>>();

    usersSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const userId = docSnap.id;
      const userTokens: string[] = [];

      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        userTokens.push(...data.fcmTokens);
      }
      if (data.fcmToken && typeof data.fcmToken === 'string') {
        userTokens.push(data.fcmToken);
      }

      const cleanUserTokens = Array.from(new Set(userTokens.filter(t => typeof t === 'string' && t.trim().length > 10)));

      for (const token of cleanUserTokens) {
        const existing = tokenToUsersMap.get(token) || [];
        existing.push({
          userId,
          updatedAt: data.fcmTokenUpdatedAt || data.lastReadDate || data.createdAt || ''
        });
        tokenToUsersMap.set(token, existing);
      }
    });

    // Cleanup Cross-Account Token Duplications in Firestore:
    // If the same physical device token belongs to multiple accounts (e.g. relog on same browser),
    // keep it on the most recently active account and detach from older accounts.
    let crossAccountPrunedCount = 0;
    for (const [token, users] of tokenToUsersMap.entries()) {
      if (users.length > 1) {
        // Sort: most recent first
        users.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        // Keep index 0, remove token from the rest
        const toRemoveFrom = users.slice(1);
        for (const orphan of toRemoveFrom) {
          try {
            await firestore.collection("users").doc(orphan.userId).update({
              fcmTokens: FieldValue.arrayRemove(token)
            });
            crossAccountPrunedCount++;
          } catch (err) {
            console.warn(`Could not prune duplicate token from user ${orphan.userId}:`, err);
          }
        }
      }
    }

    // 4. Final Unique Token List (Strict 1 push per device)
    const uniqueTokens = Array.from(tokenToUsersMap.keys());

    if (uniqueTokens.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Nenhum token de notificação ativo encontrado no banco de usuários.", 
        tokensFound: 0 
      });
    }

    // 5. Construct Notification Message with Anti-Duplicate Tag
    const notificationPayload = {
      notification: {
        title: "Bom dia! ☀️",
        body: `"${wordOfTheDay}"... Volte ao app para continuar sua leitura na Bíblia ou na sua Jornada. Não desista do seu propósito!`,
      },
      webpush: {
        headers: {
          Urgency: "high",
          Topic: "daily-push"
        },
        notification: {
          tag: `daily-push-${todayBrasilia}`,
          icon: "/rosa.png",
          badge: "/rosa.png",
          renotify: false
        },
        fcmOptions: { 
          link: "/" 
        }
      },
      data: {
        tag: `daily-push-${todayBrasilia}`,
        url: "/"
      }
    };

    const messaging = getMessaging();
    const chunkedTokens: string[][] = [];
    for (let i = 0; i < uniqueTokens.length; i += 500) {
      chunkedTokens.push(uniqueTokens.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;
    const deadTokensToPrune: string[] = [];

    for (const chunk of chunkedTokens) {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: notificationPayload.notification,
        webpush: notificationPayload.webpush,
        data: notificationPayload.data
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      // Identify invalid / expired / unregistered tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code || '';
          const errorMsg = resp.error.message || '';
          if (
            errorCode.includes('not-registered') ||
            errorCode.includes('invalid-registration-token') ||
            errorCode.includes('mismatched-credential') ||
            errorMsg.includes('UNREGISTERED') ||
            errorMsg.includes('registration-token-not-registered')
          ) {
            deadTokensToPrune.push(chunk[idx]);
          }
        }
      });
    }

    // 6. Clean up dead/unregistered tokens from Firestore
    let deadTokensCleaned = 0;
    if (deadTokensToPrune.length > 0) {
      const uniqueDeadTokens = Array.from(new Set(deadTokensToPrune));
      for (const deadToken of uniqueDeadTokens) {
        const associatedUsers = tokenToUsersMap.get(deadToken) || [];
        for (const u of associatedUsers) {
          try {
            await firestore.collection("users").doc(u.userId).update({
              fcmTokens: FieldValue.arrayRemove(deadToken)
            });
            deadTokensCleaned++;
          } catch (e) {
            // Ignore clean up errors on deleted docs
          }
        }
      }
    }

    // 7. Save Idempotency Log in Firestore
    await logRef.set({
      lastSentDate: todayBrasilia,
      sentAt: new Date().toISOString(),
      uniqueDevicesReached: uniqueTokens.length,
      successCount,
      failureCount,
      crossAccountPrunedCount,
      deadTokensCleaned
    }, { merge: true });

    return res.status(200).json({ 
      success: true, 
      date: todayBrasilia,
      totalDevices: uniqueTokens.length, 
      successCount, 
      failureCount,
      crossAccountPrunedCount,
      deadTokensCleaned
    });
  } catch (error: any) {
    console.error("Error in daily-push cron:", error);
    return res.status(500).json({ error: error.message || "Failed to trigger push notifications" });
  }
}
