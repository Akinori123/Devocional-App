import type { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import nodemailer from 'nodemailer';

function createStoreMailTransporter() {
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

function getAppBaseUrl(): string {
  const raw = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  let url = raw.trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url || 'https://florescer-devocional.vercel.app';
}

/**
 * 0. Buscar Categorias da Loja (API Segura Server-Side)
 */
export async function handleGetStoreCategories(req: Request, res: Response) {
  try {
    const firestore = getFirestore();
    const snap = await firestore.collection('store_categories').orderBy('order', 'asc').get();
    const categories: any[] = [];
    snap.forEach((doc) => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, categories });
  } catch (err: any) {
    console.error('[API Store] Error fetching categories:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao buscar categorias' });
  }
}

/**
 * 0.1 Buscar Produtos da Loja (API Segura Server-Side)
 */
export async function handleGetStoreProducts(req: Request, res: Response) {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const firestore = getFirestore();
    let queryRef: FirebaseFirestore.Query = firestore.collection('store_products');
    if (!includeInactive) {
      queryRef = queryRef.where('isActive', '==', true);
    }
    const snap = await queryRef.get();
    const products: any[] = [];
    snap.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });
    return res.json({ success: true, products });
  } catch (err: any) {
    console.error('[API Store] Error fetching products:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao buscar produtos' });
  }
}

/**
 * 0.2 Buscar Pedidos da Loja (API Segura Server-Side)
 */
export async function handleGetStoreOrders(req: Request, res: Response) {
  try {
    const userId = req.query.userId as string | undefined;
    const firestore = getFirestore();
    let snap: FirebaseFirestore.QuerySnapshot;

    if (userId) {
      // Query apenas por userId para não exigir índice composto (evita 9 FAILED_PRECONDITION)
      snap = await firestore.collection('store_orders').where('userId', '==', userId).get();
    } else {
      // Consulta admin de todos os pedidos
      snap = await firestore.collection('store_orders').get();
    }

    const orders: any[] = [];
    snap.forEach((doc) => {
      orders.push({ orderId: doc.id, ...doc.data() });
    });

    // Ordenação garantida em memória pelo mais recente (createdAt decrescente)
    orders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.json({ success: true, orders });
  } catch (err: any) {
    console.error('[API Store] Error fetching orders:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao buscar pedidos' });
  }
}

/**
 * 1. Criar Preferência de Pagamento no Mercado Pago (Checkout Pro) para Produtos da Loja
 */
