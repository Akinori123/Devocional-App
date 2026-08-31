import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import nodemailer from 'nodemailer';

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

// Lista nativa padrão de e-mails de administradores já integrados ao sistema
const DEFAULT_ADMIN_EMAILS = [
  'dofekrafael@gmail.com',
  'sjhonatan916@gmail.com',
  'floresceremadoracao@gmail.com',
  'contatoday@gmail.com'
];

/**
 * Formata valor em Real Brasileiro (BRL)
 */
export function formatCurrencyBRL(value: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  }
}

/**
 * Cria o transporte SMTP gratuito (Gmail ou SMTP padrão) caso configurado nas variáveis de ambiente.
 */
function createFreeMailTransporter() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  // Configuração padrão para Gmail ou SMTP genérico
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

/**
 * Dispara Alerta de Nova Venda (Push Notification Hotmart Style + E-mail Gratuito) para o Administrador
 */
export async function notifyAdminSaleApproved(params: AdminSaleAlertParams): Promise<{
  pushSent: boolean;
  emailSent: boolean;
  recipientsCount: number;
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

  // 1. Verificação de Idempotência no Firestore (Evitar disparos duplicados de webhooks do Mercado Pago)
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

  // 2. Coletar Contas de Administrador e seus Tokens FCM (100% Automático)
  const adminEmailsSet = new Set<string>(DEFAULT_ADMIN_EMAILS);
  if (process.env.ADMIN_EMAIL) {
    process.env.ADMIN_EMAIL.split(',').map(e => e.trim()).filter(Boolean).forEach(e => adminEmailsSet.add(e));
  }

  const adminFcmTokens = new Set<string>();

  try {
    // Buscar no Firestore todos os usuários administradores
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

    // Buscar pelos emails conhecidos para resgatar tokens FCM associados
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
    }
  } catch (fetchErr) {
    console.error('[Admin Sale Alert] Error fetching admin tokens:', fetchErr);
  }

  const tokensList = Array.from(adminFcmTokens);
  let pushSent = false;

  // 3. Disparo de Push Notification Estilo Hotmart (100% Gratuito via Firebase Cloud Messaging)
  if (tokensList.length > 0) {
    try {
      const messaging = getMessaging();
      const pushTitle = `🎉 Nova Venda! Assinatura confirmada no valor de ${amountFormatted}`;
      const pushBody = `Cliente: ${customerDisplayName} (${customerEmail || 'E-mail não informado'})\nPlano: ${planName} | Método: ${paymentMethodLabel}`;

      const pushPayload = {
        notification: {
          title: pushTitle,
          body: pushBody,
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

      const response = await messaging.sendEachForMulticast({
        tokens: tokensList,
        notification: pushPayload.notification,
        webpush: pushPayload.webpush,
        data: pushPayload.data
      });

      console.log(`[Admin Sale Alert] Push sent: ${response.successCount} succeeded, ${response.failureCount} failed out of ${tokensList.length} admin devices.`);
      if (response.successCount > 0) {
        pushSent = true;
      }
    } catch (pushErr) {
      console.error('[Admin Sale Alert] Error sending FCM push notification:', pushErr);
    }
  } else {
    console.warn('[Admin Sale Alert] No active admin FCM tokens found in database to send push.');
  }

  // 4. Disparo de E-mail de Alerta Gratuito (Gmail SMTP)
  let emailSent = false;
  const adminEmailsList = Array.from(adminEmailsSet);

  // Determinar a URL correta do aplicativo para o botão de acesso
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
    .btn { display: inline-block; width: 100%; max-width: 320px; box-sizing: border-box; background-color: #fbbf24; color: #78350f !important; font-weight: 800; font-size: 15px; padding: 14px 20px; border-radius: 12px; text-decoration: none; text-align: center; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.35); }
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
        <a href="${adminDashboardUrl}" class="btn" style="display: inline-block; width: 100%; max-width: 320px; box-sizing: border-box; background-color: #fbbf24; color: #78350f !important; font-weight: 800; font-size: 15px; padding: 14px 20px; border-radius: 12px; text-decoration: none; text-align: center;">
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

  // 4.1 Envio via SMTP Gratuito (Gmail com Senha de Aplicativo, se configurado)
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

  // 5. Salvar Log Histórico Permanente no Firestore (Coleções `admin_sales_alerts` e `email_logs`)
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

    // Salvar também em email_logs para conferência no painel administrativo
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
    message: 'Sale alert processed'
  };
}
