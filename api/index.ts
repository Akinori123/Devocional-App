import express from 'express';
// @ts-ignore
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { MercadoPagoConfig, Preference, PreApproval, Payment } from 'mercadopago';

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

// -------------------------------------------------------------
// Servicos de Notificacao de Vendas para Administradores
// -------------------------------------------------------------
export interface AdminSaleAlertParams {
  transactionId: string;
  type: 'credit_card_recurring' | 'pix_prepaid' | 'payment';
  planName: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  userId?: string;
  paymentMethod?: string;
}

const DEFAULT_ADMIN_EMAILS = [
  'dofekrafael@gmail.com',
  'sjhonatan916@gmail.com',
  'floresceremadoracao@gmail.com',
  'contatoday@gmail.com'
];

function formatCurrencyBRL(value: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

function createFreeMailTransporter() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  if (user.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass }
  });
}

export async function notifyAdminSaleApproved(params: AdminSaleAlertParams): Promise<{
  pushSent: boolean;
  emailSent: boolean;
  recipientsCount: number;
  fcmDetails?: any;
  message?: string;
}> {
  const {
    transactionId,
    type,
    planName,
    amount,
    customerName,
    customerEmail,
    userId,
    paymentMethod
  } = params;

  console.log(`[Admin Sale Alert] Processing sale alert for transaction ${transactionId} (Amount: ${amount})...`);

  if (!getApps().length) {
    console.warn('[Admin Sale Alert] Firebase Admin not initialized, skipping notification dispatch.');
    return { pushSent: false, emailSent: false, recipientsCount: 0, message: 'Firebase Admin not initialized' };
  }

  const firestore = getFirestore();
  const alertRef = firestore.collection("admin_sales_alerts").doc(String(transactionId));

  try {
    const alertDoc = await alertRef.get();
    if (alertDoc.exists && alertDoc.data()?.alertSent === true) {
      console.log(`[Admin Sale Alert] Notification already dispatched for transaction ${transactionId}, skipping duplicate.`);
      return { pushSent: true, emailSent: true, recipientsCount: 0, message: 'Already sent (idempotent)' };
    }
  } catch (checkErr) {
    console.warn('[Admin Sale Alert] Error checking idempotency:', checkErr);
  }

  const amountFormatted = formatCurrencyBRL(amount || 29.90);
  const customerDisplayName = (customerName || customerEmail?.split('@')[0] || 'Novo Assinante').trim();
  const paymentMethodLabel = paymentMethod || (type === 'pix_prepaid' ? 'PIX (Aprovação Imediata)' : 'Cartão de Crédito (Recorrente)');
  const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date());

  const adminEmailsSet = new Set<string>(DEFAULT_ADMIN_EMAILS);
  if (process.env.ADMIN_EMAIL) {
    process.env.ADMIN_EMAIL.split(',').map(e => e.trim()).filter(Boolean).forEach(e => adminEmailsSet.add(e));
  }

  const adminFcmTokens = new Set<string>();

  try {
    // 1. Direct check if userId was provided
    if (userId) {
      const directUserDoc = await firestore.collection("users").doc(userId).get();
      if (directUserDoc.exists) {
        const data = directUserDoc.data() || {};
        if (data.email) adminEmailsSet.add(data.email);
        if (typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
          adminFcmTokens.add(data.fcmToken.trim());
        }
        if (Array.isArray(data.fcmTokens)) {
          data.fcmTokens.forEach((t: any) => {
            if (typeof t === 'string' && t.trim().length > 10) adminFcmTokens.add(t.trim());
          });
        }
      }
    }

    // 2. Query users where isAdmin == true
    const adminsSnapshot = await firestore.collection("users").where("isAdmin", "==", true).get();
    adminsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) adminEmailsSet.add(data.email);
      if (typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
        adminFcmTokens.add(data.fcmToken.trim());
      }
      if (Array.isArray(data.fcmTokens)) {
        data.fcmTokens.forEach((t: any) => {
          if (typeof t === 'string' && t.trim().length > 10) adminFcmTokens.add(t.trim());
        });
      }
    });

    // 3. Query users by known admin emails
    for (const email of Array.from(adminEmailsSet)) {
      const userByEmailSnap = await firestore.collection("users").where("email", "==", email).get();
      userByEmailSnap.forEach(doc => {
        const data = doc.data();
        if (typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
          adminFcmTokens.add(data.fcmToken.trim());
        }
        if (Array.isArray(data.fcmTokens)) {
          data.fcmTokens.forEach((t: any) => {
            if (typeof t === 'string' && t.trim().length > 10) adminFcmTokens.add(t.trim());
          });
        }
      });

      // Lowercase check
      if (email !== email.toLowerCase()) {
        const userByLowerSnap = await firestore.collection("users").where("email", "==", email.toLowerCase()).get();
        userByLowerSnap.forEach(doc => {
          const data = doc.data();
          if (typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
            adminFcmTokens.add(data.fcmToken.trim());
          }
          if (Array.isArray(data.fcmTokens)) {
            data.fcmTokens.forEach((t: any) => {
              if (typeof t === 'string' && t.trim().length > 10) adminFcmTokens.add(t.trim());
            });
          }
        });
      }
    }

    // 4. Fallback scan if still 0 tokens: scan users collection to ensure no admin is missed
    if (adminFcmTokens.size === 0) {
      console.log('[Admin Sale Alert] Scanning users collection for admin tokens...');
      const allUsersSnap = await firestore.collection("users").limit(100).get();
      const lowerAdminEmails = Array.from(adminEmailsSet).map(e => e.toLowerCase().trim());

      allUsersSnap.forEach(doc => {
        const data = doc.data() || {};
        const userEmailLower = (data.email || '').toLowerCase().trim();
        const isMatchedAdmin = data.isAdmin === true || lowerAdminEmails.includes(userEmailLower);

        if (isMatchedAdmin) {
          if (typeof data.fcmToken === 'string' && data.fcmToken.trim().length > 10) {
            adminFcmTokens.add(data.fcmToken.trim());
          }
          if (Array.isArray(data.fcmTokens)) {
            data.fcmTokens.forEach((t: any) => {
              if (typeof t === 'string' && t.trim().length > 10) adminFcmTokens.add(t.trim());
            });
          }
        }
      });
    }
  } catch (fetchErr) {
    console.error('[Admin Sale Alert] Error fetching admin tokens:', fetchErr);
  }

  const tokensList = Array.from(adminFcmTokens);
  console.log('Tokens encontrados no BD:', tokensList);

  if (tokensList.length === 0) {
    console.warn('[Admin Sale Alert] ⚠️ NENHUM token FCM encontrado no Firestore! Admin emails procurados:', Array.from(adminEmailsSet));
  } else {
    console.log(`[Admin Sale Alert] ✅ ${tokensList.length} token(s) FCM ativo(s) pronto(s) para disparo.`);
  }

  let pushSent = false;
  const fcmDetails: any = {
    tokensFound: tokensList.length,
    successCount: 0,
    failureCount: 0,
    responses: [] as any[]
  };

  if (tokensList.length > 0) {
    try {
      const messaging = getMessaging();
      const pushTitle = `🎉 Nova Venda! Assinatura confirmada no valor de ${amountFormatted}`;
      const pushBody = `Cliente: ${customerDisplayName} (${customerEmail || 'E-mail não informado'})\nPlano: ${planName} | Método: ${paymentMethodLabel}`;

      console.log(`[Admin Sale Alert] Disparando Push para ${tokensList.length} dispositivo(s). Admin Emails: ${Array.from(adminEmailsSet).join(', ')}`);
      tokensList.forEach((tok, idx) => {
        console.log(`[Admin Sale Alert] Device [${idx + 1}/${tokensList.length}] token prefix: ${tok.substring(0, 16)}...${tok.substring(tok.length - 8)}`);
      });

      const pushPayload: any = {
        tokens: tokensList,
        notification: {
          title: pushTitle,
          body: pushBody,
        },
        android: {
          priority: 'high',
          notification: {
            title: pushTitle,
            body: pushBody,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            channelId: 'sales_alerts',
            tag: `admin-sale-${transactionId}`,
            clickAction: '/?tab=admin_users'
          }
        },
        webpush: {
          headers: {
            Urgency: "high",
            Topic: "admin-sales"
          },
          notification: {
            title: pushTitle,
            body: pushBody,
            icon: "/images/logo.png",
            badge: "/images/logo.png",
            image: "/images/logo.png",
            tag: `admin-sale-${transactionId}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [300, 100, 300, 100, 400],
            silent: false,
            data: {
              type: "admin_sale_alert",
              transactionId: String(transactionId),
              amount: String(amount),
              url: "/?tab=admin_users"
            }
          },
          fcmOptions: {
            link: "/?tab=admin_users"
          }
        },
        data: {
          type: "admin_sale_alert",
          transactionId: String(transactionId),
          amount: String(amount),
          title: pushTitle,
          body: pushBody,
          icon: "/images/logo.png",
          badge: "/images/logo.png",
          url: "/?tab=admin_users"
        }
      };

      console.log(`[Admin Sale Alert] Calling Firebase messaging.sendEachForMulticast()...`);
      const response = await messaging.sendEachForMulticast(pushPayload);

      fcmDetails.successCount = response.successCount;
      fcmDetails.failureCount = response.failureCount;

      console.log(`[Admin Sale Alert] Push response summary: ${response.successCount} succeeded, ${response.failureCount} failed out of ${tokensList.length} devices.`);
      
      response.responses.forEach((resp, idx) => {
        if (resp.success) {
          console.log(`[Admin Sale Alert] ✅ Device [${idx + 1}] push accepted (messageId: ${resp.messageId})`);
          fcmDetails.responses.push({ index: idx + 1, status: 'success', messageId: resp.messageId });
        } else {
          console.error(`[Admin Sale Alert] ❌ Device [${idx + 1}] push failed: code=${resp.error?.code}, msg=${resp.error?.message}`);
          fcmDetails.responses.push({ index: idx + 1, status: 'failed', errorCode: resp.error?.code, errorMessage: resp.error?.message });
        }
      });

      if (response.successCount > 0) {
        pushSent = true;
      }
    } catch (pushErr) {
      console.error('[Admin Sale Alert] Fatal error sending FCM push notification:', pushErr);
      fcmDetails.error = String(pushErr);
    }
  } else {
    console.warn('[Admin Sale Alert] ⚠️ No active admin FCM tokens found in database to send push! Ensure admin opened the app and granted notification permission.');
  }

  let emailSent = false;
  const adminEmailsList = Array.from(adminEmailsSet);

  const rawAppUrl = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  let appBaseUrl = rawAppUrl.trim();
  if (appBaseUrl && !appBaseUrl.startsWith('http://') && !appBaseUrl.startsWith('https://')) {
    appBaseUrl = `https://${appBaseUrl}`;
  }
  if (!appBaseUrl) {
    appBaseUrl = 'https://florescer-devocional.vercel.app';
  }
  const adminDashboardUrl = `${appBaseUrl.replace(/\/$/, '')}/?tab=admin_users`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Nova Venda Confirmada - Florescer Devocional</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 12px; }
    .container { max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 20px; text-align: center; color: #ffffff; }
    .logo-badge { display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.14); padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #fbbf24; margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3; }
    .content { padding: 24px 18px; }
    .sale-card { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; border-radius: 16px; padding: 20px 16px; text-align: center; margin-bottom: 24px; }
    .sale-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #065f46; letter-spacing: 1px; margin-bottom: 4px; }
    .sale-amount { font-size: 34px; font-weight: 900; color: #047857; margin: 4px 0; }
    .sale-subtext { font-size: 14px; color: #065f46; font-weight: 600; word-break: break-word; }
    .detail-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
    .detail-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 3px; }
    .detail-value { font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-word; overflow-wrap: break-word; line-height: 1.4; }
    .status-badge { display: inline-block; background-color: #22c55e; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-top: 2px; }
    .footer { background-color: #f8fafc; padding: 20px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5; }
    .btn { display: inline-block; width: 100%; max-width: 320px; box-sizing: border-box; background-color: #0f172a; color: #ffffff !important; font-weight: 800; font-size: 15px; padding: 14px 20px; border-radius: 12px; text-decoration: none; text-align: center; border: 1px solid #1e293b; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25); }
  </style>
</head>
<body style="margin: 0; padding: 12px; background-color: #f1f5f9;">
  <div class="container" style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div class="header" style="background-color: #0f172a; padding: 28px 20px; text-align: center; color: #ffffff;">
      <div class="logo-badge" style="display: inline-block; background: rgba(255,255,255,0.14); padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 10px;">
        ✨ FLORESCER DEVOCIONAL
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">🎉 Nova Venda Confirmada!</h1>
    </div>

    <div class="content" style="padding: 24px 18px;">
      <div class="sale-card" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 16px; padding: 20px 16px; text-align: center; margin-bottom: 24px;">
        <div class="sale-label" style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #065f46; letter-spacing: 1px;">Valor Aprovado</div>
        <div class="sale-amount" style="font-size: 34px; font-weight: 900; color: #047857; margin: 4px 0;">${amountFormatted}</div>
        <div class="sale-subtext" style="font-size: 14px; color: #065f46; font-weight: 600; word-break: break-word;">${planName}</div>
      </div>

      <h3 style="margin: 0 0 14px 0; font-size: 16px; color: #1e293b; font-weight: 800;">Detalhes da Transação</h3>
      
      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Nome do Cliente</div>
        <div class="detail-value" style="font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-word;">${customerDisplayName}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">E-mail do Cliente</div>
        <div class="detail-value" style="font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-word;">${customerEmail || 'Não informado'}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Plano Adquirido</div>
        <div class="detail-value" style="font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-word;">${planName}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Forma de Pagamento</div>
        <div class="detail-value" style="font-size: 15px; font-weight: 700; color: #0f172a; word-break: break-word;">${paymentMethodLabel}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">ID da Transação</div>
        <div class="detail-value" style="font-size: 13px; font-family: monospace; font-weight: 700; color: #334155; word-break: break-all;">${transactionId}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Data e Hora</div>
        <div class="detail-value" style="font-size: 14px; font-weight: 700; color: #0f172a; word-break: break-word;">${dateFormatted}</div>
      </div>

      <div class="detail-card" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 20px;">
        <div class="detail-label" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Status do Pagamento</div>
        <div class="detail-value" style="font-size: 14px; font-weight: 700; color: #0f172a;">
          <span class="status-badge" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700;">Aprovado ✅</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${adminDashboardUrl}" class="btn" style="display: inline-block; width: 100%; max-width: 320px; box-sizing: border-box; background-color: #0f172a; color: #ffffff !important; font-weight: 800; font-size: 15px; padding: 14px 20px; border-radius: 12px; text-decoration: none; text-align: center; border: 1px solid #1e293b;">
          Acessar Painel de Controle ➜
        </a>
      </div>
    </div>

    <div class="footer" style="background-color: #f8fafc; padding: 20px 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
      Este é um e-mail automático do sistema de pagamentos Florescer Devocional.<br>
      Notificação em tempo real para administradores.
    </div>
  </div>
</body>
</html>
  `;

  const transporter = createFreeMailTransporter();
  if (transporter && adminEmailsList.length > 0) {
    try {
      const senderAddress = process.env.GMAIL_USER || process.env.SMTP_USER || 'contatoday@gmail.com';
      await transporter.sendMail({
        from: `"Florescer Devocional" <${senderAddress}>`,
        to: adminEmailsList.join(', '),
        subject: `🎉 Nova Venda! Assinatura confirmada no valor de ${amountFormatted}`,
        html: emailHtml
      });
      console.log(`[Admin Sale Alert] Email successfully dispatched via Free SMTP to ${adminEmailsList.join(', ')}`);
      emailSent = true;
    } catch (smtpErr) {
      console.warn('[Admin Sale Alert] SMTP dispatch skipped or failed:', smtpErr);
    }
  }

  try {
    const saleRecord = {
      transactionId: String(transactionId),
      amount,
      amountFormatted,
      planName,
      customerName: customerDisplayName,
      customerEmail: customerEmail || null,
      userId: userId || null,
      type,
      paymentMethod: paymentMethodLabel,
      alertSent: true,
      pushSent,
      pushAdminDevicesCount: tokensList.length,
      emailSent,
      emailRecipients: adminEmailsList,
      createdAt: new Date().toISOString(),
      createdAtTimestamp: FieldValue.serverTimestamp()
    };

    await alertRef.set(saleRecord, { merge: true });

    await firestore.collection("email_logs").add({
      type: "admin_sale_alert",
      transactionId: String(transactionId),
      recipients: adminEmailsList,
      subject: `🎉 Nova Venda! Assinatura confirmada no valor de ${amountFormatted}`,
      emailSent,
      pushSent,
      createdAt: new Date().toISOString()
    });

    console.log(`[Admin Sale Alert] Successfully logged sale alert record in Firestore for transaction ${transactionId}.`);
  } catch (logErr) {
    console.error('[Admin Sale Alert] Error recording sale alert log in Firestore:', logErr);
  }

  return {
    pushSent,
    emailSent,
    recipientsCount: tokensList.length,
    fcmDetails,
    message: 'Sale alert processed'
  };
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

    // Disparar Push Notification de Boas-Vindas VIP diretamente no celular do cliente
    try {
      const customerTokens = new Set<string>();
      if (typeof userData?.fcmToken === 'string' && userData.fcmToken.trim().length > 10) {
        customerTokens.add(userData.fcmToken.trim());
      }
      if (Array.isArray(userData?.fcmTokens)) {
        userData.fcmTokens.forEach((t: any) => {
          if (typeof t === 'string' && t.trim().length > 10) customerTokens.add(t.trim());
        });
      }

      const clientTokensList = Array.from(customerTokens);
      if (clientTokensList.length > 0 && getApps().length) {
        const messaging = getMessaging();
        const welcomeTitle = "🎉 Parabéns! Seu Plano VIP está ativo!";
        const welcomeBody = "Seu acesso completo ao Florescer VIP foi liberado. Aproveite o Teólogo IA, jornadas bíblicas e áudios exclusivos!";

        await messaging.sendEachForMulticast({
          tokens: clientTokensList,
          notification: {
            title: welcomeTitle,
            body: welcomeBody
          },
          android: {
            priority: 'high',
            notification: {
              title: welcomeTitle,
              body: welcomeBody,
              sound: 'default',
              defaultSound: true,
              defaultVibrateTimings: true,
              channelId: 'vip_welcome'
            }
          },
          webpush: {
            headers: {
              Urgency: "high",
              Topic: "vip-welcome"
            },
            notification: {
              title: welcomeTitle,
              body: welcomeBody,
              icon: "/images/rosa.png",
              badge: "/images/rosa.png",
              tag: `vip-activated-${targetRef.id}`,
              renotify: true,
              requireInteraction: true,
              data: {
                url: "/"
              }
            },
            fcmOptions: {
              link: "/"
            }
          },
          data: {
            type: "vip_activated",
            title: welcomeTitle,
            body: welcomeBody,
            url: "/"
          }
        });
        console.log(`[Activate Premium] ✅ Dispatched VIP welcome push to ${clientTokensList.length} device(s) for user ${targetRef.id}`);
      }
    } catch (pushCustomerErr) {
      console.warn(`[Activate Premium] Note: Could not send VIP welcome push to user ${targetRef.id}:`, pushCustomerErr);
    }

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
        const meta = (paymentData.metadata as any) || {};
        const payer = (paymentData.payer as any) || {};
        const planId = meta.plan_id || 'pix_30_days';
        const planName = planId === 'pix_30_days' ? 'Passe VIP 30 Dias (PIX)' : 'Plano VIP Florescer';
        const customerName = payer.first_name ? `${payer.first_name} ${payer.last_name || ''}`.trim() : undefined;
        const customerEmail = payer.email;

        await activateUserPremium({
          userId,
          paymentId: String(paymentId),
          type: 'pix_prepaid',
          planId,
          durationDays: 30
        });

        // Notificar Administrador em tempo real (Push Hotmart + E-mail)
        notifyAdminSaleApproved({
          transactionId: String(paymentId),
          type: 'pix_prepaid',
          planName,
          amount: Number(paymentData.transaction_amount) || 29.90,
          customerName,
          customerEmail,
          userId: String(userId),
          paymentMethod: paymentData.payment_method_id ? paymentData.payment_method_id.toUpperCase() : 'PIX'
        }).catch(err => console.error('[Check Status] Error notifying admin:', err));
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

              // Disparar Alerta de Venda para o Administrador (Push Hotmart + E-mail)
              notifyAdminSaleApproved({
                transactionId: String(subId),
                type: 'credit_card_recurring',
                planName: 'Assinatura Mensal VIP (Cartão)',
                amount: Number((sub as any).auto_recurring?.transaction_amount) || 29.90,
                customerEmail: sub.payer_email || (typeof userId === 'string' && userId.includes('@') ? userId : undefined),
                userId: String(userId),
                paymentMethod: 'Cartão de Crédito (Recorrente)'
              }).catch(err => console.error('[MP Webhook] Error notifying admin on recurring sale:', err));
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
              const meta = (paymentData.metadata as any) || {};
              const payer = (paymentData.payer as any) || {};
              const planId = meta.plan_id || 'pix_30_days';
              const planName = planId === 'pix_30_days' ? 'Passe VIP 30 Dias (PIX)' : 'Plano VIP Florescer';
              const customerName = payer.first_name ? `${payer.first_name} ${payer.last_name || ''}`.trim() : undefined;
              const customerEmail = payer.email;

              await activateUserPremium({
                userId,
                paymentId: String(paymentId),
                type: 'pix_prepaid',
                planId,
                durationDays: 30
              });

              // Disparar Alerta de Venda para o Administrador (Push Hotmart + E-mail)
              notifyAdminSaleApproved({
                transactionId: String(paymentId),
                type: 'pix_prepaid',
                planName,
                amount: Number(paymentData.transaction_amount) || 29.90,
                customerName,
                customerEmail,
                userId: String(userId),
                paymentMethod: paymentData.payment_method_id ? paymentData.payment_method_id.toUpperCase() : 'PIX'
              }).catch(err => console.error('[MP Webhook] Error notifying admin on PIX sale:', err));
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

// Endpoint para salvar token FCM de Administrador/Dispositivo diretamente no Firestore via Admin SDK
app.post("/api/admin/save-token", async (req, res) => {
  try {
    const { userId, token, userEmail, platform } = req.body || {};
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return res.status(400).json({ error: "Token FCM inválido ou vazio" });
    }

    const cleanToken = token.trim();
    console.log(`[Admin Save Token] Recebido token do cliente. UserId: ${userId || 'N/A'}, Email: ${userEmail || 'N/A'}, Token: ${cleanToken.substring(0, 16)}...`);

    const firestore = getFirestore();
    if (userId) {
      const userRef = firestore.collection("users").doc(userId);
      const userDoc = await userRef.get();
      let currentTokens: string[] = [];
      let isAdmin = false;

      if (userDoc.exists) {
        const data = userDoc.data() || {};
        if (Array.isArray(data.fcmTokens)) {
          currentTokens = data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 10 && t !== cleanToken);
        }
        if (data.isAdmin === true) isAdmin = true;
      }

      const normalizedEmail = (userEmail || userDoc.data()?.email || '').toLowerCase().trim();
      const lowerAdminEmails = DEFAULT_ADMIN_EMAILS.map(e => e.toLowerCase().trim());
      if (lowerAdminEmails.includes(normalizedEmail)) {
        isAdmin = true;
      }

      const updatedTokens = [...currentTokens.slice(-4), cleanToken];
      await userRef.set({
        fcmTokens: updatedTokens,
        fcmToken: cleanToken,
        fcmTokenUpdatedAt: new Date().toISOString(),
        fcmPlatform: platform || 'Web/PWA',
        ...(isAdmin ? { isAdmin: true } : {})
      }, { merge: true });

      console.log(`[Admin Save Token] ✅ Token gravado com sucesso no Firestore para UID: ${userId} (isAdmin: ${isAdmin}, total tokens: ${updatedTokens.length})`);
    }

    res.json({
      success: true,
      message: "Token sincronizado com sucesso no Firestore e Servidor",
      tokenPrefix: cleanToken.substring(0, 16) + '...'
    });
  } catch (err: any) {
    console.error("[Admin Save Token] Erro ao gravar token:", err);
    res.status(500).json({ error: err?.message || "Falha ao gravar token no banco" });
  }
});

// Endpoint para testar o alerta de vendas estilo Hotmart (Push + E-mail)
app.post("/api/admin/test-sale-alert", async (req, res) => {
  try {
    const { 
      amount = 29.90, 
      planName = "Passe VIP 30 Dias (PIX)", 
      customerName = "Cliente Teste", 
      customerEmail = "teste@exemplo.com",
      userId,
      paymentMethod = "PIX"
    } = req.body || {};
    
    const testId = `test_${Date.now()}`;
    const result = await notifyAdminSaleApproved({
      transactionId: testId,
      type: 'pix_prepaid',
      planName,
      amount: Number(amount),
      customerName,
      customerEmail,
      userId,
      paymentMethod
    });

    res.json({ success: true, testId, result });
  } catch (error: any) {
    console.error("[Test Sale Alert] Error:", error);
    res.status(500).json({ error: error?.message || "Failed to trigger test sale alert" });
  }
});

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

    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash"];
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

    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash"];
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
    const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.6-flash"];
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
    const { notes, period } = req.body || {};
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

    // Limitar para até 15 anotações e truncar cada anotação a no máximo 600 caracteres para proteção de tokens
    const sanitizedNotes = notes.slice(0, 15).map((n: any, i: number) => {
      const title = typeof n.title === 'string' && n.title.trim() ? ` [Título: ${n.title.trim()}]` : '';
      const date = typeof n.date === 'string' && n.date.trim() ? n.date.trim() : 'Data recente';
      let content = typeof n.content === 'string' ? n.content.trim() : '';
      if (content.length > 600) {
        content = content.substring(0, 597) + '...';
      }
      return `[Reflexão ${i + 1} - ${date}${title}]:\n${content}`;
    }).filter(t => t.length > 0);

    const notesSummaryText = sanitizedNotes.join('\n\n');

    const periodLabel = period === '7d' 
      ? 'dos últimos 7 dias' 
      : period === '30d' 
        ? 'do último mês' 
        : 'recentes';

    const prompt = `Você é um mentor e conselheiro espiritual cristão acolhedor, empático e sábio do aplicativo Florescer.
Abaixo estão as anotações e orações do diário espiritual de um usuário ${periodLabel}:

---
${notesSummaryText}
---

Sua missão é gerar um "Resumo Espiritual" caloroso, pastoral, reflexivo e altamente encorajador.
Retorne um JSON estruturado com os seguintes campos:
- "title": Título inspirador e poético que resume a essência do momento espiritual (ex: "Sua Jornada de Paz, Esperança e Confiança").
- "summary": Resumo geral reflexivo e afetuoso sobre os sentimentos, preces e crescimento expressos pelo usuário (2 a 3 parágrafos confortáveis e afetuosos).
- "spiritualHighlights": Array com 2 a 4 pontos de destaque ou temas centrais identificados nas anotações (strings curtas começando com um emoji, ex: "🌱 Cultivando paciência em momentos de espera").
- "verseGuidance": Versículo bíblico encorajador perfeito para a fase atual com a referência (ex: "O Senhor é o meu pastor; nada me faltará. (Salmos 23:1)").
- "personalPrayer": Uma oração pessoal, profunda e encorajadora para encerrar a leitura e abençoar a caminhada com Deus.`;

    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
      "gemini-3.6-flash"
    ];
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
        // Pequena pausa para evitar spike se houver 503
        await new Promise((resolve) => setTimeout(resolve, 300));
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

const CURATED_CHRISTIAN_BACKGROUNDS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&auto=format&fit=crop&q=80', // Amanhecer na praia
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&auto=format&fit=crop&q=80', // Montanhas majestosas
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1080&auto=format&fit=crop&q=80', // Luz suave entre árvores
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1080&auto=format&fit=crop&q=80', // Céu estrelado sereno
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1080&auto=format&fit=crop&q=80', // Flores desabrochando ao sol
  'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=1080&auto=format&fit=crop&q=80', // Campo calmo ao entardecer
];

app.post("/api/gemini/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body || {};
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY;

    let visualPrompt = prompt?.trim() || 'peaceful biblical sunrise over mountains, golden light, spiritual serenity';
    let englishKeywords = 'nature,peaceful,sunrise,spiritual';

    // 1. Otimização Inteligente do Prompt com Gemini (se disponível)
    if (geminiApiKey && prompt?.trim()) {
      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash'];
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
            contents: `Transform this user input into a detailed, poetic and visual English photography prompt for a vertical wallpaper (Stories 9:16), cinematic, serene and beautiful. Avoid people faces or text. Prompt: "${prompt}"`
          });
          if (response?.text) {
            visualPrompt = response.text.trim().replace(/["']/g, '');
            englishKeywords = visualPrompt.slice(0, 100);
            break;
          }
        } catch (e: any) {
          continue;
        }
      }
    }

    let imageBuffer: Buffer | null = null;
    let imageMimeType = 'image/jpeg';

    // 2. Método Principal: Geração de Imagem com IA (Pollinations AI turbo - rápido e estável)
    try {
      const seed = Math.floor(Math.random() * 900000) + 100000;
      const cleanVisualPrompt = encodeURIComponent(`${visualPrompt}, vertical wallpaper 9:16, aesthetic warm lighting, high quality`);
      const aiImageUrl = `https://image.pollinations.ai/prompt/${cleanVisualPrompt}?width=540&height=960&nologo=true&seed=${seed}&model=turbo`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout
      
      const aiRes = await fetch(aiImageUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (aiRes.ok) {
        const arrayBuffer = await aiRes.arrayBuffer();
        if (arrayBuffer && arrayBuffer.byteLength > 1000) {
          imageBuffer = Buffer.from(arrayBuffer);
          imageMimeType = aiRes.headers.get('content-type') || 'image/jpeg';
        }
      }
    } catch (aiErr: any) {
      if (aiErr?.name !== 'AbortError') {
        console.warn('[Generate Image] Pollinations AI attempt failed, falling back:', aiErr?.message || aiErr);
      }
    }

    // 3. Fallback Unsplash (se a chave estiver configurada ou busca direta)
    if (!imageBuffer && unsplashApiKey) {
      try {
        let unsplashUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(englishKeywords)}&orientation=portrait&client_id=${unsplashApiKey}`;
        let unsplashRes = await fetch(unsplashUrl);
        if (!unsplashRes.ok) {
          unsplashUrl = `https://api.unsplash.com/photos/random?query=nature,landscape,peaceful&orientation=portrait&client_id=${unsplashApiKey}`;
          unsplashRes = await fetch(unsplashUrl);
        }
        if (unsplashRes.ok) {
          const unsplashData = await unsplashRes.json();
          const photoUrl = unsplashData.urls?.regular || unsplashData.urls?.small;
          if (photoUrl) {
            const photoRes = await fetch(photoUrl);
            const arrayBuffer = await photoRes.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            imageMimeType = photoRes.headers.get('content-type') || 'image/jpeg';
          }
        }
      } catch (unsplashErr) {
        console.warn('[Generate Image] Unsplash API fallback failed:', unsplashErr);
      }
    }

    // 4. Fallback de Segurança com Curated CDN
    if (!imageBuffer) {
      const randomIndex = Math.floor(Math.random() * CURATED_CHRISTIAN_BACKGROUNDS.length);
      const fallbackUrl = CURATED_CHRISTIAN_BACKGROUNDS[randomIndex];
      const fallbackRes = await fetch(fallbackUrl);
      const arrayBuffer = await fallbackRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      imageMimeType = fallbackRes.headers.get('content-type') || 'image/jpeg';
    }

    const base64 = imageBuffer.toString('base64');
    return res.status(200).json({ 
      image: `data:${imageMimeType};base64,${base64}`,
      prompt: visualPrompt 
    });
  } catch (error: any) {
    console.error("Error generating image in /api/index:", error);
    let msg = error?.message || "Não foi possível gerar a imagem no momento.";
    return res.status(500).json({ error: msg });
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

// 4. Cron Jobs info (standalone in /api/cron/* on Vercel)
app.all("/api/cron/daily-push", (req, res) => res.json({ status: "ok", message: "Cron endpoint active at /api/cron/daily-push" }));
app.all("/api/cron/coins-reminder", (req, res) => res.json({ status: "ok", message: "Cron endpoint active at /api/cron/coins-reminder" }));

export default app;
