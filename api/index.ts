import express from 'express';
// @ts-ignore
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { MercadoPagoConfig, Preference, PreApproval, Payment } from 'mercadopago';
import dailyPushHandler from './cron/daily-push';
import coinsReminderHandler from './cron/coins-reminder';

dotenv.config();

// Initialize Firebase Admin (only once)
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
      console.log('Firebase Admin initialized successfully in API via FIREBASE_SERVICE_ACCOUNT_KEY');
    } catch (error: any) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY in API:', error?.message || error);
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
      console.log('Firebase Admin initialized successfully in API via privateKey & clientEmail');
    } catch (credErr: any) {
      console.error('Failed to initialize Firebase Admin with individual credentials:', credErr?.message || credErr);
    }
  } else {
    try {
      initializeApp({
        projectId
      });
      console.log(`Firebase Admin initialized with default projectId: ${projectId}`);
    } catch (e: any) {
      console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing in API:', e?.message || e);
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const handleCheckoutSubscription = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, userEmail } = req.body;
    
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Mercado Pago token not configured" });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });

    const preApproval = new PreApproval(client);

    const result = await preApproval.create({
      body: {
        reason: "Assinatura VIP Florescer - Recorrente (Cartão)",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 29.90, // Assinatura Recorrente Mensal: R$ 29,90/mês
          currency_id: "BRL"
        },
        payer_email: userEmail || "test@test.com",
        back_url: `${req.headers.origin || 'http://localhost:3000'}/?subscription=success`,
        external_reference: userId,
        status: "pending"
      }
    });

    res.json({ id: result.id, init_point: result.init_point });
  } catch (error: any) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
};

// Gerar Pagamento PIX Avulso de 30 Dias (Passe VIP)
const handleCreatePixPayment = async (req: express.Request, res: express.Response) => {
  try {
    const { userId, userEmail, userName, amount = 29.90 } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Mercado Pago token not configured" });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });

    const payment = new Payment(client);

    // Expiração do QR Code PIX em 30 minutos
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount) || 29.90,
        description: "Passe VIP Florescer - 30 Dias (PIX)",
        payment_method_id: "pix",
        payer: {
          email: userEmail || "usuario@florescer.app",
          first_name: (userName || "Leitor Florescer").slice(0, 30),
        },
        date_of_expiration: expirationDate,
        metadata: {
          user_id: userId,
          plan_id: "pix_30_days",
          subscription_type: "pix_prepaid",
          duration_days: 30
        },
        external_reference: userId
      }
    });

    const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;
    const ticketUrl = result.point_of_interaction?.transaction_data?.ticket_url;

    res.json({ 
      id: result.id, 
      status: result.status,
      qrCode,
      qrCodeBase64,
      ticketUrl,
      expiresAt: result.date_of_expiration,
      amount: result.transaction_amount
    });
  } catch (error: any) {
    console.error("PIX creation error:", error);
    res.status(500).json({ error: error.message || "Falha ao gerar PIX" });
  }
};

// Helper centralizado para garantir ativação VIP OBRIGATÓRIA e consistente
async function activateUserPremium({
  userId,
  paymentId,
  subscriptionId,
  type,
  planId = 'pix_30_days',
  durationDays = 30
}: {
  userId: string;
  paymentId?: string;
  subscriptionId?: string;
  type: 'pix_prepaid' | 'credit_card_recurring';
  planId?: string;
  durationDays?: number;
}) {
  try {
    const firestore = getFirestore();
    let targetRef = firestore.collection("users").doc(userId);
    let userDoc = await targetRef.get();

    // Se não encontrou pelo ID do documento, tenta buscar pelo e-mail
    if (!userDoc.exists) {
      const emailQuery = await firestore.collection("users").where("email", "==", userId).limit(1).get();
      if (!emailQuery.empty) {
        targetRef = emailQuery.docs[0].ref;
        userDoc = emailQuery.docs[0];
      } else {
        console.warn(`[Activate Premium] User document not found for id/email: ${userId}`);
        return false;
      }
    }

    const userData = userDoc.data();
    const now = Date.now();
    
    // Se o usuário já possuir dias ativos futuros, estende a partir da data atual; caso contrário, conta a partir de agora
    let baseTime = now;
    if (userData?.subscriptionExpiresAt) {
      const existingTime = new Date(userData.subscriptionExpiresAt).getTime();
      if (existingTime > now) {
        baseTime = existingTime;
      }
    }
    const newExpiresAt = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000).toISOString();

    // OBRIGATORIAMENTE força isPremium: true, subscriptionStatus: 'active' e cancelAtPeriodEnd: false
    const updatePayload: Record<string, any> = {
      isPremium: true,
      subscriptionStatus: 'active',
      subscriptionType: type,
      subscriptionPlan: planId,
      subscriptionExpiresAt: newExpiresAt,
      cancelAtPeriodEnd: false,
      subscriptionUpdatedAt: new Date().toISOString()
    };

    if (paymentId) {
      updatePayload.lastProcessedPaymentId = String(paymentId);
    }
    if (subscriptionId) {
      updatePayload.mpSubscriptionId = String(subscriptionId);
      updatePayload.lastProcessedSubscriptionId = String(subscriptionId);
    }

    await targetRef.update(updatePayload);
    console.log(`[Activate Premium] SUCCESS: Forced isPremium=true, subscriptionStatus='active', expiresAt=${newExpiresAt} for user ${targetRef.id}`);
    return true;
  } catch (err) {
    console.error("[Activate Premium] Error activating user premium:", err);
    return false;
  }
}

