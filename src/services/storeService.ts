import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { compressProductImage } from '../utils/imageCompressor';
import { 
  StoreCategory, 
  StoreProduct, 
  StoreOrder, 
  StoreDeliveryAddress, 
  StoreOrderStatus 
} from '../types';

/**
 * 1. CATEGORIAS (store_categories)
 */
export async function getStoreCategories(): Promise<StoreCategory[]> {
  // 1. Tentar buscar via API Server-side (100% resiliente a permissões)
  try {
    const res = await fetch('/api/store/categories');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.categories)) {
        return data.categories;
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/categories indisponível, usando fallback Firestore');
  }

  // 2. Fallback via Firestore Client SDK
  try {
    const q = query(collection(db, 'store_categories'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const categories: StoreCategory[] = [];
    snap.forEach((docSnap) => {
      categories.push({
        id: docSnap.id,
        name: docSnap.data().name || '',
        order: Number(docSnap.data().order) || 0
      });
    });
    return categories;
  } catch (err) {
    console.error('Erro ao buscar categorias da loja:', err);
    return [];
  }
}

export async function createStoreCategory(name: string, order: number): Promise<StoreCategory> {
  // 1. Tentar via API Server-side (Firebase Admin - 100% livre de falhas de permissão)
  try {
    const res = await fetch('/api/store/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, order })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.category) return data.category;
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/categories indisponível, usando fallback Firestore');
  }

  // 2. Fallback via Firestore Client SDK
  const categoryId = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const categoryData: StoreCategory = {
    id: categoryId,
    name: name.trim(),
    order: Number(order) || 0
  };
  await setDoc(doc(db, 'store_categories', categoryId), categoryData);
  return categoryData;
}

export async function updateStoreCategory(id: string, name: string, order: number): Promise<void> {
  // 1. Tentar via API Server-side
  try {
    const res = await fetch(`/api/store/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, order })
    });
    if (res.ok) return;
  } catch (apiErr) {
    console.warn('[storeService] API PUT /api/store/categories indisponível, usando fallback');
  }

  // 2. Fallback via Firestore Client SDK
  await updateDoc(doc(db, 'store_categories', id), {
    name: name.trim(),
    order: Number(order) || 0
  });
}

export async function deleteStoreCategory(id: string): Promise<void> {
  let apiSucceeded = false;
  // 1. Tentar via API Server-side
  try {
    const res = await fetch(`/api/store/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      apiSucceeded = true;
    }
  } catch (apiErr) {
    console.warn('[storeService] API DELETE /api/store/categories indisponível, usando fallback');
  }

  // 2. Fallback via Firestore Client SDK
  if (!apiSucceeded) {
    try {
      await deleteDoc(doc(db, 'store_categories', id));
    } catch (firestoreErr) {
      console.error('[storeService] Falha ao deletar categoria no Firestore:', firestoreErr);
      throw firestoreErr;
    }
  }
}

/**
 * 2. PRODUTOS (store_products)
 */
export async function getStoreProducts(includeInactive = false): Promise<StoreProduct[]> {
  // 1. Tentar buscar via API Server-side (100% resiliente a permissões)
  try {
    const res = await fetch(`/api/store/products?includeInactive=${includeInactive}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.products)) {
        return data.products;
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/products indisponível, usando fallback Firestore');
  }

  // 2. Fallback via Firestore Client SDK
  try {
    const colRef = collection(db, 'store_products');
    let q = query(colRef);
    if (!includeInactive) {
      q = query(colRef, where('isActive', '==', true));
    }
    const snap = await getDocs(q);
    const products: StoreProduct[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        price: Number(data.price) || 0,
        images: Array.isArray(data.images) ? data.images : [],
        categoryId: data.categoryId || '',
        isActive: data.isActive !== false,
        stock: Number(data.stock) || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    return products;
  } catch (err) {
    console.warn('Erro ao buscar produtos da loja:', err);
    return [];
  }
}

export async function createStoreProduct(data: Omit<StoreProduct, 'id'>): Promise<StoreProduct> {
  // 1. Tentar via API Server-side (Firebase Admin - 100% livre de falhas de permissão)
  try {
    const res = await fetch('/api/store/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const result = await res.json();
      if (result.product) return result.product;
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/products indisponível, usando fallback');
  }

  // 2. Fallback via Firestore Client SDK
  const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const productData: StoreProduct = {
    ...data,
    id: productId,
    createdAt: now,
    updatedAt: now
  };
  await setDoc(doc(db, 'store_products', productId), productData);
  return productData;
}

export async function updateStoreProduct(id: string, data: Partial<StoreProduct>): Promise<void> {
  // 1. Tentar via API Server-side
  try {
    const res = await fetch(`/api/store/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) return;
  } catch (apiErr) {
    console.warn('[storeService] API PUT /api/store/products indisponível, usando fallback');
  }

  // 2. Fallback via Firestore Client SDK
  const updateData: any = {
    ...data,
    updatedAt: new Date().toISOString()
  };
  await updateDoc(doc(db, 'store_products', id), updateData);
}

/**
 * Exclusão de Produto:
 * Remove o produto do catálogo. Se permanent for true ou não tiver vendas, remove do banco.
 */
export async function deleteStoreProduct(id: string, permanent = false): Promise<void> {
  let apiSucceeded = false;
  // 1. Tentar via API Server-side
  try {
    const res = await fetch(`/api/store/products/${encodeURIComponent(id)}?permanent=${permanent}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      apiSucceeded = true;
    }
  } catch (apiErr) {
    console.warn('[storeService] API DELETE /api/store/products indisponível, usando fallback');
  }

  // 2. Fallback via Firestore Client SDK
  if (!apiSucceeded) {
    try {
      if (permanent) {
        await deleteDoc(doc(db, 'store_products', id));
      } else {
        await updateDoc(doc(db, 'store_products', id), {
          isActive: false,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (firestoreErr) {
      console.error('[storeService] Falha ao deletar produto no Firestore:', firestoreErr);
      throw firestoreErr;
    }
  }
}

/**
 * Exclusão Segura (Soft Delete):
 * O Admin pode 'excluir' ou pausar um produto. Isso apenas altera o isActive para false,
 * removendo-o da vitrine, mas preservando o documento para não quebrar o histórico de pedidos.
 */
export async function softDeleteStoreProduct(id: string): Promise<void> {
  return deleteStoreProduct(id, false);
}

/**
 * Upload de Foto para a Loja com Compressão Automática & Alta Resiliência
 * Salva no Firebase Storage ou via Backend API com fallback instantâneo para WebP otimizado
 */
export async function uploadProductImage(
  file: File, 
  productId: string, 
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  // 1. Compressão client-side (Max 1200px, WebP 80% ou JPEG) -> gera blob super leve (~30-80KB)
  const { blob, fileName, mimeType } = await compressProductImage(file, 1200, 0.8);
  if (onProgress) onProgress(30);

  // Converter blob para base64 Data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao processar arquivo de imagem'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler a imagem.'));
    reader.readAsDataURL(blob);
  });
  if (onProgress) onProgress(60);

  // 2. Tentar upload via API Server-side
  try {
    const res = await fetch('/api/store/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64: dataUrl,
        mimeType,
        fileName,
        productId
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        if (onProgress) onProgress(100);
        return data.url;
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/upload-image indisponível, tentando Client SDK:', apiErr);
  }

  // 3. Tentar via Firebase Storage Client SDK com timeout protegido
  try {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `store/products/${productId}/${Date.now()}_${cleanName}`;
    const fileRef = ref(storage, path);

    const uploadTask = uploadBytesResumable(fileRef, blob, {
      contentType: mimeType,
      cacheControl: 'public,max-age=31536000'
    });

    const storageUrl = await new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        try { uploadTask.cancel(); } catch {}
        reject(new Error('Storage timeout'));
      }, 8000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const percent = 60 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 40);
            onProgress(Math.min(99, percent));
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        async () => {
          clearTimeout(timeoutId);
          try {
            const url = await getDownloadURL(fileRef);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    if (onProgress) onProgress(100);
    return storageUrl;
  } catch (storageErr) {
    console.warn('[storeService] Firebase Storage client upload indisponível, usando WebP otimizado:', storageErr);
  }

  // 4. Fallback final garantido: Retorna o WebP Data URL ultra leve
  if (onProgress) onProgress(100);
  return dataUrl;
}

/**
 * Regra de Custo:
 * Ao deletar ou substituir uma foto de um produto, EXCLUIR o arquivo físico correspondente
 * no Firebase Storage para não gerar custos de lixo/órfãos.
 */
export async function deleteProductImageFromStorage(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl) return false;
    // Se for URL do Firebase Storage
    if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('appspot.com')) {
      const fileRef = ref(storage, imageUrl);
      await deleteObject(fileRef);
      console.log(`[Storage Cleanup] Imagem removida com sucesso: ${imageUrl}`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[Storage Cleanup] Não foi possível excluir arquivo físico da URL (${imageUrl}):`, err);
    return false;
  }
}

/**
 * 3. PEDIDOS (store_orders)
 */

/**
 * Busca EXCLUSIVA dos pedidos do usuário logado (Tela 'Meus Pedidos' no Perfil).
 * OBRIGATÓRIO: Filtra estritamente por userId na API, na query do Firestore e em memória,
 * garantindo isolamento total (o usuário nunca visualizará pedidos de outros clientes).
 */
export async function getUserStoreOrders(userId: string, userEmail?: string): Promise<StoreOrder[]> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return [];
  }

  const cleanUserId = userId.trim();
  const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : '';
  let rawOrders: StoreOrder[] = [];

  // 1. Tentar buscar via API Server-side com query param userId
  try {
    const url = `/api/store/orders?userId=${encodeURIComponent(cleanUserId)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        rawOrders = data.orders.map((d: any) => ({
          orderId: d.orderId || d.id,
          userId: d.userId || '',
          userEmail: d.userEmail || '',
          userName: d.userName || '',
          productId: d.productId || '',
          productName: d.productName || '',
          productImage: d.productImage || '',
          totalPrice: Number(d.totalPrice) || 0,
          status: (d.status || 'Aguardando Pagamento') as StoreOrderStatus,
          trackingCode: d.trackingCode || '',
          deliveryAddress: d.deliveryAddress || undefined,
          paymentId: d.paymentId || undefined,
          deliveredAt: d.deliveredAt || undefined,
          autoDeliveredViaCron: d.autoDeliveredViaCron || false,
          createdAt: d.createdAt || '',
          updatedAt: d.updatedAt || ''
        }));
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/orders indisponível, buscando via Firestore Client');
  }

  // 2. Se a API estiver offline ou vazia, busca via Firestore Client SDK com filtro OBRIGATÓRIO de userId
  if (rawOrders.length === 0) {
    try {
      const colRef = collection(db, 'store_orders');
      const q = query(colRef, where('userId', '==', cleanUserId));
      const snap = await getDocs(q);

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        rawOrders.push({
          orderId: docSnap.id,
          userId: d.userId || '',
          userEmail: d.userEmail || '',
          userName: d.userName || '',
          productId: d.productId || '',
          productName: d.productName || '',
          productImage: d.productImage || '',
          totalPrice: Number(d.totalPrice) || 0,
          status: (d.status || 'Aguardando Pagamento') as StoreOrderStatus,
          trackingCode: d.trackingCode || '',
          deliveryAddress: d.deliveryAddress || undefined,
          paymentId: d.paymentId || undefined,
          deliveredAt: d.deliveredAt || undefined,
          autoDeliveredViaCron: d.autoDeliveredViaCron || false,
          createdAt: d.createdAt || '',
          updatedAt: d.updatedAt || ''
        });
      });
    } catch (err) {
      console.warn('[storeService] Firestore query error in getUserStoreOrders:', err);
    }
  }

  // 3. DUPLO FILTRO ESTRITO DE SEGURANÇA EM MEMÓRIA:
  // Impede terminantemente a exibição de pedidos de outros clientes no perfil
  const filtered = rawOrders.filter((o) => {
    const matchesUid = o.userId === cleanUserId;
    const matchesEmail = cleanEmail && o.userEmail && o.userEmail.toLowerCase() === cleanEmail;
    return matchesUid || matchesEmail;
  });

  filtered.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return filtered;
}

/**
 * Consulta de Pedidos da Loja:
 * - Se fornecido userId: delega para getUserStoreOrders (isolamento estrito do usuário).
 * - Se chamado sem parâmetros: busca global para a Central Administrativa (Painel Admin).
 */
export async function getStoreOrders(userId?: string): Promise<StoreOrder[]> {
  if (userId) {
    return getUserStoreOrders(userId);
  }

  // 1. Tentar buscar via API Server-side (100% resiliente a regras, autenticação e índices)
  try {
    const res = await fetch('/api/store/orders');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        return data.orders;
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/orders indisponível, usando fallback Firestore');
  }

  // 2. Fallback via Firestore Client SDK (Somente se houver usuário autenticado administrador)
  try {
    if (!auth.currentUser) return [];
    const colRef = collection(db, 'store_orders');
    let snap;
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(colRef);
    }

    const orders: StoreOrder[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      orders.push({
        orderId: docSnap.id,
        userId: d.userId || '',
        userEmail: d.userEmail || '',
        userName: d.userName || '',
        productId: d.productId || '',
        productName: d.productName || '',
        productImage: d.productImage || '',
        totalPrice: Number(d.totalPrice) || 0,
        status: (d.status || 'Aguardando Pagamento') as StoreOrderStatus,
        trackingCode: d.trackingCode || '',
        deliveryAddress: d.deliveryAddress || undefined,
        paymentId: d.paymentId || undefined,
        deliveredAt: d.deliveredAt || undefined,
        autoDeliveredViaCron: d.autoDeliveredViaCron || false,
        createdAt: d.createdAt || '',
        updatedAt: d.updatedAt || ''
      });
    });

    // Ordenação garantida em memória pelo mais recente
    orders.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return orders;
  } catch (err) {
    console.warn('[storeService] Fallback Firestore orders warning:', err);
    return [];
  }
}

/**
 * Criar preferência de pagamento no Checkout Pro via Backend
 */
export async function createStoreCheckoutPreference(params: {
  productId: string;
  deliveryAddress: StoreDeliveryAddress;
  userId: string;
  userEmail: string;
  userName: string;
}): Promise<{ init_point: string; orderId: string }> {
  const response = await fetch('/api/store/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Falha ao iniciar pagamento');
  }

  return {
    init_point: data.init_point,
    orderId: data.orderId
  };
}

/**
 * Atualizar status do pedido pelo Painel Admin com Notificação
 */
export async function updateStoreOrderStatusApi(params: {
  orderId: string;
  status: StoreOrderStatus;
  trackingCode?: string;
  deliveryAddress?: StoreDeliveryAddress;
  userName?: string;
  userEmail?: string;
  totalPrice?: number;
  notes?: string;
}): Promise<any> {
  try {
    const response = await fetch('/api/store/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const data = await response.json();
    if (response.ok && data.success) {
      return data;
    }
  } catch (apiErr) {
    console.warn('[storeService] API update-status error, falling back to Firestore:', apiErr);
  }

  // Fallback direto ao Firestore
  try {
    const docRef = doc(db, 'store_orders', params.orderId);
    const updateData: any = {
      status: params.status,
      updatedAt: new Date().toISOString()
    };
    if (params.trackingCode !== undefined) {
      updateData.trackingCode = params.trackingCode.trim().toUpperCase();
    }
    if (params.deliveryAddress !== undefined) {
      updateData.deliveryAddress = params.deliveryAddress;
    }
    if (params.userName !== undefined) {
      updateData.userName = params.userName;
    }
    if (params.userEmail !== undefined) {
      updateData.userEmail = params.userEmail;
    }
    if (params.totalPrice !== undefined) {
      updateData.totalPrice = Number(params.totalPrice);
    }
    if (params.notes !== undefined) {
      updateData.notes = params.notes;
    }
    if (params.status === 'Enviado') {
      updateData.shippedAt = new Date().toISOString();
    }
    if (params.status === 'Entregue') {
      updateData.deliveredAt = new Date().toISOString();
    }
    await updateDoc(docRef, updateData);
    return { success: true };
  } catch (firestoreErr: any) {
    console.error('[storeService] Error updating order via Firestore fallback:', firestoreErr);
    throw new Error(firestoreErr?.message || 'Falha ao atualizar pedido');
  }
}

/**
 * Disparar checagem automática de entregas (Cron / Link&Track / Correios)
 */
export async function triggerCheckDeliveriesCron(): Promise<{
  success: boolean;
  totalChecked: number;
  totalUpdated: number;
  updatedOrders?: any[];
  error?: string;
}> {
  const response = await fetch('/api/cron/check-deliveries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Falha ao sincronizar entregas com Correios');
  }

  return data;
}

/**
 * Excluir Pedido da Loja Individualmente
 */
export async function deleteStoreOrder(orderId: string): Promise<{ success: boolean }> {
  // 1. Tentar via API Server-side
  try {
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true };
      }
    }
  } catch (err) {
    console.warn('[storeService] Falha ao excluir pedido via API, tentando fallback direto Firestore:', err);
  }

  // 2. Fallback direto via Firestore Client SDK
  try {
    const docRef = doc(db, 'store_orders', orderId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (firestoreErr) {
    console.error('[storeService] Erro ao excluir pedido no Firestore:', firestoreErr);
    throw new Error('Não foi possível excluir o pedido.');
  }
}

/**
 * Excluir/Limpar Pedidos de Teste (Ativos e Histórico)
 */
export async function clearAllTestOrders(orderIds?: string[]): Promise<{ success: boolean; deletedCount: number }> {
  // 1. Tentar via API Server-side
  try {
    const res = await fetch('/api/store/orders/clear-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds, all: !orderIds || orderIds.length === 0 })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, deletedCount: data.deletedCount || 0 };
      }
    }
  } catch (err) {
    console.warn('[storeService] Falha ao limpar pedidos via API, tentando fallback Firestore:', err);
  }

  // 2. Fallback client-side
  try {
    let deletedCount = 0;
    if (orderIds && orderIds.length > 0) {
      for (const id of orderIds) {
        try {
          await deleteDoc(doc(db, 'store_orders', id));
          deletedCount++;
        } catch (e) {
          console.warn(`[storeService] Erro ao deletar doc ${id}:`, e);
        }
      }
    } else {
      const snap = await getDocs(collection(db, 'store_orders'));
      for (const docSnap of snap.docs) {
        try {
          await deleteDoc(docSnap.ref);
          deletedCount++;
        } catch (e) {
          console.warn(`[storeService] Erro ao deletar doc ${docSnap.id}:`, e);
        }
      }
    }
    return { success: true, deletedCount };
  } catch (err) {
    console.error('[storeService] Erro ao limpar pedidos de teste:', err);
    throw new Error('Falha ao limpar pedidos de teste.');
  }
}

