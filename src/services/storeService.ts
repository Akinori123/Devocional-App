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
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
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
 * Upload de Foto para o Firebase Storage
 * Salva em store_products/${productId}/${timestamp}_${fileName}
 */
export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `store_products/${productId}/${Date.now()}_${cleanName}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(fileRef);
  return downloadUrl;
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
export async function getStoreOrders(userId?: string): Promise<StoreOrder[]> {
  // 1. Tentar buscar via API Server-side (100% resiliente a regras, autenticação e índices)
  try {
    const url = userId ? `/api/store/orders?userId=${encodeURIComponent(userId)}` : '/api/store/orders';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        return data.orders;
      }
    }
  } catch (apiErr) {
    console.warn('[storeService] API /api/store/orders indisponível, usando fallback Firestore');
  }

  // 2. Fallback via Firestore Client SDK
  try {
    const colRef = collection(db, 'store_orders');
    let snap;
    if (userId) {
      // Query apenas por userId para não exigir índice composto
      const q = query(colRef, where('userId', '==', userId));
      snap = await getDocs(q);
    } else {
      // Somente busca todos os pedidos se houver usuário autenticado (admin)
      if (!auth.currentUser) return [];
      try {
        const q = query(colRef, orderBy('createdAt', 'desc'));
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(colRef);
      }
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
}): Promise<any> {
  const response = await fetch('/api/store/orders/update-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Falha ao atualizar pedido');
  }

  return data;
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

