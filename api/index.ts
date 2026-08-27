import express from 'express';
// @ts-ignore
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { MercadoPagoConfig, Preference, PreApproval, Payment } from 'mercadopago';

dotenv.config();

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('Firebase Admin initialized successfully in API');
    } catch (error) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
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
          transaction_amount: 1.00, // Preço promocional/teste: R$ 1,00/mês
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
    const { userId, userEmail, userName, amount = 1.00 } = req.body;
    
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
        transaction_amount: Number(amount) || 1.00,
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
      const userId = (paymentData.metadata as any)?.user_id || paymentData.external_reference;
      if (userId) {
        const firestore = getFirestore();
        const userRef = firestore.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          // Idempotent update
          if (userData?.lastProcessedPaymentId !== String(paymentId) || userData?.isPremium !== true) {
            await userRef.update({
              isPremium: true,
              subscriptionType: 'pix_prepaid',
              subscriptionStatus: 'active',
              subscriptionPlan: 'pix_30_days',
              subscriptionExpiresAt: expiresAt,
              lastProcessedPaymentId: String(paymentId),
              cancelAtPeriodEnd: false,
              subscriptionUpdatedAt: new Date().toISOString()
            });
            console.log(`[Check Status] Auto-activated 30-day PIX pass for user ${userId}`);
          }
        }
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
        // isPremium stays true until period ends (managed by expiration check)!
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

const handleMercadoPagoWebhook = async (req: express.Request, res: express.Response) => {
  try {
    const { type, data, action } = req.body || {};
    const queryTopic = req.query.topic || req.query.type;
    const isSubscriptionEvent = 
      type === 'subscription_preapproval' || 
      queryTopic === 'subscription_preapproval' || 
      action === 'created' || 
      action === 'updated';
    
    const isPaymentEvent = 
      type === 'payment' || 
      queryTopic === 'payment';

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.warn("[MP Webhook] MERCADOPAGO_ACCESS_TOKEN missing on webhook");
      return res.status(200).send("Webhook received without MP token");
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const firestore = getFirestore();

    // 1. Recorrência / Assinatura (PreApproval)
    if (isSubscriptionEvent) {
      const subId = data?.id || req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
      if (subId) {
        const preApproval = new PreApproval(client);
        const sub = await preApproval.get({ id: String(subId) });
        
        if (sub.status === 'authorized') {
          if (sub.external_reference) {
            const userId = sub.external_reference;
            const userRef = firestore.collection("users").doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
              const userData = userDoc.data();
              // Idempotency check: if already active premium with this subId, bypass write
              if (userData?.isPremium === true && userData?.mpSubscriptionId === String(subId) && userData?.subscriptionStatus === 'authorized') {
                console.log(`[MP Webhook] Idempotent: User ${userId} already has active premium for subscription ${subId}. Skipping.`);
                return res.status(200).send("OK: Idempotent - Already processed");
              }

              const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
              await userRef.update({ 
                isPremium: true, 
                subscriptionType: 'credit_card_recurring',
                mpSubscriptionId: String(subId),
                subscriptionStatus: sub.status,
                subscriptionPlan: 'monthly_card',
                subscriptionExpiresAt: expiresAt,
                cancelAtPeriodEnd: false,
                lastProcessedSubscriptionId: String(subId),
                subscriptionUpdatedAt: new Date().toISOString()
              });
              console.log(`[MP Webhook] Granted recurring card premium access to user ${userId} for sub ${subId}`);
            }
          }
        } else if (sub.status === 'cancelled') {
          // Keep premium until end of cycle or mark cancellation
          const usersRef = firestore.collection("users");
          const snapshot = await usersRef.where("mpSubscriptionId", "==", String(subId)).get();
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            if (data.subscriptionStatus === 'cancelled' && data.cancelAtPeriodEnd === true) {
              return res.status(200).send("OK: Idempotent - Cancellation already marked");
            }
            await doc.ref.update({ 
              subscriptionStatus: sub.status,
              cancelAtPeriodEnd: true,
              subscriptionUpdatedAt: new Date().toISOString()
            });
          }
        } else if (sub.status === 'expired' || sub.status === 'suspended' || sub.status === 'paused') {
          // Suspensão por Inadimplência ou Cancelamento definitivo: revoga o acesso imediatamente
          const usersRef = firestore.collection("users");
          const snapshot = await usersRef.where("mpSubscriptionId", "==", String(subId)).get();
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            if (data.isPremium === false && data.subscriptionStatus === sub.status) {
              return res.status(200).send("OK: Idempotent - Already revoked");
            }
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
    }

    // 2. Pagamento Avulso / PIX (Payment)
    if (isPaymentEvent) {
      const paymentId = data?.id || req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
      if (paymentId) {
        const paymentInstance = new Payment(client);
        const paymentData = await paymentInstance.get({ id: Number(paymentId) });
        
        const userId = (paymentData.metadata as any)?.user_id || paymentData.external_reference;
        if (userId) {
          const userRef = firestore.collection("users").doc(userId);
          const userDoc = await userRef.get();

          if (userDoc.exists) {
            const userData = userDoc.data();

            if (paymentData.status === 'approved') {
              // Idempotency check: if this payment was already credited
              if (userData?.lastProcessedPaymentId === String(paymentId) && userData?.isPremium === true) {
                console.log(`[MP Webhook] Idempotent: Payment ${paymentId} already credited to user ${userId}. Skipping.`);
                return res.status(200).send("OK: Idempotent - Payment already processed");
              }

              const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

              await userRef.update({
                isPremium: true,
                subscriptionType: 'pix_prepaid',
                subscriptionStatus: 'active',
                subscriptionPlan: (paymentData.metadata as any)?.plan_id || 'pix_30_days',
                subscriptionExpiresAt: expiresAt,
                lastProcessedPaymentId: String(paymentId),
                cancelAtPeriodEnd: false,
                subscriptionUpdatedAt: new Date().toISOString()
              });
              console.log(`[MP Webhook] Granted 30-day PIX access to user ${userId} for payment ${paymentId}`);
            } else if (
              paymentData.status === 'refunded' || 
              paymentData.status === 'charged_back' || 
              paymentData.status === 'cancelled' ||
              paymentData.status === 'rejected'
            ) {
              // Suspensão / estorno imediato
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
            unit_price: price || 1.00,
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
    res.status(500).json({ error: error.message || "Falha ao gerar devocional com IA" });
  }
};

app.post("/api/gemini/generate", handleGenerateDevotional);
app.post("/api/gemini/generate-devotional", handleGenerateDevotional);

const handleExplainVerse = async (req: express.Request, res: express.Response) => {
  try {
    const { reference, text, bookName, chapter, verseNumbers } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "Chave GEMINI_API_KEY não configurada no servidor ou na Vercel." 
      });
    }

    if (!reference || !text) {
      return res.status(400).json({ 
        error: "Passagem ou versículo não informado para explicação." 
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
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Error in /api/gemini/explain-verse:", error);
    return res.status(500).json({ error: error.message || "Falha ao consultar o Teólogo Particular com IA." });
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
    res.status(500).json({ error: error.message || "Failed to generate bulk devotionals" });
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
    let keywords = prompt;
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash', 
          contents: `Extract 2 to 3 main visual keywords in English from this prompt for a photo search. Return ONLY the keywords separated by comma, no extra text. Prompt: "${prompt}"`
        });
        if (response.text) {
          keywords = response.text.trim();
        }
      } catch (e) {
        console.warn("Could not translate prompt using Gemini", e);
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

export default app;