// Checar Status do Pagamento PIX em tempo real (Polling)
const handleCheckPaymentStatus = async (req: express.Request, res: express.Response) => {
  try {
    const paymentId = req.params.id;
    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Mercado Pago token not configured" });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: Number(paymentId) });

    if (paymentData.status === 'approved') {
      const userId = (paymentData.metadata as any)?.user_id || paymentData.external_reference || (paymentData.payer as any)?.email;
      if (userId) {
        await activateUserPremium({
          userId,
          paymentId: String(paymentId),
          type: 'pix_prepaid',
          planId: (paymentData.metadata as any)?.plan_id || 'pix_30_days',
          durationDays: 30
        });
      }
    }

    res.json({
      id: paymentData.id,
      status: paymentData.status,
      status_detail: paymentData.status_detail,
      isApproved: paymentData.status === 'approved'
    });
  } catch (error: any) {
    console.error("Check status error:", error);
    res.status(500).json({ error: "Failed to check payment status" });
  }
};

app.post("/api/checkout", handleCheckoutSubscription);
app.post("/api/create-subscription", handleCheckoutSubscription);
app.post("/api/create-pix", handleCreatePixPayment);
app.get("/api/payment/status/:id", handleCheckPaymentStatus);

app.post("/api/cancel-subscription", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "UserId is required" });

    const firestore = getFirestore();
    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const userData = userDoc.data();

    if (userData?.mpSubscriptionId) {
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return res.status(500).json({ error: "Mercado Pago token not configured" });
      }
      
      const client = new MercadoPagoConfig({ 
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
      });
      const preApproval = new PreApproval(client);
      
      try {
        await preApproval.update({
          id: userData.mpSubscriptionId,
          body: { status: "cancelled" }
        });
      } catch (mpError) {
        console.error("Failed to cancel in MP", mpError);
        // Continue anyway to update our DB as best effort
      }

      await userRef.update({
        cancelAtPeriodEnd: true,
        subscriptionStatus: 'canceled',
        subscriptionUpdatedAt: new Date().toISOString()
        // isPremium permanece true até o fim dos dias contratados!
      });
    } else {
      // Manual premium or PIX
      await userRef.update({
        isPremium: false,
        cancelAtPeriodEnd: false,
        subscriptionStatus: 'canceled',
        subscriptionUpdatedAt: new Date().toISOString()
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Cancel error:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

app.post("/api/delete-account", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "UserId is required" });

    const firestore = getFirestore();
    const userRef = firestore.collection("users").doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const subId = userData?.mpSubscriptionId || userData?.lastProcessedSubscriptionId || userData?.subscription_id;

      // 1. CRITICAL FINANCIAL LOGIC: Cancel active recurring subscription on Mercado Pago to avoid orphan charges
      if (subId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
        try {
          const client = new MercadoPagoConfig({ 
            accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
          });
          const preApproval = new PreApproval(client);
          await preApproval.update({
            id: String(subId),
            body: { status: "cancelled" }
          });
          console.log(`[Delete Account] Mercado Pago subscription ${subId} successfully cancelled for user ${userId}`);
        } catch (mpError: any) {
          console.error(`[Delete Account] Note on Mercado Pago subscription cancel for ${subId}:`, mpError?.message || mpError);
        }
      }

      // 2. Delete user subcollections in Firestore (devotionals, diaryNotes, savedVerses, favoriteVideos)
      const subcollections = ['devotionals', 'diaryNotes', 'savedVerses', 'favoriteVideos'];
      for (const subcol of subcollections) {
        try {
          const subSnap = await userRef.collection(subcol).get();
          if (!subSnap.empty) {
            const batch = firestore.batch();
            subSnap.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        } catch (subErr) {
          console.warn(`[Delete Account] Error deleting subcollection ${subcol} for ${userId}:`, subErr);
        }
      }

      // 3. Delete user document in Firestore
      await userRef.delete();
      console.log(`[Delete Account] Firestore user document deleted: ${userId}`);
    }

    // 4. Delete Firebase Auth user if Admin is available
    try {
      if (getApps().length) {
        await getAuth().deleteUser(userId);
        console.log(`[Delete Account] Firebase Auth user deleted: ${userId}`);
      }
    } catch (authErr: any) {
      console.log(`[Delete Account] Note on Auth user delete: ${authErr?.message || authErr}`);
    }

    res.json({ success: true, message: "Conta e dados excluídos com sucesso." });
  } catch (error: any) {
    console.error("[Delete Account] Error:", error);
    res.status(500).json({ error: error?.message || "Failed to delete account" });
  }
});

