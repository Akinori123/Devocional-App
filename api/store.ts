import type { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
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
    const rawUserId = req.query.userId as string | undefined;
    const rawUserEmail = req.query.userEmail as string | undefined;
    const includeUnpaid = req.query.includeUnpaid === 'true';
    const userId = rawUserId && rawUserId !== 'undefined' && rawUserId !== 'null' && rawUserId.trim() !== '' 
      ? rawUserId.trim() 
      : undefined;
    const userEmail = rawUserEmail && rawUserEmail !== 'undefined' && rawUserEmail !== 'null' && rawUserEmail.trim() !== ''
      ? rawUserEmail.trim().toLowerCase()
      : undefined;

    const firestore = getFirestore();
    let snap: FirebaseFirestore.QuerySnapshot;
    const orders: any[] = [];

    if (userId || userEmail) {
      // Query por userId e/ou userEmail para a tela Meus Pedidos no Perfil do usuário
      snap = await firestore.collection('store_orders').get();
      const userOrdersRaw: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        const matchesUid = userId && data.userId === userId;
        const matchesEmail = userEmail && data.userEmail && String(data.userEmail).trim().toLowerCase() === userEmail;
        if (matchesUid || matchesEmail) {
          userOrdersRaw.push({ orderId: doc.id, ...data });
        }
      });

      // Deduplicação inteligente para o perfil: se o usuário possui um pedido pago para o produto,
      // descarta tentativas duplicadas que ficaram como "Aguardando Pagamento"
      const productPaidMap = new Set<string>();
      userOrdersRaw.forEach(o => {
        if (o.status && o.status !== 'Aguardando Pagamento') {
          productPaidMap.add(o.productId || o.productName);
        }
      });

      userOrdersRaw.forEach(o => {
        const isPaid = o.status && o.status !== 'Aguardando Pagamento';
        const key = o.productId || o.productName;
        // Se já está pago, inclui com certeza.
        // Se ainda está pendente, só inclui se não houver um pedido já pago para o mesmo produto.
        if (isPaid || !productPaidMap.has(key)) {
          orders.push(o);
        }
      });
    } else {
      // Consulta do Painel Admin: Por padrão, exibe apenas pedidos com pagamento confirmado
      // (Preparando Envio, Enviado, Entregue, etc.). Checkouts abandonados/não pagos não entram no painel.
      snap = await firestore.collection('store_orders').get();
      const rawAdminOrders: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        const isUnpaid = data.status === 'Aguardando Pagamento';
        if (!isUnpaid || includeUnpaid) {
          rawAdminOrders.push({ orderId: doc.id, ...data });
        }
      });

      // Deduplicação inteligente para o painel de administração:
      // Se houver múltiplos registros com o mesmo paymentId ou tentativas repetidas do mesmo usuário/produto,
      // preserva o registro mais completo (com rastreio ou mais recente).
      const seenPaymentIds = new Set<string>();
      const userProductMap = new Map<string, any>();

      // Ordena previamente para priorizar os mais completos
      rawAdminOrders.sort((a, b) => {
        const hasTrackA = a.trackingCode ? 1 : 0;
        const hasTrackB = b.trackingCode ? 1 : 0;
        if (hasTrackA !== hasTrackB) return hasTrackB - hasTrackA;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      for (const ord of rawAdminOrders) {
        // Se possui paymentId e já foi visto, é duplicata exata de webhook/checkout
        if (ord.paymentId && seenPaymentIds.has(String(ord.paymentId))) {
          continue;
        }
        if (ord.paymentId) {
          seenPaymentIds.add(String(ord.paymentId));
        }

        const userKey = (ord.userId && ord.userId !== 'anonymous') ? ord.userId : (ord.userEmail || 'anon');
        const prodKey = ord.productId || ord.productName || ord.orderId;
        const groupKey = `${userKey}__${prodKey}`;

        // Se ambos são duplicatas idênticas sem rastreio criadas no mesmo contexto de teste
        if (userProductMap.has(groupKey)) {
          const existing = userProductMap.get(groupKey);
          // Se o existente tem o mesmo status e foi criado no mesmo dia/sessão de teste, descarta a duplicata
          const isSameDay = existing.createdAt && ord.createdAt &&
            existing.createdAt.substring(0, 10) === ord.createdAt.substring(0, 10);
          if (isSameDay && !ord.trackingCode) {
            continue;
          }
        }

        userProductMap.set(groupKey, ord);
        orders.push(ord);
      }
    }

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

    // Anti-duplicação: Verificar se o usuário já possui um pedido pendente (Aguardando Pagamento) para este produto
    let orderId = (typeof req.body.orderId === 'string' && req.body.orderId.trim()) ? req.body.orderId.trim() : '';

    if (!orderId && userId && userId !== 'anonymous') {
      const recentPendingSnap = await firestore
        .collection('store_orders')
        .where('userId', '==', userId)
        .where('productId', '==', productDoc.id)
        .where('status', '==', 'Aguardando Pagamento')
        .limit(1)
        .get();

      if (!recentPendingSnap.empty) {
        orderId = recentPendingSnap.docs[0].id;
        console.log(`[Store] Reutilizando pedido pendente existente (${orderId}) para evitar pedidos duplicados no checkout.`);
      }
    }

    if (!orderId) {
      // Gerar identificador único do pedido
      orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
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

    // Salvar/Atualizar pedido no Firestore com merge para preservar dados prévios se reutilizado
    await firestore.collection('store_orders').doc(orderId).set(orderData, { merge: true });

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
          success: `${appBaseUrl}/?tab=profile&subTab=orders&orderId=${orderId}&payment=success&type=store_order`,
          pending: `${appBaseUrl}/?tab=profile&subTab=orders&orderId=${orderId}&payment=pending&type=store_order`,
          failure: `${appBaseUrl}/?tab=store&orderId=${orderId}&payment=failure&type=store_order`
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

        // Idempotência e Chave Única garantida: atualiza com setDoc merge: true
        transaction.set(orderRef, {
          status: 'Preparando Envio',
          paymentId: String(paymentData.id),
          paymentMethod: paymentData.payment_method_id ? String(paymentData.payment_method_id).toUpperCase() : 'Mercado Pago',
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
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
 * 2.1 Verificar e Confirmar Pagamento de Pedido com o Mercado Pago (Fallback Resiliente & Sincronização em Tempo Real)
 */
export async function handleVerifyStoreOrderPayment(req: Request, res: Response) {
  try {
    const orderId = req.params.orderId || req.body?.orderId || req.query?.orderId;
    const paymentId = req.body?.paymentId || req.query?.paymentId || req.query?.['data.id'] || req.query?.collection_id;

    if (!orderId && !paymentId) {
      return res.status(400).json({ error: 'orderId ou paymentId é obrigatório' });
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'Mercado Pago access token não configurado no servidor' });
    }

    const firestore = getFirestore();
    const targetOrderId = typeof orderId === 'string' ? orderId.trim() : '';

    if (targetOrderId) {
      const orderDoc = await firestore.collection('store_orders').doc(targetOrderId).get();
      if (orderDoc.exists) {
        const orderData = orderDoc.data()!;
        if (orderData.status !== 'Aguardando Pagamento') {
          return res.json({ 
            success: true, 
            status: orderData.status, 
            message: `Pedido já está com status: ${orderData.status}`,
            order: orderData
          });
        }
      }
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
    });

    const payment = new Payment(client);

    // 1. Se recebemos o paymentId direto (ex: ID da operação no extrato do Mercado Pago / Pix / Cartão), consulta ele diretamente
    if (paymentId && String(paymentId).trim()) {
      const cleanPaymentId = String(paymentId).replace(/\D/g, '');
      if (cleanPaymentId) {
        try {
          const paymentData = await payment.get({ id: Number(cleanPaymentId) });
          if (paymentData && paymentData.status === 'approved') {
            await handleProcessStoreOrderPayment(paymentData, firestore);
            return res.json({
              success: true,
              status: 'Preparando Envio',
              orderId: targetOrderId || paymentData.external_reference,
              paymentId: String(paymentData.id),
              message: 'Pagamento aprovado no Mercado Pago e confirmado com sucesso!'
            });
          }
        } catch (pErr: any) {
          console.warn('[Verify Payment] Falha ao consultar paymentId direto:', pErr?.message || pErr);
        }
      }
    }

    // 2. Se temos o orderId, faz busca de pagamentos no Mercado Pago pelo external_reference
    if (targetOrderId) {
      try {
        const searchResult = await payment.search({
          options: {
            external_reference: targetOrderId,
            sort: 'date_created',
            criteria: 'desc'
          }
        });

        const approvedPayment = searchResult.results?.find(p => p.status === 'approved');
        if (approvedPayment) {
          await handleProcessStoreOrderPayment(approvedPayment, firestore);
          return res.json({
            success: true,
            status: 'Preparando Envio',
            orderId: targetOrderId,
            paymentId: String(approvedPayment.id),
            message: 'Pagamento aprovado encontrado no Mercado Pago e sincronizado com sucesso!'
          });
        }
      } catch (sErr: any) {
        console.warn('[Verify Payment] Falha na busca por external_reference:', sErr?.message || sErr);
      }
    }

    // 3. Estratégia Resiliente Ampla: Buscar pagamentos recentes aprovados no Mercado Pago
    // e verificar correspondência por email do usuário, valor da compra ou metadados
    try {
      const recentSearch = await payment.search({
        options: {
          sort: 'date_created',
          criteria: 'desc',
          limit: 30
        }
      });

      if (Array.isArray(recentSearch.results) && recentSearch.results.length > 0) {
        let matchedPayment = null;

        // Recupera dados do pedido local para cruzamento inteligente
        let localOrderData: any = null;
        if (targetOrderId) {
          const docSnap = await firestore.collection('store_orders').doc(targetOrderId).get();
          if (docSnap.exists) {
            localOrderData = docSnap.data();
          }
        }

        const userEmailToMatch = (req.body?.userEmail || localOrderData?.userEmail || '').trim().toLowerCase();
        const expectedPrice = localOrderData?.totalPrice ? Number(localOrderData.totalPrice) : undefined;

        for (const p of recentSearch.results) {
          if (p.status !== 'approved') continue;

          // Se bate o external_reference
          if (targetOrderId && (p.external_reference === targetOrderId || (p.metadata as any)?.order_id === targetOrderId)) {
            matchedPayment = p;
            break;
          }

          // Se bate o e-mail do pagador e o valor do produto
          const payerEmail = (p.payer?.email || (p.additional_info as any)?.payer?.email || '').toLowerCase();
          if (userEmailToMatch && payerEmail === userEmailToMatch) {
            if (expectedPrice === undefined || Math.abs(Number(p.transaction_amount) - expectedPrice) < 0.05) {
              matchedPayment = p;
              break;
            }
          }
        }

        if (matchedPayment) {
          // Vincula o pedido ao pagamento aprovado encontrado
          if (targetOrderId) {
            matchedPayment.external_reference = targetOrderId;
          }
          await handleProcessStoreOrderPayment(matchedPayment, firestore);
          return res.json({
            success: true,
            status: 'Preparando Envio',
            orderId: targetOrderId || matchedPayment.external_reference,
            paymentId: String(matchedPayment.id),
            message: 'Pagamento aprovado localizado no Mercado Pago e confirmado com sucesso!'
          });
        }
      }
    } catch (broadErr: any) {
      console.warn('[Verify Payment] Falha na busca ampla de pagamentos recentes:', broadErr?.message || broadErr);
    }

    return res.json({
      success: false,
      status: 'Aguardando Pagamento',
      message: 'Nenhum pagamento aprovado foi localizado no Mercado Pago para este pedido até o momento.'
    });
  } catch (err: any) {
    console.error('[API Store] Erro ao verificar pagamento do pedido:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao verificar pagamento do pedido' });
  }
}

