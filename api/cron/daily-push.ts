import type { Request, Response } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
    
    // Only check CRON_SECRET if it has been explicitly configured in environment
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!getApps().length) {
      return res.status(500).json({ error: "FIREBASE_SERVICE_ACCOUNT_KEY não configurada ou inválida." });
    }

    const firestore = getFirestore();
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

    const usersSnapshot = await firestore.collection("users").get();
    const tokens: string[] = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        tokens.push(...data.fcmTokens);
      }
    });

    // Remove duplicates
    const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    if (uniqueTokens.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "Nenhum token FCM registrado no banco de usuários.", 
        tokensFound: 0 
      });
    }

    const message = {
      notification: {
        title: "Bom dia! ☀️",
        body: `"${wordOfTheDay}"... Volte ao app para continuar sua leitura na Bíblia ou na sua Jornada. Não desista do seu propósito!`,
      },
      webpush: {
        fcmOptions: { link: "/" }
      }
    };

    const messaging = getMessaging();
    const chunkedTokens = [];
    for (let i = 0; i < uniqueTokens.length; i += 500) {
      chunkedTokens.push(uniqueTokens.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunkedTokens) {
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: message.notification,
      });
      successCount += response.successCount;
      failureCount += response.failureCount;
    }

    return res.status(200).json({ 
      success: true, 
      totalTokens: uniqueTokens.length, 
      successCount, 
      failureCount 
    });
  } catch (error: any) {
    console.error("Error in daily-push cron:", error);
    return res.status(500).json({ error: error.message || "Failed to trigger push notifications" });
  }
}