const handleMercadoPagoWebhook = async (req: express.Request, res: express.Response) => {
  try {
    const { type, data, action } = req.body || {};
    const queryTopic = req.query.topic || req.query.type;
    
    const isSubscriptionEvent = 
      type === 'subscription_preapproval' || 
      type === 'preapproval' ||
      queryTopic === 'subscription_preapproval' || 
      queryTopic === 'preapproval' ||
      (typeof action === 'string' && (action.startsWith('subscription_preapproval') || action.startsWith('preapproval')));
    
    const isPaymentEvent = 
      type === 'payment' || 
      queryTopic === 'payment' ||
      (typeof action === 'string' && action.startsWith('payment'));

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn("[MP Webhook] MERCADOPAGO_ACCESS_TOKEN missing on webhook");
      return res.status(200).send("Webhook received without MP token");
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const firestore = getFirestore();

    // 1. Recorrência / Assinatura de Cartão (PreApproval)
    if (isSubscriptionEvent) {
      try {
        const subId = data?.id || req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
        if (subId) {
          const preApproval = new PreApproval(client);
          const sub = await preApproval.get({ id: String(subId) });
          
          if (sub.status === 'authorized') {
            const userId = sub.external_reference || sub.payer_email;
            if (userId) {
              await activateUserPremium({
                userId,
                subscriptionId: String(subId),
                type: 'credit_card_recurring',
                planId: 'monthly_card',
                durationDays: 31
              });
            }
          } else if (sub.status === 'cancelled') {
            const usersRef = firestore.collection("users");
            const snapshot = await usersRef.where("mpSubscriptionId", "==", String(subId)).get();
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              await doc.ref.update({ 
                subscriptionStatus: 'cancelled',
                cancelAtPeriodEnd: true,
                subscriptionUpdatedAt: new Date().toISOString()
              });
            }
          } else if (sub.status === 'expired' || sub.status === 'suspended' || sub.status === 'paused') {
            const usersRef = firestore.collection("users");
            const snapshot = await usersRef.where("mpSubscriptionId", "==", String(subId)).get();
            if (!snapshot.empty) {
              const doc = snapshot.docs[0];
              await doc.ref.update({ 
                isPremium: false, 
                subscriptionStatus: sub.status,
                cancelAtPeriodEnd: false,
                subscriptionUpdatedAt: new Date().toISOString()
              });
              console.log(`[MP Webhook] Revoked premium for user ${doc.id} due to status: ${sub.status}`);
            }
          }
        }
      } catch (subErr) {
        console.error("[MP Webhook] Error processing subscription event:", subErr);
      }
    }

    // 2. Pagamento Avulso / PIX (Payment)
    if (isPaymentEvent || (!isSubscriptionEvent && (data?.id || req.body?.data?.id || req.query?.id))) {
      try {
        const paymentId = data?.id || req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
        if (paymentId) {
          const paymentInstance = new Payment(client);
          const paymentData = await paymentInstance.get({ id: Number(paymentId) });
          
          const userId = (paymentData.metadata as any)?.user_id || paymentData.external_reference || (paymentData.payer as any)?.email;
          if (userId) {
            if (paymentData.status === 'approved') {
              await activateUserPremium({
                userId,
                paymentId: String(paymentId),
                type: 'pix_prepaid',
                planId: (paymentData.metadata as any)?.plan_id || 'pix_30_days',
                durationDays: 30
              });
            } else if (
              paymentData.status === 'refunded' || 
              paymentData.status === 'charged_back' || 
              paymentData.status === 'cancelled' ||
              paymentData.status === 'rejected'
            ) {
              const userRef = firestore.collection("users").doc(userId);
              const userDoc = await userRef.get();
              if (userDoc.exists) {
                await userRef.update({
                  isPremium: false,
                  subscriptionStatus: paymentData.status,
                  subscriptionUpdatedAt: new Date().toISOString()
                });
                console.log(`[MP Webhook] Revoked premium for user ${userId} due to payment status: ${paymentData.status}`);
              }
            }
          }
        }
      } catch (payErr) {
        console.error("[MP Webhook] Error processing payment event:", payErr);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Error processing webhook");
  }
};

app.post("/api/webhook", handleMercadoPagoWebhook);
app.post("/api/webhook/mercadopago", handleMercadoPagoWebhook);
app.post("/api/mercadopago/webhook", handleMercadoPagoWebhook);
app.get("/api/webhook/mercadopago", (req, res) => res.status(200).json({ status: "ok", message: "Mercado Pago Webhook endpoint is live and ready" }));
app.get("/api/mercadopago/webhook", (req, res) => res.status(200).json({ status: "ok", message: "Mercado Pago Webhook endpoint is live" }));

// Fallback / Auxiliary Text-To-Speech Route
app.post("/api/tts", async (req, res) => {
  try {
    const { text, lang } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text parameter is required" });
    }
    res.json({
      status: "ready",
      textLength: text.length,
      lang: lang || "pt-BR",
      recommendedEngine: "speechSynthesis"
    });
  } catch (error: any) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "Failed to process TTS request" });
  }
});