/**
 * 3. Atualizar Status do Pedido pelo Painel Admin com Notificação Condicional
 */
export async function handleUpdateStoreOrderStatus(req: Request, res: Response) {
  try {
    const { orderId, status, trackingCode, deliveryAddress, userName, userEmail, totalPrice, notes } = req.body;

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

    if (deliveryAddress !== undefined) {
      updatePayload.deliveryAddress = deliveryAddress;
    }
    if (userName !== undefined) {
      updatePayload.userName = userName;
    }
    if (userEmail !== undefined) {
      updatePayload.userEmail = userEmail;
    }
    if (totalPrice !== undefined && !isNaN(Number(totalPrice))) {
      updatePayload.totalPrice = Number(totalPrice);
    }
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

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

/**
 * 6. Excluir Pedido da Loja Individualmente (Server-side com Firebase Admin)
 */
export async function handleDeleteStoreOrder(req: Request, res: Response) {
  try {
    const id = req.params.id || req.body.orderId || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'ID do pedido é obrigatório' });
    }

    const firestore = getFirestore();
    const docRef = firestore.collection('store_orders').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.json({ success: true, message: 'Pedido já não existia ou foi removido' });
    }

    await docRef.delete();
    console.log(`[API Store] Pedido ${id} excluído com sucesso do Firestore`);
    return res.json({ success: true, deletedOrderId: id });
  } catch (err: any) {
    console.error('[API Store] Erro ao excluir pedido:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao excluir pedido' });
  }
}