export async function handleCreateStorePreference(req: Request, res: Response) {
  try {
    const { productId, deliveryAddress, userId, userEmail, userName } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'ID do produto é obrigatório' });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Credenciais do Mercado Pago não configuradas no servidor' });
    }

    const firestore = getFirestore();
    const productRef = firestore.collection('store_products').doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const product = productDoc.data()!;

    if (product.isActive === false) {
      return res.status(400).json({ error: 'Este produto está desativado no momento.' });
    }

    const stockNumber = Number(product.stock) || 0;
    if (stockNumber <= 0) {
      return res.status(400).json({ error: 'Produto esgotado.' });
    }

    const price = Number(product.price) || 0;
    if (price <= 0) {
      return res.status(400).json({ error: 'Preço do produto inválido.' });
    }

    // Gerar identificador único do pedido
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const orderData = {
      orderId,
      userId: userId || 'anonymous',
      userEmail: userEmail || deliveryAddress?.email || '',
      userName: userName || deliveryAddress?.fullName || 'Cliente Florescer',
      productId: productDoc.id,
      productName: product.title || 'Produto Loja Florescer',
      productImage: (Array.isArray(product.images) && product.images[0]) || '',
      unitPrice: price,
      quantity: 1,
      totalPrice: price,
      status: 'Aguardando Pagamento',
      trackingCode: '',
      deliveryAddress: deliveryAddress || null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // Salvar pedido inicial no Firestore
    await firestore.collection('store_orders').doc(orderId).set(orderData);

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
    });

    const preference = new Preference(client);
    const appBaseUrl = getAppBaseUrl();

    const prefResult = await preference.create({
      body: {
        items: [
          {
            id: String(productDoc.id),
            title: String(product.title).substring(0, 127),
            description: String(product.description || 'Loja Florescer').substring(0, 255),
            unit_price: price,
            quantity: 1,
            currency_id: 'BRL',
            picture_url: (Array.isArray(product.images) && product.images[0]) || undefined
          }
        ],
        payer: {
          email: userEmail || 'cliente@florescer.app',
          name: userName || deliveryAddress?.fullName || 'Cliente Florescer'
        },
        external_reference: orderId,
        metadata: {
          order_id: orderId,
          product_id: productDoc.id,
          user_id: userId || 'anonymous',
          type: 'store_order'
        },
        back_urls: {
          success: `${appBaseUrl}/?tab=profile&subTab=orders&orderId=${orderId}&payment=success`,
          pending: `${appBaseUrl}/?tab=profile&subTab=orders&orderId=${orderId}&payment=pending`,
          failure: `${appBaseUrl}/?tab=store&orderId=${orderId}&payment=failure`
        },
        auto_return: 'approved'
      }
    });

    await firestore.collection('store_orders').doc(orderId).update({
      preferenceId: prefResult.id,
      initPoint: prefResult.init_point
    });

    return res.json({
      success: true,
      orderId,
      preferenceId: prefResult.id,
      init_point: prefResult.init_point,
      sandbox_init_point: prefResult.sandbox_init_point
    });
  } catch (error: any) {
    console.error('[Store Preference Error]:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao criar preferência de pagamento' });
  }
}

/**
 * 2. Processar Pagamento de Pedido no Webhook do Mercado Pago (Idempotente + Baixa Atômica de Estoque)
 */