app.post("/api/payment/create", async (req, res) => {
  try {
    const { title, price, quantity, userId, email, planId } = req.body;
    
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: "Mercado Pago token not configured" });
    }

    const client = new MercadoPagoConfig({ 
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
    });

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: planId || "premium_plan",
            title: title || "Plano Premium",
            quantity: quantity || 1,
            unit_price: price || 29.90,
            currency_id: "BRL",
          }
        ],
        payer: {
          email: email || "test@test.com",
        },
        metadata: {
          user_id: userId,
          plan_id: planId
        },
        back_urls: {
          success: `${req.headers.origin || 'http://localhost:3000'}/?subscription=success`,
          failure: `${req.headers.origin || 'http://localhost:3000'}/?subscription=failure`,
          pending: `${req.headers.origin || 'http://localhost:3000'}/?subscription=pending`
        },
        auto_return: "approved",
      }
    });

    res.json({ id: result.id, init_point: result.init_point });
  } catch (error: any) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Failed to create payment preference" });
  }
});

const handleGenerateDevotional = async (req: express.Request, res: express.Response) => {
  try {
    const { theme, userName, faithLevel, currentNeed, originalVerse } = req.body;
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada nas variáveis de ambiente da Vercel ou Servidor." 
      });
    }
    if (!theme || typeof theme !== 'string' || !theme.trim()) {
      return res.status(400).json({ 
        error: "Por favor, informe um tema ou palavra-chave para gerar o devocional." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let contextDetails = "";
    if (userName) contextDetails += ` Nome do leitor: ${userName}.`;
    if (faithLevel) contextDetails += ` Caminhada na fé: ${faithLevel}.`;
    if (currentNeed) contextDetails += ` Necessidade espiritual ou momento atual: ${currentNeed}.`;
    if (originalVerse) contextDetails += ` Versículo ou passagem inspiradora base: "${originalVerse}".`;

    let prompt = `Escreva um devocional cristão edificante, inédito e acolhedor focado estritamente no tema: "${theme.trim()}".${contextDetails}

REQUISITOS ESSENCIAIS:
1. Idioma: Português do Brasil.
2. Tamanho: Conciso e profundo (140 a 200 palavras).
3. "title": Um título criativo, poético e inspirador.
4. "beautifulWord": Um versículo bíblico chave acompanhado da sua referência exata (ex: 'Porque estou certo de que... (Romanos 8:38-39)' ou 'O Senhor é o meu pastor... (Salmos 23:1)').
5. "content": O texto do devocional com reflexão prática e conforto espiritual, finalizando com uma oração curta que inicie obrigatoriamente com '**Oração:** ...'.

Retorne estritamente o JSON com as chaves title, beautifulWord e content.`;

    const modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um pastor e conselheiro cristão acolhedor, bíblico e sábio. Sua missão é criar reflexões devocionais de alta qualidade. Retorne ESTRITAMENTE o JSON solicitado.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                beautifulWord: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "beautifulWord", "content"]
            }
          }
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Index devotional] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Servidores de IA temporariamente indisponíveis (503). Tente novamente em instantes.");
    }

    const text = response.text;
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error generating devotional:", error);
    let msg = error?.message || "Falha ao gerar devocional com IA";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Por favor, aguarde 30 a 60 segundos e tente novamente.";
    }
    res.status(500).json({ error: msg });
  }
};

