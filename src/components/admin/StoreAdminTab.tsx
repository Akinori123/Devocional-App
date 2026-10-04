import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Package, 
  Layers, 
  ShoppingBag, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Image as ImageIcon, 
  Upload, 
  X, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Search,
  Filter,
  ShieldCheck,
  Archive,
  Inbox,
  History
} from 'lucide-react';
import { 
  StoreCategory, 
  StoreProduct, 
  StoreOrder, 
  StoreOrderStatus 
} from '../../types';
import { 
  getStoreCategories, 
  createStoreCategory, 
  updateStoreCategory, 
  deleteStoreCategory, 
  getStoreProducts, 
  createStoreProduct, 
  updateStoreProduct, 
  deleteStoreProduct,
  softDeleteStoreProduct, 
  uploadProductImage, 
  deleteProductImageFromStorage, 
  getStoreOrders, 
  updateStoreOrderStatusApi,
  triggerCheckDeliveriesCron
} from '../../services/storeService';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useDragScroll } from '../../hooks/useDragScroll';

export function StoreAdminTab() {
  const toast = useToast();
  const [subTab, setSubTab] = useState<'categories' | 'products' | 'orders'>('products');
  const { dragProps: orderFilterDragProps, hasDragged: orderFilterHasDragged } = useDragScroll<HTMLDivElement>();

  // Categorias
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState<number>(0);
  const [savingCategory, setSavingCategory] = useState(false);

  // Produtos
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Form Produto
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('10');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Pedidos
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderMainTab, setOrderMainTab] = useState<'active' | 'history'>('active');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [editingTrackingOrderId, setEditingTrackingOrderId] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState<string>('');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [isSyncingDeliveries, setIsSyncingDeliveries] = useState<boolean>(false);

  // Modais de Exclusão Segura (100% compatível com iframe preview e mobile)
  const [categoryToDelete, setCategoryToDelete] = useState<StoreCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [productToDelete, setProductToDelete] = useState<StoreProduct | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  useEffect(() => {
    loadCategories();
    loadProducts();
    loadOrders();
  }, []);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await getStoreCategories();
      setCategories(data);
    } catch (err) {
      toast.error('Erro ao carregar categorias.');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const data = await getStoreProducts(true); // Inclui inativos para gestão do admin
      setProducts(data);
    } catch (err) {
      toast.error('Erro ao carregar produtos.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await getStoreOrders();
      setOrders(data);
    } catch (err) {
      toast.error('Erro ao carregar pedidos.');
    } finally {
      setLoadingOrders(false);
    }
  };

  // --- Handlers de Categoria ---
  const handleOpenCategoryModal = (cat?: StoreCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryName(cat.name);
      setCategoryOrder(cat.order);
    } else {
      setEditingCategory(null);
      setCategoryName('');
      setCategoryOrder(categories.length);
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error('O nome da categoria é obrigatório.');
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        await updateStoreCategory(editingCategory.id, categoryName, categoryOrder);
        toast.success('Categoria atualizada com sucesso!');
      } else {
        await createStoreCategory(categoryName, categoryOrder);
        toast.success('Categoria criada com sucesso!');
      }
      setCategoryModalOpen(false);
      loadCategories();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar categoria.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat: StoreCategory) => {
    setCategoryToDelete(cat);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      await deleteStoreCategory(categoryToDelete.id);
      toast.success(`Categoria "${categoryToDelete.name}" excluída com sucesso.`);
      setCategoryToDelete(null);
      loadCategories();
    } catch (err: any) {
      console.error('Erro ao excluir categoria:', err);
      toast.error(err?.message || 'Erro ao excluir categoria.');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  // --- Handlers de Produto ---
  const handleOpenProductModal = (prod?: StoreProduct) => {
    if (prod) {
      setEditingProduct(prod);
      setTitle(prod.title);
      setDescription(prod.description);
      setPrice(prod.price.toString());
      setStock(prod.stock.toString());
      setCategoryId(prod.categoryId);
      setIsActive(prod.isActive);
      setImages([...prod.images]);
    } else {
      setEditingProduct(null);
      setTitle('');
      setDescription('');
      setPrice('');
      setStock('10');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setIsActive(true);
      setImages([]);
    }
    setProductModalOpen(true);
  };

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const tempId = editingProduct ? editingProduct.id : `temp_${Date.now()}`;
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`Arquivo ${file.name} não é uma imagem válida.`);
          continue;
        }
        const url = await uploadProductImage(file, tempId);
        newUrls.push(url);
      }

      setImages((prev) => [...prev, ...newUrls]);
      toast.success(`${newUrls.length} imagem(ns) carregada(s) com sucesso!`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao fazer upload da imagem.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  // Regra de Custo: Ao deletar ou substituir uma foto, EXCLUIR o arquivo físico no Firebase Storage
  const handleDeleteProductImage = async (indexToRemove: number) => {
    const urlToRemove = images[indexToRemove];
    if (!urlToRemove) return;

    // Remove do estado visual
    const updatedImages = images.filter((_, idx) => idx !== indexToRemove);
    setImages(updatedImages);

    // Se estiver editando produto já salvo, persiste no Firestore também
    if (editingProduct) {
      updateStoreProduct(editingProduct.id, { images: updatedImages }).catch((err) =>
        console.error('Erro ao atualizar array de imagens no produto:', err)
      );
    }

    // Exclui fisicamente do Firebase Storage para eliminar custos de armazenamento
    try {
      await deleteProductImageFromStorage(urlToRemove);
      toast.success('Imagem removida do armazenamento físico.');
    } catch (err) {
      console.warn('Erro ao deletar imagem física do storage:', err);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Informe o título do produto.');
      return;
    }
    const parsedPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast.error('Informe um preço válido.');
      return;
    }
    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      toast.error('Informe uma quantidade de estoque válida.');
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        stock: parsedStock,
        categoryId: categoryId || (categories[0]?.id || ''),
        isActive,
        images
      };

      if (editingProduct) {
        await updateStoreProduct(editingProduct.id, payload);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await createStoreProduct(payload);
        toast.success('Produto criado com sucesso!');
      }

      setProductModalOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar produto.');
    } finally {
      setSavingProduct(false);
    }
  };

  // Exclusão Segura / Permanente de Produto
  const handleToggleProductStatus = async (product: StoreProduct) => {
    try {
      const nextStatus = !product.isActive;
      await updateStoreProduct(product.id, { isActive: nextStatus });
      toast.success(nextStatus ? 'Produto reativado na vitrine!' : 'Produto pausado (removido da vitrine com segurança).');
      loadProducts();
    } catch (err) {
      toast.error('Erro ao alterar status do produto.');
    }
  };

  const handleDeleteProduct = (product: StoreProduct) => {
    setProductToDelete(product);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    try {
      await deleteStoreProduct(productToDelete.id, true);
      toast.success(`Produto "${productToDelete.title}" excluído com sucesso!`);
      setProductToDelete(null);
      loadProducts();
    } catch (err: any) {
      console.error('Erro ao excluir produto:', err);
      toast.error(err?.message || 'Erro ao excluir produto.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // --- Handlers de Pedidos ---
  const handleUpdateOrderStatus = async (orderId: string, newStatus: StoreOrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const targetOrder = orders.find(o => o.orderId === orderId);
      const res = await updateStoreOrderStatusApi({
        orderId,
        status: newStatus,
        trackingCode: targetOrder?.trackingCode
      });

      if (res.notified) {
        toast.success('Status atualizado para Enviado! Push e E-mail de rastreio enviados ao cliente. 📦');
      } else {
        toast.success(`Status atualizado para: ${newStatus}`);
      }
      loadOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar status do pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSaveTrackingCode = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      const targetOrder = orders.find(o => o.orderId === orderId);
      const newStatus = targetOrder?.status === 'Preparando Envio' ? 'Enviado' : (targetOrder?.status || 'Enviado');
      
      const res = await updateStoreOrderStatusApi({
        orderId,
        status: newStatus as StoreOrderStatus,
        trackingCode: trackingInput.trim()
      });

      if (res.notified) {
        toast.success('Código salvo e pedido marcado como Enviado! Notificações disparadas. 📦');
      } else {
        toast.success('Código de rastreio atualizado com sucesso!');
      }
      setEditingTrackingOrderId(null);
      setTrackingInput('');
      loadOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar rastreio.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTracking(id);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const handleSyncDeliveries = async () => {
    setIsSyncingDeliveries(true);
    try {
      const res = await triggerCheckDeliveriesCron();
      if (res.totalUpdated > 0) {
        toast.success(`Sincronização concluída! ${res.totalChecked} pacotes verificados, ${res.totalUpdated} atualizados para Entregue.`);
      } else {
        toast.success(`Sincronização concluída! ${res.totalChecked} pacote(s) em trânsito verificados nos Correios.`);
      }
      loadOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao sincronizar entregas com os Correios.');
    } finally {
      setIsSyncingDeliveries(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(productSearch.toLowerCase());
    
    if (productStatusFilter === 'active') return matchesSearch && p.isActive !== false;
    if (productStatusFilter === 'inactive') return matchesSearch && p.isActive === false;
    return matchesSearch;
  });

  const activeOrdersCount = orders.filter(o => o.status !== 'Entregue').length;
  const historyOrdersCount = orders.filter(o => o.status === 'Entregue').length;

  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.orderId.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.productName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.userEmail.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.userName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.trackingCode && o.trackingCode.toLowerCase().includes(orderSearch.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (orderMainTab === 'active') {
      if (o.status === 'Entregue') return false;
      if (orderStatusFilter === 'all') return true;
      return o.status === orderStatusFilter;
    } else {
      // Histórico / Concluídos (Entregue)
      return o.status === 'Entregue';
    }
  });

  return (
    <div className="space-y-6">
      {/* Sub-Tabs de Navegação da Loja */}
      <div className="flex bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-1 sm:p-1.5 shadow-2xs gap-1 w-full">
        <button
          onClick={() => setSubTab('products')}
          className={cn(
            "flex-1 min-w-0 py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer",
            subTab === 'products'
              ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Produtos</span>
          <span className="text-[10px] sm:text-xs font-semibold opacity-80 shrink-0">({products.length})</span>
        </button>

        <button
          onClick={() => setSubTab('categories')}
          className={cn(
            "flex-1 min-w-0 py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer",
            subTab === 'categories'
              ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Categorias</span>
          <span className="text-[10px] sm:text-xs font-semibold opacity-80 shrink-0">({categories.length})</span>
        </button>

        <button
          onClick={() => setSubTab('orders')}
          className={cn(
            "flex-1 min-w-0 py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer relative",
            subTab === 'orders'
              ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/20"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="truncate">Pedidos</span>
          <span className="text-[10px] sm:text-xs font-semibold opacity-80 shrink-0">({orders.length})</span>
          {orders.filter(o => o.status === 'Preparando Envio').length > 0 && (
            <span className="bg-red-500 text-white text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse shrink-0">
              {orders.filter(o => o.status === 'Preparando Envio').length}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================
          1. ABA CATEGORIAS
          ======================================================== */}
      {subTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">Categorias da Loja</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Organize a vitrine visual no aplicativo em chips horizontais ordenados.
              </p>
            </div>
            <button
              onClick={() => handleOpenCategoryModal()}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </button>
          </div>

          {loadingCategories ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-7 h-7 text-yellow-500 animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <Layers className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhuma categoria cadastrada</p>
              <p className="text-xs text-gray-400 mt-1">Crie categorias como "Papelaria", "Camisetas", "Bíblias", etc.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {categories.map((cat) => (
                  <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 flex items-center justify-center font-black text-xs">
                        #{cat.order}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white text-sm">{cat.name}</div>
                        <div className="text-[11px] text-gray-400">ID: {cat.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCategoryModal(cat)}
                        className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Editar Categoria"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Categoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          2. ABA PRODUTOS (GESTÃO COMPLETA)
          ======================================================== */}
      {subTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
                />
              </div>

              {/* Filtros Rápidos de Status */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  onClick={() => setProductStatusFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    productStatusFilter === 'all'
                      ? "bg-yellow-500 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  )}
                >
                  Todos ({products.length})
                </button>
                <button
                  onClick={() => setProductStatusFilter('active')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    productStatusFilter === 'active'
                      ? "bg-green-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  )}
                >
                  Ativos ({products.filter(p => p.isActive !== false).length})
                </button>
                <button
                  onClick={() => setProductStatusFilter('inactive')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                    productStatusFilter === 'inactive'
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                  )}
                >
                  Pausados ({products.filter(p => p.isActive === false).length})
                </button>
              </div>
            </div>

            <button
              onClick={() => handleOpenProductModal()}
              className="w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          </div>

          {loadingProducts ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-7 h-7 text-yellow-500 animate-spin" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nenhum produto encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Clique em "Novo Produto" para adicionar itens à vitrine.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                const isOutOfStock = product.stock <= 0;
                const isScarcity = product.stock > 0 && product.stock <= 5;

                return (
                  <div 
                    key={product.id}
                    className={cn(
                      "bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between transition-all",
                      !product.isActive && "opacity-60 bg-gray-50 dark:bg-slate-950/40"
                    )}
                  >
                    <div>
                      {/* Imagem do Produto */}
                      <div className="relative aspect-square w-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        {product.images && product.images.length > 0 ? (
                          <img
                            src={product.images[0]}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <ImageIcon className="w-10 h-10 mb-1 opacity-50" />
                            <span className="text-xs">Sem foto</span>
                          </div>
                        )}

                        {/* Badges de Status e Estoque */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {!product.isActive ? (
                            <span className="bg-gray-900/90 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border border-amber-500/30 flex items-center gap-1">
                              <EyeOff className="w-2.5 h-2.5" />
                              Pausado (Oculto)
                            </span>
                          ) : (
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" />
                              Ativo na Vitrine
                            </span>
                          )}

                          {isOutOfStock ? (
                            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              Esgotado
                            </span>
                          ) : isScarcity ? (
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              🔥 Restam {product.stock}
                            </span>
                          ) : (
                            <span className="bg-slate-900/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-xs">
                              {product.stock} em estoque
                            </span>
                          )}
                        </div>

                        {product.images && product.images.length > 1 && (
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium backdrop-blur-xs">
                            +{product.images.length - 1} foto(s)
                          </div>
                        )}
                      </div>

                      {/* Dados */}
                      <div className="p-4">
                        <div className="text-[11px] font-bold uppercase text-yellow-600 dark:text-yellow-400 mb-1">
                          {category?.name || 'Geral'}
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                          {product.title}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1 min-h-[32px]">
                          {product.description || 'Sem descrição cadastrada.'}
                        </p>

                        <div className="mt-3 flex items-baseline justify-between">
                          <div>
                            <span className="text-base font-black text-gray-900 dark:text-white">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                            </span>
                            <span className="text-[10px] text-gray-400 ml-1">ou 12x no cartão</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ações Administrativas */}
                    <div className="p-3 bg-gray-50 dark:bg-slate-800/40 border-t border-gray-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleProductStatus(product)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer",
                            product.isActive
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                          )}
                          title={product.isActive ? "Pausar Produto (Ocultar da Vitrine)" : "Reativar Produto na Vitrine"}
                        >
                          {product.isActive ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Reativar</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenProductModal(product)}
                          className="bg-white dark:bg-slate-700 hover:bg-gray-100 text-gray-800 dark:text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-600 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-yellow-500" />
                          <span>Editar</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteProduct(product)}
                        disabled={deletingProductId === product.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        title="Excluir Produto Permanentemente"
                      >
                        {deletingProductId === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          3. ABA PEDIDOS (GERENCIAMENTO DE VENDAS & RASTREIO)
          ======================================================== */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          {/* Abas Principais de Pedidos: Pedidos Ativos vs Histórico / Concluídos */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl">
              <button
                onClick={() => {
                  setOrderMainTab('active');
                  setOrderStatusFilter('all');
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  orderMainTab === 'active'
                    ? "bg-white dark:bg-slate-900 text-yellow-600 dark:text-yellow-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Inbox className="w-4 h-4" />
                <span>Pedidos Ativos</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-black",
                  activeOrdersCount > 0 
                    ? "bg-yellow-500 text-white" 
                    : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                )}>
                  {activeOrdersCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setOrderMainTab('history');
                  setOrderStatusFilter('all');
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  orderMainTab === 'history'
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <History className="w-4 h-4" />
                <span>Histórico / Concluídos</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                  {historyOrdersCount}
                </span>
              </button>
            </div>

            {/* Botão de Disparo Manual da Sincronização Automática dos Correios */}
            <button
              onClick={handleSyncDeliveries}
              disabled={isSyncingDeliveries}
              className="flex items-center justify-center gap-2 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="Executa a verificação dos códigos de rastreio de pedidos enviados nos Correios"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncingDeliveries && "animate-spin text-purple-600")} />
              <span>{isSyncingDeliveries ? "Sincronizando..." : "Sincronizar Rastreios (Correios)"}</span>
            </button>
          </div>

          {/* Banner Explicativo de Conformidade e Garantia no Histórico */}
          {orderMainTab === 'history' && (
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-3.5 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  Arquivo Permanente & Retenção Legal (CDC)
                </p>
                <p className="text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                  Por questões fiscais e garantia de 7 dias do Código de Defesa do Consumidor, estes pedidos permanecem arquivados com histórico completo de entrega e rastreamento.
                </p>
              </div>
            </div>
          )}

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por ID, cliente, rastreio..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/30"
              />
            </div>

            {orderMainTab === 'active' && (
              <div 
                {...orderFilterDragProps}
                className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-none scrollbar-hide no-scrollbar pb-1 sm:pb-0 touch-pan-x cursor-grab active:cursor-grabbing select-none"
              >
                {[
                  { id: 'all', label: 'Todos os Ativos' },
                  { id: 'Preparando Envio', label: 'Preparando Envio' },
                  { id: 'Enviado', label: 'Enviado' },
                  { id: 'Aguardando Pagamento', label: 'Aguardando Pagamento' }
                ].map((statusOption) => (
                  <button
                    key={statusOption.id}
                    onClick={() => {
                      if (orderFilterHasDragged?.current) return;
                      setOrderStatusFilter(statusOption.id);
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer shrink-0",
                      orderStatusFilter === statusOption.id
                        ? "bg-yellow-500 text-white shadow-xs"
                        : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                    )}
                  >
                    {statusOption.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingOrders ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-7 h-7 text-yellow-500 animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-gray-100 dark:border-slate-800 text-center">
              <Package className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {orderMainTab === 'active' ? 'Nenhum pedido ativo pendente de ação' : 'Nenhum pedido no histórico'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {orderMainTab === 'active' 
                  ? 'Todos os pedidos em andamento foram processados ou entregues.' 
                  : 'Os pedidos marcados como Entregue serão mantidos arquivados aqui.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isShipped = order.status === 'Enviado';
                const isDelivered = order.status === 'Entregue';
                const isPreparing = order.status === 'Preparando Envio';
                const isPending = order.status === 'Aguardando Pagamento';

                return (
                  <div
                    key={order.orderId}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Foto do produto comprado */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-gray-200 dark:border-slate-700">
                        {order.productImage ? (
                          <img
                            src={order.productImage}
                            alt={order.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      {/* Informações da Venda */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span 
                            className="font-mono text-xs font-black text-gray-700 dark:text-gray-300 truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none inline-block align-middle"
                            title={`#${order.orderId}`}
                          >
                            #{order.orderId}
                          </span>
                          <span className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 whitespace-nowrap",
                            isPending && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                            isPreparing && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse",
                            isShipped && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                            isDelivered && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          )}>
                            {order.status}
                          </span>

                          {isDelivered && order.autoDeliveredViaCron && (
                            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              ✨ Correios Auto
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-gray-900 dark:text-white text-sm mt-0.5">
                          {order.productName}
                        </h4>

                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Cliente: <strong className="text-gray-900 dark:text-white">{order.userName}</strong> ({order.userEmail})
                        </div>

                        {order.deliveryAddress && (
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            📍 {order.deliveryAddress.street}, {order.deliveryAddress.number} {order.deliveryAddress.complement || ''} - {order.deliveryAddress.neighborhood}, {order.deliveryAddress.city}/{order.deliveryAddress.state} (CEP: {order.deliveryAddress.cep})
                            {order.deliveryAddress.phone && ` • Tel: ${order.deliveryAddress.phone}`}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                          <span className="font-black text-gray-900 dark:text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalPrice)}
                          </span>
                          <span className="text-gray-400">
                            Criado: {order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm') : ''}
                          </span>
                          {isDelivered && order.deliveredAt && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              • Entregue: {format(new Date(order.deliveredAt), 'dd/MM/yyyy HH:mm')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações de Envio e Rastreio */}
                    <div className="flex flex-col justify-between items-start md:items-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 dark:border-slate-800 gap-2 shrink-0">
                      {/* Rastreio */}
                      <div className="w-full md:w-auto">
                        {editingTrackingOrderId === order.orderId ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={trackingInput}
                              onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                              placeholder="Ex: AA123456789BR"
                              className="w-36 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-mono text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-yellow-500/30"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveTrackingCode(order.orderId)}
                              disabled={updatingOrderId === order.orderId}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEditingTrackingOrderId(null)}
                              className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : order.trackingCode ? (
                          <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 min-w-0 max-w-full">
                            <span className="text-[11px] font-mono font-bold text-gray-800 dark:text-gray-200 truncate max-w-[130px] sm:max-w-none">
                              {order.trackingCode}
                            </span>
                            <button
                              onClick={() => copyToClipboard(order.trackingCode!, order.orderId)}
                              className="text-gray-400 hover:text-yellow-600 p-0.5 cursor-pointer"
                              title="Copiar Código"
                            >
                              {copiedTracking === order.orderId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a
                              href={`https://rastreamento.correios.com.br/app/index.php?codigo=${order.trackingCode}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 p-0.5"
                              title="Rastrear nos Correios"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => {
                                setEditingTrackingOrderId(order.orderId);
                                setTrackingInput(order.trackingCode || '');
                              }}
                              className="text-gray-400 hover:text-yellow-600 text-[10px] font-bold underline ml-1 cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingTrackingOrderId(order.orderId);
                              setTrackingInput('');
                            }}
                            className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-purple-200 dark:border-purple-800 transition-colors cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Informar Rastreio</span>
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Troca de Status */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Alterar Status:</span>
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order.orderId}
                          onChange={(e) => handleUpdateOrderStatus(order.orderId, e.target.value as StoreOrderStatus)}
                          className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold px-2 py-1.5 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-yellow-500/30 cursor-pointer"
                        >
                          <option value="Aguardando Pagamento">Aguardando Pagamento</option>
                          <option value="Preparando Envio">Preparando Envio</option>
                          <option value="Enviado">Enviado</option>
                          <option value="Entregue">Entregue</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL: CRIAR / EDITAR CATEGORIA
          ======================================================== */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-gray-200 dark:border-slate-800">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex: Papelaria, Bíblias, Vestuário"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Ordem de Exibição (Numérica)
                </label>
                <input
                  type="number"
                  value={categoryOrder}
                  onChange={(e) => setCategoryOrder(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                />
                <p className="text-[11px] text-gray-400 mt-1">Quanto menor o número, mais à esquerda aparece no app.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 font-bold text-xs text-white shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CRIAR / EDITAR PRODUTO (EDIÇÃO PROFUNDA)
          ======================================================== */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-200 dark:border-slate-800 my-8">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                {editingProduct ? 'Edição Profunda do Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Título do Produto *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Caderno Devocional Capa Dura Florescer"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Descrição Completa
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Descreva detalhes, medidas, tipo de papel, acabamento..."
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Preço à Vista (R$) *
                  </label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 49.90"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Exibido com "ou em até 12x no cartão"</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Quantidade em Estoque *
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    min="0"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Se entre 1 e 5, ativa tag de escassez 🔥</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500/30"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Visibilidade na Vitrine
                  </label>
                  <div className="flex items-center h-10">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                      <span className="ml-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {isActive ? 'Ativo na Loja' : 'Pausado / Oculto'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Upload de Múltiplas Fotos & Regra de Custo */}
              <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                    Fotos do Produto ({images.length})
                  </label>
                  <span className="text-[10px] text-gray-400">Primeira foto será a capa principal</span>
                </div>

                {/* Grade de fotos já enviadas */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl bg-gray-100 dark:bg-slate-800 overflow-hidden border border-gray-200 dark:border-slate-700 group">
                      <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-1 left-1 bg-yellow-500 text-white text-[9px] px-1 py-0.2 rounded font-black">
                          Capa
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteProductImage(idx)}
                        className="absolute top-1 right-1 bg-red-600/90 hover:bg-red-700 text-white p-1 rounded-full shadow-sm transition-opacity opacity-80 group-hover:opacity-100 cursor-pointer"
                        title="Excluir foto fisicamente do Firebase Storage"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Botão de Adicionar Mais Fotos */}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-yellow-500 dark:hover:border-yellow-500 flex flex-col items-center justify-center text-gray-400 hover:text-yellow-600 cursor-pointer transition-colors">
                    {uploadingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold">+ Foto</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadImageFile}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Regra de Custo Automática:</strong> Ao deletar ou substituir uma foto, o arquivo físico no Firebase Storage é excluído imediatamente para evitar custos de arquivos órfãos.
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || uploadingImage}
                  className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 font-bold text-xs text-white shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CATEGORIA
          ======================================================== */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    Excluir Categoria
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Ação irreversível
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeletingCategory && setCategoryToDelete(null)}
                disabled={isDeletingCategory}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/40 rounded-2xl p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-red-900 dark:text-red-300">
                Tem certeza que deseja excluir a categoria <strong className="underline">"{categoryToDelete.name}"</strong>?
              </p>
              <p className="text-[11px] text-red-700/80 dark:text-red-400/80">
                Os produtos cadastrados nesta categoria não serão excluídos, mas precisarão ser reatribuídos a uma nova categoria.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                disabled={isDeletingCategory}
                className="py-2.5 px-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={isDeletingCategory}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isDeletingCategory ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE PRODUTO
          ======================================================== */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                    Excluir Produto
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Remover do catálogo
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeletingProduct && setProductToDelete(null)}
                disabled={isDeletingProduct}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview do Produto a ser excluído */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-3 rounded-2xl flex items-center gap-3 border border-gray-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700 overflow-hidden shrink-0">
                {productToDelete.images && productToDelete.images[0] ? (
                  <img
                    src={productToDelete.images[0]}
                    alt={productToDelete.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {productToDelete.title}
                </h4>
                <p className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(productToDelete.price)}
                </p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/70 dark:border-red-900/40 rounded-2xl p-3.5 space-y-1">
              <p className="text-xs font-semibold text-red-900 dark:text-red-300">
                Deseja realmente excluir este produto?
              </p>
              <p className="text-[11px] text-red-700/80 dark:text-red-400/80 leading-relaxed">
                Esta ação removerá o produto permanentemente da vitrine da loja.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={isDeletingProduct}
                className="py-2.5 px-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                disabled={isDeletingProduct}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isDeletingProduct ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