export async function handleProcessStoreOrderPayment(paymentData: any, firestore: FirebaseFirestore.Firestore): Promise<boolean> {
  try {
    const externalRef = paymentData.external_reference || (paymentData.metadata as any)?.order_id;
    if (!externalRef || typeof externalRef !== 'string') {
      return false;
    }

    const orderRef = firestore.collection('store_orders').doc(externalRef);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return false; // Não é um pedido da loja
    }

    const order = orderDoc.data()!;
    console.log(`[Store Webhook] Identificado pedido da loja: ${externalRef} com status atual: ${order.status}`);

    // IDEMPOTÊNCIA: Só processa se ainda estiver 'Aguardando Pagamento'
    if (order.status === 'Aguardando Pagamento') {
      await firestore.runTransaction(async (transaction) => {
        const prodRef = firestore.collection('store_products').doc(order.productId);
        const prodDoc = await transaction.get(prodRef);

        if (prodDoc.exists) {
          const currentStock = Number(prodDoc.data()?.stock) || 0;
          const newStock = Math.max(0, currentStock - 1);
          transaction.update(prodRef, {
            stock: newStock,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Store Webhook] Estoque atualizado para o produto ${order.productId}: ${currentStock} -> ${newStock}`);
        }

        transaction.update(orderRef, {
          status: 'Preparando Envio',
          paymentId: String(paymentData.id),
          paymentMethod: paymentData.payment_method_id ? String(paymentData.payment_method_id).toUpperCase() : 'Mercado Pago',
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      console.log(`[Store Webhook] ✅ Pedido ${externalRef} aprovado e atualizado para 'Preparando Envio' com sucesso!`);
    } else {
      console.log(`[Store Webhook] ℹ️ Pedido ${externalRef} já processado anteriormente (${order.status}). Ignorando duplicação.`);
    }

    return true;
  } catch (err) {
    console.error('[Store Webhook Error]:', err);
    return false;
  }
}

/**
 * 3. Atualizar Status do Pedido pelo Painel Admin com Notificação Condicional
 */
export async function handleUpdateStoreOrderStatus(req: Request, res: Response) {
  try {
    const { orderId, status, trackingCode } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ error: 'orderId e status são obrigatórios' });
    }

    const firestore = getFirestore();
    const orderRef = firestore.collection('store_orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const existingOrder = orderDoc.data()!;
    const oldStatus = existingOrder.status;
    const newStatus = status;
    const cleanTracking = trackingCode !== undefined && trackingCode !== null 
      ? String(trackingCode).trim().toUpperCase() 
      : (existingOrder.trackingCode || '');

    const updatePayload: any = {
      status: newStatus,
      trackingCode: cleanTracking,
      updatedAt: new Date().toISOString()
    };

    const isTransitionToShipped = (oldStatus !== 'Enviado' && newStatus === 'Enviado');
    if (isTransitionToShipped) {
      updatePayload.shippedAt = new Date().toISOString();
    }

    const isTransitionToDelivered = (newStatus === 'Entregue');
    if (isTransitionToDelivered && !existingOrder.deliveredAt) {
      updatePayload.deliveredAt = new Date().toISOString();
    }

    await orderRef.update(updatePayload);

    let pushSent = false;
    let emailSent = false;

    // Regra 6: Gatilho Condicional - A notificação só deve disparar se houver transição de status específica:
    // if (oldStatus !== 'Enviado' && newStatus === 'Enviado')
    if (isTransitionToShipped) {
      console.log(`[Store Shipping] Disparando notificações para o pedido ${orderId} (transição para 'Enviado')...`);
      
      const notifyResult = await notifyCustomerOrderShipped({
        orderId,
        userId: existingOrder.userId,
        userEmail: existingOrder.userEmail,
        userName: existingOrder.userName || 'Cliente',
        productName: existingOrder.productName || 'Seu Pedido',
        trackingCode: cleanTracking
      });

      pushSent = notifyResult.pushSent;
      emailSent = notifyResult.emailSent;
    }

    return res.json({
      success: true,
      orderId,
      oldStatus,
      newStatus,
      trackingCode: cleanTracking,
      notified: isTransitionToShipped,
      notifications: { pushSent, emailSent }
    });
  } catch (error: any) {
    console.error('[Update Order Status Error]:', error);
    return res.status(500).json({ error: error?.message || 'Falha ao atualizar status do pedido' });
  }
}

/**
 * 4. Envio de Push (FCM) e E-mail Transacional de Pedido Enviado
 */
export async function notifyCustomerOrderShipped(order: {
  orderId: string;
  userId: string;
  userEmail: string;
  userName: string;
  productName: string;
  trackingCode: string;
}): Promise<{ pushSent: boolean; emailSent: boolean }> {
  let pushSent = false;
  let emailSent = false;
  const firestore = getFirestore();

  // A. Push Notification (FCM)
  try {
    if (order.userId && order.userId !== 'anonymous' && getApps().length) {
      const userRef = firestore.collection('users').doc(order.userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data()!;
        const customerTokens = new Set<string>();

        if (typeof userData.fcmToken === 'string' && userData.fcmToken.trim().length > 10) {
          customerTokens.add(userData.fcmToken.trim());
        }
        if (Array.isArray(userData.fcmTokens)) {
          userData.fcmTokens.forEach((t: any) => {
            if (typeof t === 'string' && t.trim().length > 10) customerTokens.add(t.trim());
          });
        }

        const tokensList = Array.from(customerTokens);
        if (tokensList.length > 0) {
          const messaging = getMessaging();
          const title = 'O seu pedido foi enviado! 📦';
          const body = `O seu pedido (${order.productName}) foi enviado! 📦 Toque aqui para acompanhar a entrega.`;
          const clickUrl = `/?tab=profile&subTab=orders&orderId=${order.orderId}`;

          const response = await messaging.sendEachForMulticast({
            tokens: tokensList,
            notification: {
              title,
              body
            },
            android: {
              priority: 'high',
              notification: {
                title,
                body,
                sound: 'default',
                defaultSound: true,
                defaultVibrateTimings: true,
                channelId: 'store_orders',
                clickAction: clickUrl
              }
            },
            webpush: {
              headers: {
                Urgency: 'high',
                Topic: 'store-order-shipped'
              },
              notification: {
                title,
                body,
                icon: '/images/logo.png',
                tag: `store-shipped-${order.orderId}`,
                data: {
                  url: clickUrl,
                  orderId: order.orderId
                }
              },
              fcmOptions: {
                link: clickUrl
              }
            },
            data: {
              type: 'store_order_shipped',
              orderId: order.orderId,
              title,
              body,
              url: clickUrl
            }
          });

          if (response.successCount > 0) {
            pushSent = true;
            console.log(`[Store Push] ✅ Push enviado com sucesso para ${response.successCount} dispositivo(s) do cliente.`);
          }
        }
      }
    }
  } catch (pushErr) {
    console.warn('[Store Push] Falha ao enviar push para o cliente:', pushErr);
  }

  // B. E-mail Transacional com Link dos Correios
  try {
    if (order.userEmail && order.userEmail.includes('@')) {
      const transporter = createStoreMailTransporter();
      if (transporter) {
        const correiosUrl = `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(order.trackingCode || '')}`;
        const senderAddress = process.env.GMAIL_USER || process.env.SMTP_USER || 'floresceremadoracao@gmail.com';

        const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu Pedido Foi Enviado! - Loja Florescer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 16px; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 28px 24px; text-align: center; }
    .badge { display: inline-block; background: rgba(251, 191, 36, 0.2); color: #fbbf24; padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 12px; letter-spacing: 0.5px; }
    .content { padding: 28px 24px; }
    .tracking-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; text-align: center; margin: 20px 0; }
    .tracking-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.5px; margin-bottom: 6px; }
    .tracking-code { font-size: 24px; font-weight: 900; color: #15803d; letter-spacing: 2px; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; background: #0f172a; color: #ffffff !important; font-weight: 700; font-size: 15px; padding: 14px 20px; border-radius: 12px; text-decoration: none; text-align: center; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">📦 LOJA FLORESCER</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800;">Seu pedido está a caminho!</h1>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Olá, <strong>${order.userName}</strong>!</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.5;">
        Temos uma ótima notícia: o seu produto <strong>${order.productName}</strong> (Pedido #${order.orderId}) foi despachado e já está em trânsito para o seu endereço!
      </p>

      ${order.trackingCode ? `
      <div class="tracking-box">
        <div class="tracking-label">Código de Rastreamento Correios</div>
        <div class="tracking-code">${order.trackingCode}</div>
      </div>
      <a href="${correiosUrl}" target="_blank" class="btn">
        🚚 Acompanhar Entrega no Correios
      </a>
      ` : `
      <div class="tracking-box">
        <div class="tracking-label">Envio Realizado</div>
        <div style="font-size: 15px; font-weight: 600; color: #166534;">Seu pacote já está com a transportadora.</div>
      </div>
      `}

      <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.4;">
        Você também pode acompanhar todos os detalhes e o histórico do seu pedido diretamente na aba <strong>Meus Pedidos</strong> dentro do aplicativo Florescer.
      </p>
    </div>
    <div class="footer">
      Florescer Devocional • Papelaria & Itens Especiais<br>
      Em caso de dúvidas, fale conosco pelo suporte no aplicativo.
    </div>
  </div>
</body>
</html>
        `;

        await transporter.sendMail({
          from: `"Loja Florescer" <${senderAddress}>`,
          to: order.userEmail,
          subject: `O seu pedido (${order.productName}) foi enviado! 📦`,
          html: emailHtml
        });

        emailSent = true;
        console.log(`[Store Email] ✅ E-mail de rastreio enviado com sucesso para ${order.userEmail}`);
      }
    }
  } catch (emailErr) {
    console.warn('[Store Email] Falha ao enviar e-mail para o cliente:', emailErr);
  }

  return { pushSent, emailSent };
}

/**
 * 4. Criar Categoria da Loja (Server-side com Firebase Admin)
 */
export async function handleCreateStoreCategory(req: Request, res: Response) {
  try {
    const { name, order } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }
    const firestore = getFirestore();
    const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const categoryData = {
      id: categoryId,
      name: name.trim(),
      order: Number(order) || 0
    };
    await firestore.collection('store_categories').doc(categoryId).set(categoryData);
    return res.json({ success: true, category: categoryData });
  } catch (err: any) {
    console.error('[API Store] Error creating category:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao criar categoria' });
  }
}