app.post("/api/gemini/generate", handleGenerateDevotional);
app.post("/api/gemini/generate-devotional", handleGenerateDevotional);

const handleExplainVerse = async (req: express.Request, res: express.Response) => {
  try {
    const { reference, text, bookName, bookId, chapter, verseNumbers, cacheDocId: customCacheDocId } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!reference || !text) {
      return res.status(400).json({ 
        error: "Passagem ou versículo não informado para explicação." 
      });
    }

    // Calcula o doc ID padronizado do cache
    const cleanBookId = (bookId || bookName || reference || 'verse')
      .toLowerCase()
      .split(/[\s:]+/)[0]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, '');

    let versesStr = '1';
    if (Array.isArray(verseNumbers) && verseNumbers.length > 0) {
      versesStr = verseNumbers.join('-');
    } else if (typeof verseNumbers === 'string' || typeof verseNumbers === 'number') {
      versesStr = String(verseNumbers);
    } else if (reference) {
      const parts = reference.split(':');
      if (parts.length > 1) {
        versesStr = parts[1].replace(/\s+/g, '').replace(/,/g, '-');
      }
    }

    const chapterNum = chapter || 1;
    const cacheDocId = customCacheDocId || `${cleanBookId}_c${chapterNum}_v${versesStr}`;

    // 1. VERIFICAÇÃO PRÉVIA NO CACHE DO FIRESTORE
    let adminDb: FirebaseFirestore.Firestore | null = null;
    try {
      if (getApps().length > 0) {
        adminDb = getFirestore();
      }
    } catch (dbInitErr) {
      console.warn('[Index Cache] Erro ao obter instância do Firestore Admin:', dbInitErr);
    }

    if (adminDb && cacheDocId) {
      try {
        console.log(`[Index Cache Lookup] Verificando existência de cache em bible_explanations/${cacheDocId}...`);
        const cacheDoc = await adminDb.collection('bible_explanations').doc(cacheDocId).get();
        if (cacheDoc.exists) {
          const cachedData = cacheDoc.data();
          if (cachedData && (cachedData.context || cachedData.meaning)) {
            console.log(`[Index Cache HIT ⚡] Resposta recuperada instantaneamente do Firestore para ${cacheDocId}`);
            return res.status(200).json({
              reference: cachedData.reference || reference,
              text: cachedData.text || text,
              context: cachedData.context || '',
              meaning: cachedData.meaning || '',
              practicalApplication: cachedData.practicalApplication || '',
              shortPrayer: cachedData.shortPrayer || '',
              cached: true
            });
          }
        } else {
          console.log(`[Index Cache MISS 💨] Versículo ${cacheDocId} ainda não está em cache. Solicitando ao Gemini...`);
        }
      } catch (cacheLookupErr: any) {
        console.warn(`[Index Cache Lookup Warning] Não foi possível ler cache para ${cacheDocId}:`, cacheLookupErr?.message || cacheLookupErr);
      }
    }

    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada no servidor ou na Vercel." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Analise e explique o seguinte versículo bíblico:
Referência: ${reference}
Texto Sagrado: "${text}"

Por favor, forneça:
1. "context": O contexto histórico, cultural ou teológico de onde o versículo está inserido de forma clara e acessível.
2. "meaning": O significado profundo e espiritual da mensagem.
3. "practicalApplication": Como aplicar essa verdade na vida prática, no dia a dia e nas decisões cotidianas hoje.
4. "shortPrayer": Uma oração curta e sincera (1 ou 2 frases) inspirada na passagem.