/**
 * 6.1 Limpar/Excluir Pedidos de Teste em Massa (Server-side com Firebase Admin)
 */
export async function handleClearStoreOrders(req: Request, res: Response) {
  try {
    const firestore = getFirestore();
    const { orderIds, all = true } = req.body || {};

    let deletedCount = 0;

    if (Array.isArray(orderIds) && orderIds.length > 0) {
      // Excluir IDs específicos fornecidos
      const batch = firestore.batch();
      for (const id of orderIds) {
        batch.delete(firestore.collection('store_orders').doc(id));
        deletedCount++;
      }
      await batch.commit();
    } else if (all) {
      // Excluir todos os pedidos de teste armazenados
      const snap = await firestore.collection('store_orders').get();
      if (!snap.empty) {
        const batch = firestore.batch();
        snap.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        await batch.commit();
      }
    }

    console.log(`[API Store] Limpeza de pedidos concluída. Total excluído: ${deletedCount}`);
    return res.json({ success: true, deletedCount });
  } catch (err: any) {
    console.error('[API Store] Erro ao limpar pedidos de teste:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao limpar pedidos' });
  }
}

/**
 * 6.2 Limpar Pedidos Duplicados/Órfãos no Firestore
 * Identifica pedidos pendentes repetidos para o mesmo usuário/produto e remove as cópias não pagas.
 */