/**
 * 4.1 Atualizar Categoria da Loja
 */
export async function handleUpdateStoreCategory(req: Request, res: Response) {
  try {
    const id = req.params.id || req.body.id;
    const { name, order } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'ID da categoria é obrigatório' });
    }
    const firestore = getFirestore();
    const updateData: any = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (order !== undefined) updateData.order = Number(order) || 0;

    await firestore.collection('store_categories').doc(id).update(updateData);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[API Store] Error updating category:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao atualizar categoria' });
  }
}

/**
 * 4.2 Excluir Categoria da Loja
 */
export async function handleDeleteStoreCategory(req: Request, res: Response) {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'ID da categoria é obrigatório' });
    }
    const firestore = getFirestore();
    await firestore.collection('store_categories').doc(id).delete();
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[API Store] Error deleting category:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao excluir categoria' });
  }
}

/**
 * 5. Criar Produto da Loja (Server-side com Firebase Admin)
 */
export async function handleCreateStoreProduct(req: Request, res: Response) {
  try {
    const { title, description, price, stock, categoryId, isActive, images } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Título do produto é obrigatório' });
    }
    const firestore = getFirestore();
    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const productData = {
      id: productId,
      title: title.trim(),
      description: (description || '').trim(),
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      categoryId: categoryId || '',
      isActive: isActive !== false,
      images: Array.isArray(images) ? images : [],
      createdAt: now,
      updatedAt: now
    };
    await firestore.collection('store_products').doc(productId).set(productData);
    return res.json({ success: true, product: productData });
  } catch (err: any) {
    console.error('[API Store] Error creating product:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao criar produto' });
  }
}