Mantenha o tom empático, pastoral, acolhedor e edificante em até 3 parágrafos curtos no total.`;

    const systemInstruction = `Você é um teólogo e pastor empático. Explique de forma clara, acessível e devocional o significado do versículo bíblico fornecido. Traga o contexto histórico se necessário, mas foque em como aplicar essa palavra na vida prática hoje. Mantenha a resposta em até 3 parágrafos curtos. Retorne estritamente o formato JSON estruturado.`;

    const modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                context: { type: Type.STRING, description: "Contexto histórico e teológico resumido" },
                meaning: { type: Type.STRING, description: "Significado da mensagem" },
                practicalApplication: { type: Type.STRING, description: "Aplicação prática para hoje" },
                shortPrayer: { type: Type.STRING, description: "Oração curta de 1 a 2 frases" }
              },
              required: ["context", "meaning", "practicalApplication", "shortPrayer"]
            }
          }
        });

        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Index explain-verse] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Os servidores de IA estão com alta demanda temporária. Por favor, tente novamente em alguns instantes.");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(cleanText);

    // 2. GRAVAÇÃO OBRIGATÓRIA NO FIRESTORE ANTES DE RESPONDER
    if (adminDb && cacheDocId) {
      const payloadToSave = {
        reference: reference || '',
        text: text || '',
        bookId: bookId || cleanBookId,
        bookName: bookName || '',
        chapter: chapterNum,
        verseNumbers: Array.isArray(verseNumbers) ? verseNumbers : [1],
        context: parsed.context || '',
        meaning: parsed.meaning || '',
        practicalApplication: parsed.practicalApplication || '',
        shortPrayer: parsed.shortPrayer || '',
        createdAt: new Date().toISOString(),
        source: 'gemini-api'
      };

      try {
        console.log(`[Index Firestore Cache Save] Gravando obrigatoriamente no Firestore (coleção: bible_explanations, doc: ${cacheDocId})...`);
        const startTime = Date.now();
        await adminDb.collection('bible_explanations').doc(cacheDocId).set(payloadToSave, { merge: true });
        const durationMs = Date.now() - startTime;
        console.log(`[Index Firestore Cache Save SUCESSO ✅] Versículo ${cacheDocId} gravado com sucesso no Firestore em ${durationMs}ms`);
      } catch (saveErr: any) {
        console.error(`[Index Firestore Cache Save ERRO ❌] Falha crítica ao gravar bible_explanations/${cacheDocId}:`, {
          code: saveErr?.code || 'UNKNOWN_CODE',
          message: saveErr?.message || saveErr,
          details: saveErr?.details || null,
          stack: saveErr?.stack || null
        });
      }
    } else {
      console.warn(`[Index Firestore Cache Save ALERTA ⚠️] Firestore Admin não disponível ou cacheDocId inválido:`, { hasAdminDb: !!adminDb, cacheDocId });
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/explain-verse:", error);
    let msg = error?.message || "Falha ao consultar o Teólogo Particular com IA.";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Por favor, aguarde 30 a 60 segundos e tente novamente.";
    }
    return res.status(500).json({ error: msg });
  }
};

app.post("/api/gemini/explain-verse", handleExplainVerse);

app.post("/api/gemini/generate-bulk-devotionals", async (req, res) => {
  try {
    const { theme, partNumber } = req.body;
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY do servidor não configurada." });
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    if (!theme) {
      return res.status(400).json({ error: "Theme is required" });
    }
    let prompt = `Crie exatamente 7 devocionais cristãos inéditos focados ESTRITAMENTE no tema: "${theme}". Eles formarão um módulo de 7 dias de leitura contínua. Cada dia deve abordar um aspecto diferente desse tema para garantir crescimento progressivo.\n\nINSTRUÇÕES:\n1. Ortografia em Português (Brasil).\n2. Crie 7 objetos diferentes no array.\n3. O versículo base não deve se repetir.\n4. Cada reflexão deve ter entre 120 e 200 palavras (concisa, profunda, encorajadora e direta ao ponto), seguida de uma oração curta ao final no formato '**Oração:** ...'.`;
    if (partNumber && partNumber > 1) {
      prompt = `Este é o volume ${partNumber} sobre o tema "${theme}". Gere 7 novos dias com abordagens mais profundas e avançadas, não repita os conceitos básicos dos volumes anteriores.\n\nINSTRUÇÕES:\n1. Ortografia em Português (Brasil).\n2. Crie 7 objetos diferentes no array.\n3. O versículo base não deve se repetir.\n4. Cada reflexão deve ter entre 120 e 200 palavras, seguida de uma oração curta ao final no formato '**Oração:** ...'.`;
    }
    const modelsToTry = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um conselheiro cristão sábio e acolhedor. Sua missão é escrever um módulo de 7 dias de devocionais sobre um tema específico. Retorne EXATAMENTE um array JSON contendo 7 objetos.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  beautifulWord: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["title", "beautifulWord", "content"]
              }
            }
          }
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Index bulk] Model ${model} failed, attempting next model:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Servidores de IA temporariamente indisponíveis (503). Tente novamente em instantes.");
    }

    const text = response.text;
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error generating bulk devotionals:", error);
    let msg = error?.message || "Failed to generate bulk devotionals";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Por favor, aguarde 30 a 60 segundos e tente novamente.";
    }
    res.status(500).json({ error: msg });
  }
});

app.post("/api/gemini/summarize-diary", async (req, res) => {
  try {
    const { notes } = req.body;
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY do servidor não configurada." });
    }

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return res.status(400).json({ error: "Nenhuma anotação fornecida para o resumo." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const notesSummaryText = notes
      .map((n, i) => `[Registro ${i + 1} - ${n.date || 'Sem data'}]:\n${n.content || ''}`)
      .join('\n\n');

    const prompt = `Você é um mentor e conselheiro espiritual cristão acolhedor, empático e sábio do aplicativo Florescer.