export async function handleDeduplicateStoreOrders(req: Request, res: Response) {
  try {
    const firestore = getFirestore();
    const snap = await firestore.collection('store_orders').get();
    
    if (snap.empty) {
      return res.json({ success: true, removedCount: 0, message: 'Nenhum pedido encontrado' });
    }

    // Se houver credenciais do Mercado Pago, tenta validar se algum pedido pendente foi pago
    if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
      try {
        const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
        const payment = new Payment(client);
        
        for (const doc of snap.docs) {
          const d = doc.data();
          if (d.status === 'Aguardando Pagamento') {
            try {
              const searchResult = await payment.search({
                options: {
                  external_reference: doc.id,
                  sort: 'date_created',
                  criteria: 'desc'
                }
              });
              const approvedPayment = searchResult.results?.find(p => p.status === 'approved');
              if (approvedPayment) {
                await handleProcessStoreOrderPayment(approvedPayment, firestore);
              }
            } catch (pErr) {
              // Silently ignore individual check error
            }
          }
        }
      } catch (mpErr) {
        console.warn('[Deduplicate Orders] Aviso ao consultar Mercado Pago:', mpErr);
      }
    }

    // Recarrega os pedidos atualizados após a tentativa de confirmação com MP
    const updatedSnap = await firestore.collection('store_orders').get();

    // Agrupamento para deduplicação inteligente:
    // Identifica pedidos do mesmo usuário para o mesmo produto
    const groups = new Map<string, any[]>();
    
    updatedSnap.forEach((doc) => {
      const data = { id: doc.id, ...(doc.data() as any) };
      // Chave de agrupamento: userId (ou email) + productId
      const userKey = (data.userId && data.userId !== 'anonymous') ? data.userId : (data.userEmail || 'anon');
      const prodKey = data.productId || data.productName || 'unknown_prod';
      const groupKey = `${userKey}__${prodKey}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(data);
    });

    const batch = firestore.batch();
    let removedCount = 0;

    for (const [, ordersList] of groups.entries()) {
      if (ordersList.length <= 1) {
        continue;
      }

      // Se houver mais de 1 pedido para o mesmo usuário e produto:
      // Prioridade para preservar o mais completo:
      // 1) Com código de rastreio preenchido
      // 2) Pedidos com pagamento confirmado (Preparando Envio, Enviado, Entregue)
      // 3) Pedido com paymentId registrado
      // 4) Pedido mais recente
      ordersList.sort((a, b) => {
        const hasTrackA = a.trackingCode ? 1 : 0;
        const hasTrackB = b.trackingCode ? 1 : 0;
        if (hasTrackA !== hasTrackB) return hasTrackB - hasTrackA;

        const isPaidA = a.status !== 'Aguardando Pagamento' ? 1 : 0;
        const isPaidB = b.status !== 'Aguardando Pagamento' ? 1 : 0;
        if (isPaidA !== isPaidB) return isPaidB - isPaidA;

        const hasPayIdA = a.paymentId ? 1 : 0;
        const hasPayIdB = b.paymentId ? 1 : 0;
        if (hasPayIdA !== hasPayIdB) return hasPayIdB - hasPayIdA;

        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      // O primeiro da lista (índice 0) é o pedido oficial e mais completo.
      // Os demais do mesmo usuário/produto são duplicatas excedentes geradas por testes/cliques repetidos.
      for (let i = 1; i < ordersList.length; i++) {
        const duplicate = ordersList[i];
        batch.delete(firestore.collection('store_orders').doc(duplicate.id));
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await batch.commit();
    }

    console.log(`[API Store] Deduplicação concluída: ${removedCount} pedidos duplicados removidos.`);
    return res.json({ success: true, removedCount, message: `${removedCount} pedido(s) duplicado(s) removido(s) com sucesso.` });
  } catch (err: any) {
    console.error('[API Store] Erro ao deduplicar pedidos:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao deduplicar pedidos' });
  }
}

/**
 * 7. Upload Resiliente de Foto de Produto (com suporte a base64 / Data URL)
 */
export async function handleUploadStoreImage(req: Request, res: Response) {
  try {
    const { base64, mimeType, fileName, productId } = req.body || {};
    if (!base64) {
      return res.status(400).json({ error: 'base64 da imagem é obrigatório' });
    }

    const type = mimeType || 'image/webp';
    const dataUrl = base64.startsWith('data:') ? base64 : `data:${type};base64,${base64}`;

    return res.json({
      success: true,
      url: dataUrl
    });
  } catch (err: any) {
    console.error('[API Store] Erro no processamento de upload da foto:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao processar imagem' });
  }
}