/**
 * 5.1 Atualizar Produto da Loja
 */
export async function handleUpdateStoreProduct(req: Request, res: Response) {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'ID do produto é obrigatório' });
    }
    const firestore = getFirestore();
    const updateData: any = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    delete updateData.id;

    await firestore.collection('store_products').doc(id).update(updateData);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[API Store] Error updating product:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao atualizar produto' });
  }
}

/**
 * 5.2 Excluir Produto da Loja (Server-side com Firebase Admin)
 * Se permanent=true ou se não existirem pedidos vinculados, remove o produto definitivamente do Firestore.
 * Se tiver pedidos, faz soft delete (isActive: false) para preservar histórico de vendas.
 */
export async function handleDeleteStoreProduct(req: Request, res: Response) {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'ID do produto é obrigatório' });
    }
    const permanent = req.query.permanent === 'true' || req.body?.permanent === true;
    const firestore = getFirestore();

    // Verificar se existem pedidos vinculados
    const ordersSnap = await firestore
      .collection('store_orders')
      .where('productId', '==', id)
      .limit(1)
      .get();

    if (ordersSnap.empty || permanent) {
      // Exclui permanentemente do Firestore
      await firestore.collection('store_products').doc(id).delete();
      return res.json({ success: true, mode: 'deleted_permanently' });
    } else {
      // Possui pedidos históricos: apenas desativa da vitrine
      await firestore.collection('store_products').doc(id).update({
        isActive: false,
        updatedAt: new Date().toISOString()
      });
      return res.json({ success: true, mode: 'soft_deleted' });
    }
  } catch (err: any) {
    console.error('[API Store] Error deleting product:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao excluir produto' });
  }
}