Abaixo estão as reflexões e anotações do diário espiritual de um usuário nos últimos dias:

---
${notesSummaryText}
---

Sua missão é gerar um "Resumo Espiritual Semanal" caloroso, pastoral e inspirador.
Retorne um JSON estruturado com os seguintes campos:
- "title": Título inspirador para a semana (ex: "Sua Jornada de Paz e Confiança")
- "summary": Resumo geral reflexivo e afetuoso sobre os pensamentos e sentimentos expressos (2 a 3 parágrafos curtos).
- "spiritualHighlights": Array com 2 a 4 pontos de destaque ou temas centrais identificados nas anotações (strings curtas com emoji).
- "verseGuidance": Versículo bíblico encorajador para a semana com a referência (ex: "O Senhor é o meu pastor... (Salmos 23:1)").
- "personalPrayer": Uma oração pessoal, profunda e encorajadora para encerrar a semana e abençoar a próxima.`;

    const modelsToTry = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let response: any = null;
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "Você é um mentor cristão gentil e sábio. Retorne a resposta ESTRITAMENTE em formato JSON compatível com o schema solicitado.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                spiritualHighlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                verseGuidance: { type: Type.STRING },
                personalPrayer: { type: Type.STRING }
              },
              required: ["title", "summary", "spiritualHighlights", "verseGuidance", "personalPrayer"]
            }
          }
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Diary Summary] Model ${model} failed, attempting next:`, err?.message || err);
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Serviço de IA temporariamente indisponível. Tente novamente em instantes.");
    }

    let cleanText = response.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```json\n?/g, '').replace(/^```\n?/g, '');
      cleanText = cleanText.replace(/```$/g, '').trim();
    }
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error summarizing diary:", error);
    let msg = error?.message || "Failed to generate diary summary";
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      msg = "Limite de requisições por minuto da chave Gemini atingido. Aguarde 30 segundos e tente novamente.";
    }
    res.status(500).json({ error: msg });
  }
});

app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    let geminiApiKey = process.env.GEMINI_API_KEY;
    let unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!unsplashApiKey) {
      return res.status(500).json({ error: "Chave UNSPLASH_ACCESS_KEY não configurada." });
    }
    let keywords = prompt || 'nature,landscape,peaceful';
    if (geminiApiKey && prompt) {
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        try {
          const ai = new GoogleGenAI({ 
            apiKey: geminiApiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });
          const response = await ai.models.generateContent({
            model, 
            contents: `Extract 2 to 3 main visual keywords in English from this prompt for a photo search. Return ONLY the keywords separated by comma, no extra text. Prompt: "${prompt}"`
          });
          if (response?.text) {
            keywords = response.text.trim();
            break;
          }
        } catch (e: any) {
          // Silent fallback to next model or default keyword extraction
          continue;
        }
      }
    }
    let unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(keywords)}&orientation=portrait&client_id=${unsplashApiKey}`;
    let unsplashRes = await fetch(unsplashUrl);
    if (!unsplashRes.ok) {
       unsplashUrl = `https://api.unsplash.com/photos/random?query=nature,landscape,peaceful&orientation=portrait&client_id=${unsplashApiKey}`;
       unsplashRes = await fetch(unsplashUrl);
       if (!unsplashRes.ok) {
           throw new Error(`Erro na API do Unsplash: ${unsplashRes.statusText}`);
       }
    }
    const unsplashData = await unsplashRes.json();
    const photoUrl = unsplashData.urls.regular;
    const photoResponse = await fetch(photoUrl);
    const arrayBuffer = await photoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = photoResponse.headers.get('content-type') || 'image/jpeg';
    res.json({ image: `data:${mimeType};base64,${base64}` });
  } catch (error: any) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: error.message || "Failed to generate image" });
  }
});

// ==========================================
// GAMIFICAÇÃO & MOEDAS FLORESCER (V2.0)
// ATOMIC INCREMENT & SUBCOLEÇÃO DE HISTÓRICO
// ==========================================

