import type { Request, Response } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin (only once, with multiple credential formats fallback)
if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || 'devocional-app-63871';

  if (serviceAccountKey) {
    try {
      let parsed: any;
      if (serviceAccountKey.trim().startsWith('{')) {
        parsed = JSON.parse(serviceAccountKey);
      } else {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        parsed = JSON.parse(decoded);
      }
      initializeApp({
        credential: cert(parsed)
      });
      console.log('[Coins Cron] Firebase Admin initialized with serviceAccountKey');
    } catch (error: any) {
      console.error('[Coins Cron] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error?.message || error);
    }
  } else if (privateKey && clientEmail) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n')
        })
      });
      console.log('[Coins Cron] Firebase Admin initialized with individual credentials');
    } catch (credErr: any) {
      console.error('[Coins Cron] Failed to initialize Firebase Admin with individual credentials:', credErr);
    }
  } else {
    try {
      initializeApp({
        projectId
      });
      console.log(`[Coins Cron] Firebase Admin initialized with default projectId: ${projectId}`);
    } catch (e: any) {
      console.warn('[Coins Cron] Firebase credentials missing:', e?.message || e);
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
    
    // Check CRON_SECRET if configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isForce) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!getApps().length) {
      return res.status(500).json({ error: "Firebase Admin não inicializado." });
    }

    const firestore = getFirestore();

    // 1. Data e Fuso Horário de Brasília (America/Sao_Paulo)
    const todayBrasilia = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Sao_Paulo' 
    }).format(new Date()); // YYYY-MM-DD

    // 2. Trava de Idempotência Diária (Garante que só roda 1x por dia às 16h)
    const logRef = firestore.collection("settings").doc("coins_push_log");
    const logDoc = await logRef.get().catch(() => null);

    if (logDoc && logDoc.exists && !isForce) {
      const logData = logDoc.data();
      if (logData?.lastSentDate === todayBrasilia) {
        return res.status(200).json({ 
          success: true, 
          skipped: true, 
          message: `Lembrete das 16h já foi executado hoje (${todayBrasilia}). Use ?force=true para forçar o reenvio de teste.`,
          lastSentAt: logData?.sentAt
        });
      }
    }

    // 3. Scan dos Usuários e Filtro Anti-Spam Inteligente
    const usersSnapshot = await firestore.collection("users").get();
    
    const userToSelectedTokenMap = new Map<string, string>(); // userId -> token
    const tokenToUsersList = new Map<string, string[]>(); // token -> list of userIds
    let skippedAlreadyClaimedCount = 0;
    let eligibleUsersCount = 0;
    let tokensPrunedCount = 0;

    const readingMissionKey = `devotional_reading_${todayBrasilia}`;
    const sessionMissionKey = `session_15min_${todayBrasilia}`;

    for (const docSnap of usersSnapshot.docs) {
      const data = docSnap.data();
      const userId = docSnap.id;

      // Se o usuário foi marcado como deletado, ignora
      if (data.isDeleted === true) {
        continue;
      }

      // FILTRO ANTI-SPAM CRUCIAL:
      // Verifica se as missões diárias de hoje já foram resgatadas.
      const claimedMissions: string[] = Array.isArray(data.claimedDailyMissions) 
        ? data.claimedDailyMissions 
        : [];

      const hasClaimedReading = claimedMissions.includes(readingMissionKey);
      const hasClaimedSession = claimedMissions.includes(sessionMissionKey);

      // Se o usuário JÁ resgatou ambas as missões de hoje, SILÊNCIO TOTAL (Anti-Spam)
      if (hasClaimedReading && hasClaimedSession) {
        skippedAlreadyClaimedCount++;
        continue;
      }

      // Coleta tokens FCM válidos do usuário elegível
      const rawTokens: string[] = [];
      if (Array.isArray(data.fcmTokens)) {
        rawTokens.push(...data.fcmTokens);
      }
      if (typeof data.fcmToken === 'string') {
        rawTokens.push(data.fcmToken);
      }

      const validTokens = Array.from(new Set(rawTokens.filter(t => typeof t === 'string' && t.trim().length > 10)));

      if (validTokens.length === 0) {
        continue;
      }

      eligibleUsersCount++;

      for (const t of validTokens) {
        const uList = tokenToUsersList.get(t) || [];
        uList.push(userId);
        tokenToUsersList.set(t, uList);
      }

      // Seleciona o token mais recente do usuário
      const primaryToken = typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10 
        ? data.fcmToken.trim() 
        : validTokens[validTokens.length - 1];

      userToSelectedTokenMap.set(userId, primaryToken);

      // Faxina preventiva de tokens excedentes (> 2)
      if (validTokens.length > 2) {
        const keptTokens = validTokens.slice(-2);
        try {
          await firestore.collection("users").doc(userId).update({
            fcmTokens: keptTokens,
            fcmToken: primaryToken
          });
          tokensPrunedCount += (validTokens.length - keptTokens.length);
        } catch (cleanErr) {
          console.warn(`[Coins Cron] Could not prune tokens for user ${userId}:`, cleanErr);
        }
      }
    }

    // Deduplicação de aparelhos compartilhados (Token único)
    const tokenToTargetUser = new Map<string, string>();
    for (const [userId, token] of userToSelectedTokenMap.entries()) {
      tokenToTargetUser.set(token, userId);
    }

    const uniqueTokensToSend = Array.from(tokenToTargetUser.keys());

    if (uniqueTokensToSend.length === 0) {
      // Grava log mesmo se nenhum usuário precisar receber
      await logRef.set({
        lastSentDate: todayBrasilia,
        sentAt: new Date().toISOString(),
        usersScanned: usersSnapshot.size,
        skippedAlreadyClaimedCount,
        eligibleUsersCount,
        uniqueDevicesReached: 0,
        successCount: 0,
        failureCount: 0,
        message: "Nenhum usuário pendente de moedas com push token cadastrado."
      }, { merge: true });

      return res.status(200).json({ 
        success: true, 
        message: "Todos os usuários já resgataram as moedas hoje ou não possuem tokens ativos.", 
        usersScanned: usersSnapshot.size,
        skippedAlreadyClaimedCount,
        eligibleUsersCount,
        tokensFound: 0
      });
    }

    // 4. Montar Payload do Lembrete de Moedas das 16:00
    const messaging = getMessaging();
    let successCount = 0;
    let failureCount = 0;
    const deadTokensToClean: string[] = [];

    const pushPayload: any = {
      notification: {
        title: "🪙 Suas moedas estão esperando!",
        body: "Tire 15 minutinhos hoje para sua leitura devocional e garanta sua recompensa.",
      },
      android: {
        priority: 'high',
        notification: {
          title: "🪙 Suas moedas estão esperando!",
          body: "Tire 15 minutinhos hoje para sua leitura devocional e garanta sua recompensa.",
          sound: 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
          channelId: 'coins_reminders'
        }
      },
      webpush: {
        headers: {
          Urgency: "high",
          Topic: "coins-reminder"
        },
        notification: {
          tag: `coins-reminder-${todayBrasilia}`,
          icon: "/images/rosa.png",
          badge: "/images/rosa.png",
          renotify: false
        },
        fcmOptions: { 
          link: "/?tab=home" 
        }
      },
      data: {
        tag: `coins-reminder-${todayBrasilia}`,
        url: "/?tab=home",
        type: "coins_reminder"
      }
    };

    // Envio em lotes de até 500 tokens (limite FCM)
    const chunkedTokens: string[][] = [];
    for (let i = 0; i < uniqueTokensToSend.length; i += 500) {
      chunkedTokens.push(uniqueTokensToSend.slice(i, i + 500));
    }

    for (const chunk of chunkedTokens) {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: pushPayload.notification,
        android: pushPayload.android,
        webpush: pushPayload.webpush,
        data: pushPayload.data
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const currentToken = chunk[idx];
          const errorCode = (resp.error.code || '').toLowerCase();
          const errorMsg = (resp.error.message || '').toLowerCase();

          const isDeadToken = 
            errorCode.includes('invalid-registration-token') ||
            errorCode.includes('registration-token-not-registered') ||
            errorCode.includes('not-registered') ||
            errorCode.includes('mismatched-credential') ||
            errorCode.includes('invalid-argument') ||
            errorMsg.includes('unregistered') ||
            errorMsg.includes('not-registered') ||
            errorMsg.includes('requested entity was not found');

          if (isDeadToken) {
            deadTokensToClean.push(currentToken);
          }
        }
      });
    }

    // 5. Limpeza de tokens mortos no Firestore
    let deadTokensDeletedCount = 0;
    if (deadTokensToClean.length > 0) {
      const uniqueDeadTokens = Array.from(new Set(deadTokensToClean));
      for (const deadToken of uniqueDeadTokens) {
        const associatedUserIds = tokenToUsersList.get(deadToken) || [];
        for (const uId of associatedUserIds) {
          try {
            await firestore.collection("users").doc(uId).update({
              fcmTokens: FieldValue.arrayRemove(deadToken),
              fcmToken: FieldValue.delete()
            });
            deadTokensDeletedCount++;
          } catch (delErr) {
            // Ignora se documento já foi alterado
          }
        }
      }
    }

    // 6. Registro de Auditoria / Idempotência
    await logRef.set({
      lastSentDate: todayBrasilia,
      sentAt: new Date().toISOString(),
      usersScanned: usersSnapshot.size,
      skippedAlreadyClaimedCount,
      eligibleUsersCount,
      uniqueDevicesReached: uniqueTokensToSend.length,
      successCount,
      failureCount,
      deadTokensDeletedCount,
      tokensPrunedCount
    }, { merge: true });

    return res.status(200).json({ 
      success: true, 
      date: todayBrasilia,
      usersScanned: usersSnapshot.size,
      skippedAlreadyClaimedCount,
      eligibleUsersCount,
      uniqueTokensSent: uniqueTokensToSend.length, 
      successCount, 
      failureCount,
      deadTokensDeletedCount
    });

  } catch (error: any) {
    console.error("[Coins Cron] Error executing coins-reminder cron:", error);
    return res.status(500).json({ error: error?.message || "Failed to trigger coins reminder push notifications" });
  }
}
