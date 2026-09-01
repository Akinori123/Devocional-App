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
      console.log('[Daily Push] Firebase Admin initialized with serviceAccountKey');
    } catch (error: any) {
      console.error('[Daily Push] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error?.message || error);
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
      console.log('[Daily Push] Firebase Admin initialized with individual credentials');
    } catch (credErr: any) {
      console.error('[Daily Push] Failed to initialize Firebase Admin with individual credentials:', credErr);
    }
  } else {
    try {
      initializeApp({
        projectId
      });
      console.log(`[Daily Push] Firebase Admin initialized with default projectId: ${projectId}`);
    } catch (e: any) {
      console.warn('[Daily Push] Firebase credentials missing:', e?.message || e);
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
    
    // Only verify CRON_SECRET if it has been explicitly configured in environment
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
          message: `Notificação matinal já foi disparada hoje (${todayBrasilia}). Para forçar o reenvio de teste, envie o parâmetro ?force=true.`,
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

    // 3. Deduplicação Estrita por UID, Faxina de Tokens e Análise de Vencimento de Assinaturas (Dunning)
    const usersSnapshot = await firestore.collection("users").get();
    
    // Map: token -> Array de { userId, updatedAt }
    const userToSelectedTokenMap = new Map<string, string>(); // userId -> single active token
    const tokenToUsersList = new Map<string, string[]>(); // token -> list of userIds that had this token
    const userDunningMap = new Map<string, { diffDays: number; title: string; body: string }>(); // userId -> custom dunning message
    let tokensPrunedFromUsers = 0;
    let expiredUsersRevoked = 0;

    const now = new Date();

    for (const docSnap of usersSnapshot.docs) {
      const data = docSnap.data();
      const userId = docSnap.id;
      const isAdminUser = data.isAdmin === true || data.role === 'admin';

      // 3.1 Verificação de Vencimento / Dunning para Usuários Premium
      if (data.isPremium === true && !isAdminUser) {
        const expDateStr = data.subscriptionExpiresAt || data.currentPeriodEnd || data.expiresAt;
        if (expDateStr) {
          const expDate = new Date(expDateStr);
          if (!isNaN(expDate.getTime())) {
            const diffTime = expDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 0) {
              // Assinatura já expirou: revogar acesso
              try {
                await firestore.collection("users").doc(userId).update({
                  isPremium: false,
                  subscriptionStatus: 'expired',
                  subscriptionUpdatedAt: new Date().toISOString()
                });
                expiredUsersRevoked++;
                console.log(`[Cron Daily] Revoked expired premium access for user ${userId}`);
              } catch (expErr) {
                console.warn(`[Cron Daily] Could not revoke expired user ${userId}:`, expErr);
              }
            } else if (diffDays <= 2) {
              // Faltam 2 dias ou menos: agendar aviso suave (Dunning)
              const title = diffDays === 1 
                ? "Falta 1 dia! ⏳" 
                : diffDays === 0 
                  ? "Vence hoje! ⏳" 
                  : "Faltam 2 dias! ⏳";
              
              const body = "Seu Florescer Premium está quase vencendo. Renove agora para não perder o Teólogo IA e seus áudios exclusivos!";

              userDunningMap.set(userId, { diffDays, title, body });
            }
          }
        }
      }

      const rawTokens: string[] = [];
      if (Array.isArray(data.fcmTokens)) {
        rawTokens.push(...data.fcmTokens);
      }
      if (typeof data.fcmToken === 'string') {
        rawTokens.push(data.fcmToken);
      }

      // Filter valid tokens
      const validTokens = Array.from(new Set(rawTokens.filter(t => typeof t === 'string' && t.trim().length > 10)));

      if (validTokens.length === 0) {
        continue;
      }

      // Track all users that possess these tokens
      for (const t of validTokens) {
        const uList = tokenToUsersList.get(t) || [];
        uList.push(userId);
        tokenToUsersList.set(t, uList);
      }

      // Regra 1: Selecionar estritamente 1 único token prioritário por usuário (o mais recente)
      let primaryToken = typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10 
        ? data.fcmToken.trim() 
        : validTokens[validTokens.length - 1];

      userToSelectedTokenMap.set(userId, primaryToken);

      // Faxina proativa: se o usuário tiver mais de 2 tokens na array dele, limitar aos 2 mais recentes
      if (validTokens.length > 2) {
        const keptTokens = validTokens.slice(-2);
        try {
          await firestore.collection("users").doc(userId).update({
            fcmTokens: keptTokens,
            fcmToken: primaryToken
          });
          tokensPrunedFromUsers += (validTokens.length - keptTokens.length);
        } catch (cleanErr) {
          console.warn(`Could not prune excess tokens for user ${userId}:`, cleanErr);
        }
      }
    }

    // Regra 1 (cont.): Agrupamento global por token físico único (Deduplicação de aparelhos compartilhados)
    const tokenToTargetUser = new Map<string, string>(); // token -> userId
    for (const [userId, token] of userToSelectedTokenMap.entries()) {
      tokenToTargetUser.set(token, userId);
    }

    const uniqueTokensToSend = Array.from(tokenToTargetUser.keys());

    if (uniqueTokensToSend.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Nenhum token de notificação ativo encontrado no banco de usuários.", 
        totalUsers: usersSnapshot.size,
        tokensFound: 0,
        expiredUsersRevoked
      });
    }

    // 4. Separar Tokens entre Dunning (Aviso de Vencimento) e Devocional Diário Padrão
    const dunningTokensList: { token: string; title: string; body: string }[] = [];
    const standardTokensList: string[] = [];

    for (const token of uniqueTokensToSend) {
      const targetUserId = tokenToTargetUser.get(token);
      if (targetUserId && userDunningMap.has(targetUserId)) {
        const dunningInfo = userDunningMap.get(targetUserId)!;
        dunningTokensList.push({
          token,
          title: dunningInfo.title,
          body: dunningInfo.body
        });
      } else {
        standardTokensList.push(token);
      }
    }

    const messaging = getMessaging();
    let successCount = 0;
    let failureCount = 0;
    const deadTokensToClean: string[] = [];

    // 5. Envio das Mensagens Padrão (Devocional Matinal)
    if (standardTokensList.length > 0) {
      const standardPayload: any = {
        notification: {
          title: "Bom dia! ☀️",
          body: `"${wordOfTheDay}"... Volte ao app para continuar sua leitura na Bíblia ou na sua Jornada. Não desista do seu propósito!`,
        },
        android: {
          priority: 'high',
          notification: {
            title: "Bom dia! ☀️",
            body: `"${wordOfTheDay}"... Volte ao app para continuar sua leitura na Bíblia ou na sua Jornada. Não desista do seu propósito!`,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            channelId: 'daily_reminders'
          }
        },
        webpush: {
          headers: {
            Urgency: "high",
            Topic: "daily-push"
          },
          notification: {
            tag: `daily-push-${todayBrasilia}`,
            icon: "/images/rosa.png",
            renotify: false
          },
          fcmOptions: { 
            link: "/" 
          }
        },
        data: {
          type: "daily_push",
          title: "Bom dia! ☀️",
          body: `"${wordOfTheDay}"... Volte ao app para continuar sua leitura na Bíblia ou na sua Jornada. Não desista do seu propósito!`,
          icon: "/images/rosa.png",
          tag: `daily-push-${todayBrasilia}`,
          url: "/"
        }
      };

      const chunkedStandard: string[][] = [];
      for (let i = 0; i < standardTokensList.length; i += 500) {
        chunkedStandard.push(standardTokensList.slice(i, i + 500));
      }

      for (const chunk of chunkedStandard) {
        const response = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: standardPayload.notification,
          android: standardPayload.android,
          webpush: standardPayload.webpush,
          data: standardPayload.data
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
    }

    // 6. Envio das Mensagens de Dunning (Aviso de Vencimento de Assinatura)
    let dunningSentCount = 0;
    if (dunningTokensList.length > 0) {
      for (const item of dunningTokensList) {
        try {
          await messaging.send({
            token: item.token,
            notification: {
              title: item.title,
              body: item.body,
            },
            webpush: {
              headers: {
                Urgency: "high",
                Topic: "subscription-dunning"
              },
              notification: {
                tag: `subscription-dunning-${todayBrasilia}`,
                icon: "/images/rosa.png",
                renotify: true
              },
              fcmOptions: {
                link: "/?tab=profile"
              }
            },
            data: {
              type: "subscription_dunning",
              title: item.title,
              body: item.body,
              icon: "/images/rosa.png",
              tag: `subscription-dunning-${todayBrasilia}`,
              url: "/?tab=profile"
            }
          });
          successCount++;
          dunningSentCount++;
        } catch (sendErr: any) {
          failureCount++;
          const errorCode = (sendErr.code || '').toLowerCase();
          const errorMsg = (sendErr.message || '').toLowerCase();
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
            deadTokensToClean.push(item.token);
          }
        }
      }
    }

    // Regra 2 (cont.): Limpeza Automática Imediata dos Tokens Mortos no Firestore
    let deadTokensDeletedCount = 0;
    if (deadTokensToClean.length > 0) {
      const uniqueDeadTokens = Array.from(new Set(deadTokensToClean));
      
      for (const deadToken of uniqueDeadTokens) {
        // Encontrar todos os usuários que tinham este token morto
        const associatedUserIds = tokenToUsersList.get(deadToken) || [];
        for (const uId of associatedUserIds) {
          try {
            await firestore.collection("users").doc(uId).update({
              fcmTokens: FieldValue.arrayRemove(deadToken),
              fcmToken: FieldValue.delete()
            });
            deadTokensDeletedCount++;
          } catch (delErr) {
            // Ignorar erros caso o doc já tenha sido alterado ou excluído
          }
        }
      }
    }

    // 6. Registrar Log de Idempotência no Firestore
    await logRef.set({
      lastSentDate: todayBrasilia,
      sentAt: new Date().toISOString(),
      uniqueDevicesReached: uniqueTokensToSend.length,
      successCount,
      failureCount,
      dunningSentCount,
      expiredUsersRevoked,
      tokensPrunedFromUsers,
      deadTokensDeletedCount
    }, { merge: true });

    return res.status(200).json({ 
      success: true, 
      date: todayBrasilia,
      usersScanned: usersSnapshot.size,
      uniqueTokensSent: uniqueTokensToSend.length, 
      successCount, 
      failureCount,
      dunningSentCount,
      expiredUsersRevoked,
      tokensPrunedFromUsers,
      deadTokensDeletedCount
    });
  } catch (error: any) {
    console.error("Error in daily-push cron:", error);
    return res.status(500).json({ error: error.message || "Failed to trigger push notifications" });
  }
}