// 1. Ganho de Moeda Diária (Atomic Increment + Ledger)
app.post("/api/coins/award", async (req, res) => {
  try {
    const { userId, missionType, reason } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const firestore = getFirestore();
    const userRef = firestore.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data() || {};
    
    // Obter data de hoje no fuso de São Paulo
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

    // Se já recebeu moeda hoje, bloqueia novo ganho (Limite de 1 moeda/dia)
    if (userData.lastCoinDate === today) {
      return res.json({ 
        awarded: false, 
        reason: 'already_awarded_today', 
        coins: userData.coins || 0,
        lastCoinDate: today
      });
    }

    const readableReason = reason || (
      missionType === 'session_15min' ? 'Missão 15 min concluída' :
      missionType === 'devotional_reading' ? 'Leitura devocional concluída' :
      'Missão Diária Concluída'
    );

    // Operação Atômica no Firestore usando FieldValue.increment
    await userRef.update({
      coins: FieldValue.increment(1),
      lastCoinDate: today,
      updatedAt: FieldValue.serverTimestamp()
    });

    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data() || {};
    const newCoins = updatedData.coins ?? ((userData.coins || 0) + 1);

    // Grava no Extrato / Subcoleção de Histórico (Auditoria Anti-Perda)
    const historyDocRef = userRef.collection("coin_history").doc();
    await historyDocRef.set({
      id: historyDocRef.id,
      userId,
      amount: 1,
      type: 'credit',
      missionType: missionType || 'daily_mission',
      reason: readableReason,
      date: today,
      balanceAfter: newCoins,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`[Coins API] Awarded 1 coin to user ${userId}. Reason: ${readableReason}. New balance: ${newCoins}`);
    return res.json({
      awarded: true,
      coins: newCoins,
      lastCoinDate: today,
      reason: readableReason
    });
  } catch (error: any) {
    console.error("[Coins API] Error awarding coin:", error);
    return res.status(500).json({ error: error?.message || "Failed to award daily coin" });
  }
});

// 2. Gasto de Moedas para Desbloquear Módulo Secreto (Atomic Decrement + Ledger)
app.post("/api/coins/spend", async (req, res) => {
  try {
    const { userId, amount = 30, moduleId, reason } = req.body;
    if (!userId || !moduleId) {
      return res.status(400).json({ error: "userId and moduleId are required" });
    }

    const numAmount = Math.abs(Number(amount)) || 30;
    const firestore = getFirestore();
    const userRef = firestore.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userSnap.data() || {};
    const currentCoins = userData.coins || 0;

    if (currentCoins < numAmount) {
      return res.status(400).json({ 
        error: "Saldo insuficiente de moedas Florescer.", 
        currentCoins, 
        required: numAmount 
      });
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const readableReason = reason || `Módulo Secreto Desbloqueado (${moduleId})`;

    // Operação Atômica: decremento de moedas e adição ao array de módulos desbloqueados
    await userRef.update({
      coins: FieldValue.increment(-numAmount),
      unlockedSecretModules: FieldValue.arrayUnion(moduleId),
      updatedAt: FieldValue.serverTimestamp()
    });

    const updatedSnap = await userRef.get();
    const updatedData = updatedSnap.data() || {};
    const newCoins = updatedData.coins ?? (currentCoins - numAmount);
    const unlockedSecretModules = updatedData.unlockedSecretModules || [];

    // Grava no Extrato / Subcoleção de Histórico
    const historyDocRef = userRef.collection("coin_history").doc();
    await historyDocRef.set({
      id: historyDocRef.id,
      userId,
      amount: -numAmount,
      type: 'debit',
      moduleId,
      reason: readableReason,
      date: today,
      balanceAfter: newCoins,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`[Coins API] User ${userId} spent ${numAmount} coins on module '${moduleId}'. New balance: ${newCoins}`);
    return res.json({
      success: true,
      coins: newCoins,
      unlockedSecretModules,
      reason: readableReason
    });
  } catch (error: any) {
    console.error("[Coins API] Error spending coins:", error);
    return res.status(500).json({ error: error?.message || "Failed to spend coins" });
  }
});

// 3. Extrato / Histórico de Transações de Moedas
app.get("/api/coins/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const firestore = getFirestore();
    const historySnap = await firestore
      .collection("users")
      .doc(userId)
      .collection("coin_history")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const history = historySnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt
      };
    });

    return res.json({ history });
  } catch (error: any) {
    console.error("[Coins API] Error fetching coin history:", error);
    return res.status(500).json({ error: error?.message || "Failed to fetch coin history" });
  }
});

// 4. Cron Jobs (Daily Morning Push 8h & Coins Reminder 16h)
app.all("/api/cron/daily-push", (req, res) => dailyPushHandler(req, res));
app.all("/api/cron/coins-reminder", (req, res) => coinsReminderHandler(req, res));

export default app;
