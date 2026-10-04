import type { Request, Response } from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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
      initializeApp({ credential: cert(parsed) });
      console.log('[Check Deliveries Cron] Firebase Admin initialized with serviceAccountKey');
    } catch (error: any) {
      console.error('[Check Deliveries Cron] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error?.message || error);
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
      console.log('[Check Deliveries Cron] Firebase Admin initialized with individual credentials');
    } catch (credErr: any) {
      console.error('[Check Deliveries Cron] Failed to initialize Firebase Admin with individual credentials:', credErr);
    }
  } else {
    try {
      initializeApp({ projectId });
      console.log(`[Check Deliveries Cron] Firebase Admin initialized with default projectId: ${projectId}`);
    } catch (e: any) {
      console.warn('[Check Deliveries Cron] Firebase credentials missing:', e?.message || e);
    }
  }
}

/**
 * Consulta serviços públicos de rastreio para verificar se o pacote já foi entregue ao destinatário
 */
async function checkTrackingIsDelivered(trackingCode: string): Promise<{ isDelivered: boolean; detail?: string }> {
  const code = trackingCode.trim().toUpperCase();
  if (!code) return { isDelivered: false };

  // Suporte a QA / Simulação de Testes:
  if (code.includes('ENTREGUE') || code.includes('DELIVERED') || code === 'TESTE-OK') {
    return { isDelivered: true, detail: 'Simulação QA: código marcado como entregue' };
  }

  // 1. Tentar consulta via página oficial de rastreio dos Correios
  try {
    const correiosUrl = `https://rastreamento.correios.com.br/app/index.php?codigo=${code}`;
    const response = await fetch(correiosUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (response.ok) {
      const html = await response.text();
      const lower = html.toLowerCase();
      if (
        lower.includes('objeto entregue ao destinatário') ||
        lower.includes('objeto entregue') ||
        lower.includes('entrega efetuada')
      ) {
        return { isDelivered: true, detail: 'Correios: Objeto entregue ao destinatário' };
      }
    }
  } catch (err) {
    console.warn(`[Check Deliveries] Falha ao consultar Correios para ${code}:`, err);
  }

  // 2. Tentar consulta via serviço público alternativo (Link&Track / API pública)
  try {
    const publicUrl = `https://linketrack.com/track?codigo=${code}`;
    const response = await fetch(publicUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      const text = await response.text();
      const lower = text.toLowerCase();
      if (
        lower.includes('objeto entregue ao destinatário') ||
        lower.includes('objeto entregue') ||
        lower.includes('entrega realizada')
      ) {
        return { isDelivered: true, detail: 'Link&Track: Objeto entregue ao destinatário' };
      }
    }
  } catch (err) {
    // Silencioso
  }

  return { isDelivered: false };
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
    return res.status(200).end();
  }

  const startTime = Date.now();
  console.log('[Check Deliveries Cron] Iniciando verificação diária de pedidos enviados...');

  try {
    const firestore = getFirestore();
    const ordersSnap = await firestore
      .collection('store_orders')
      .where('status', '==', 'Enviado')
      .get();

    if (ordersSnap.empty) {
      console.log('[Check Deliveries Cron] Nenhum pedido com status "Enviado" no momento.');
      return res.json({
        success: true,
        message: 'Nenhum pedido com status "Enviado" para verificar.',
        totalChecked: 0,
        totalUpdated: 0,
        durationMs: Date.now() - startTime
      });
    }

    const updatedOrders: any[] = [];
    let checkedCount = 0;

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const orderId = doc.id;
      const trackingCode = (order.trackingCode || '').trim();

      if (!trackingCode) {
        continue;
      }

      checkedCount++;
      const { isDelivered, detail } = await checkTrackingIsDelivered(trackingCode);

      if (isDelivered) {
        const deliveredAt = new Date().toISOString();
        const updatePayload: any = {
          status: 'Entregue',
          deliveredAt,
          updatedAt: deliveredAt,
          autoDeliveredViaCron: true,
          trackingDeliveryDetail: detail || 'Entregue ao destinatário'
        };

        await doc.ref.update(updatePayload);
        console.log(`[Check Deliveries Cron] Pedido #${orderId} atualizado automaticamente para "Entregue"!`);

        // Disparo de Push Notification para o cliente
        if (order.userId && order.userId !== 'anonymous') {
          try {
            const userDoc = await firestore.collection('users').doc(order.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data()!;
              const fcmToken = userData.fcmToken || userData.pushToken;
              if (fcmToken) {
                const messaging = getMessaging();
                await messaging.send({
                  token: fcmToken,
                  notification: {
                    title: 'Seu pacote chegou! 📦✨',
                    body: `O pedido #${orderId} (${order.productName || 'Florescer'}) foi entregue. Conte com nosso suporte para qualquer dúvida!`
                  },
                  data: {
                    type: 'store_order_delivered',
                    orderId: orderId,
                    url: '/profile?tab=orders'
                  }
                });
                console.log(`[Check Deliveries Cron] Push de entrega enviado para o usuário ${order.userId}.`);
              }
            }
          } catch (pushErr) {
            console.warn(`[Check Deliveries Cron] Erro ao enviar push para ${order.userId}:`, pushErr);
          }
        }

        updatedOrders.push({
          orderId,
          trackingCode,
          productName: order.productName,
          userName: order.userName,
          deliveredAt,
          detail
        });
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Check Deliveries Cron] Concluído em ${durationMs}ms. Verificados: ${checkedCount}, Atualizados para Entregue: ${updatedOrders.length}`);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalChecked: checkedCount,
      totalUpdated: updatedOrders.length,
      updatedOrders,
      durationMs
    });
  } catch (error: any) {
    console.error('[Check Deliveries Cron Error]:', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao processar verificação automática de entregas',
      durationMs: Date.now() - startTime
    });
  }
}
