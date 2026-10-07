import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Truck, 
  ExternalLink, 
  Copy, 
  Check, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  ShoppingBag, 
  Loader2, 
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  X
} from 'lucide-react';
import { StoreOrder } from '../../types';
import { getUserStoreOrders, updateStoreOrderStatusApi } from '../../services/storeService';
import { WHATSAPP_SUPPORT_PHONE, getWhatsAppSupportUrl } from '../../constants/support';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface MyOrdersTabProps {
  onGoToStore?: () => void;
}

export function MyOrdersTab({ onGoToStore }: MyOrdersTabProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Estado para Modal Anti-Missclick de Confirmação de Recebimento
  const [confirmModalOrder, setConfirmModalOrder] = useState<StoreOrder | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    loadUserOrders();
  }, [user?.uid, user?.email]);

  const loadUserOrders = async () => {
    if (!user?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Busca EXCLUSIVAMENTE pedidos deste usuário logado (query por userId + isolamento estrito)
      const data = await getUserStoreOrders(user.uid, user.email || undefined);
      setOrders(data);
    } catch (err) {
      console.error('Erro ao carregar meus pedidos:', err);
      toast.error('Não foi possível carregar o histórico de pedidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTracking = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success('Código de rastreio copiado!');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  /**
   * Suporte Pós-Entrega (Troca, Devolução e Atendimento Geral)
   * Se Entregue: Mensagem focada em troca/devolução do produto
   * Outros status: Mensagem de acompanhamento padrão
   */
  const handleOpenWhatsAppSupport = (order: StoreOrder) => {
    let message = '';
    
    if (order.status === 'Entregue') {
      message = `Olá, meu pedido #${order.orderId} foi entregue e preciso de ajuda com uma troca ou devolução do produto (${order.productName || 'produto'}).`;
    } else {
      message = `Olá, gostaria de informações sobre o andamento do meu pedido #${order.orderId} (${order.productName || 'Florescer'}).`;
    }

    const url = getWhatsAppSupportUrl(message, WHATSAPP_SUPPORT_PHONE);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * Confirmação Manual de Recebimento (Plano B pelo Usuário)
   */
  const handleConfirmReceipt = async () => {
    if (!confirmModalOrder) return;

    setIsConfirming(true);
    const nowIso = new Date().toISOString();
    const targetOrderId = confirmModalOrder.orderId;

    try {
      // 1. Tentar via API backend
      try {
        await updateStoreOrderStatusApi({
          orderId: targetOrderId,
          status: 'Entregue'
        });
      } catch (apiErr) {
        console.warn('Fallback para Firestore Client no recebimento:', apiErr);
        // 2. Fallback via Firestore Client
        const orderRef = doc(db, 'store_orders', targetOrderId);
        await updateDoc(orderRef, {
          status: 'Entregue',
          deliveredAt: nowIso,
          updatedAt: nowIso,
          userConfirmedDelivery: true
        });
      }

      // Atualiza o estado local imediatamente
      setOrders(prev =>
        prev.map(o =>
          o.orderId === targetOrderId
            ? { ...o, status: 'Entregue', deliveredAt: nowIso }
            : o
        )
      );

      toast.success('Recebimento confirmado com sucesso! Que sua leitura e uso sejam abençoados. ✨');
      setConfirmModalOrder(null);
    } catch (err: any) {
      console.error('Erro ao confirmar recebimento:', err);
      toast.error('Não foi possível confirmar o recebimento no momento.');
    } finally {
      setIsConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-3" />
        <p className="text-xs text-gray-500 font-medium">Buscando seus pedidos...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs my-4">
        <div className="w-16 h-16 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-900 dark:text-white text-base">Nenhum pedido realizado</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
          Você ainda não comprou itens físicos na Loja Florescer. Conheça nossos devocionais, papelaria e produtos especiais!
        </p>
        {onGoToStore && (
          <button
            onClick={onGoToStore}
            className="mt-5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Visitar a Loja Florescer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Meus Pedidos</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Acompanhe suas compras, entregas e suporte</p>
        </div>
        <button
          onClick={loadUserOrders}
          className="p-2 text-gray-400 hover:text-yellow-600 rounded-xl transition-colors cursor-pointer"
          title="Atualizar Pedidos"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3.5">
        {orders.map((order) => {
          const isShipped = order.status === 'Enviado';
          const isDelivered = order.status === 'Entregue';
          const isPreparing = order.status === 'Preparando Envio';
          const isPending = order.status === 'Aguardando Pagamento';

          const correiosUrl = order.trackingCode 
            ? `https://rastreamento.correios.com.br/app/index.php?codigo=${order.trackingCode}`
            : null;

          return (
            <div
              key={order.orderId}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-4 shadow-sm space-y-3.5"
            >
              {/* Topo do Card com Status */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                  <span 
                    className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400 truncate max-w-[130px] xs:max-w-[160px] inline-block align-middle"
                    title={`#${order.orderId}`}
                  >
                    #{order.orderId}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">
                    • {order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy') : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2 ml-auto sm:ml-0 shrink-0">
                  {isDelivered && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" />
                      Pós-Venda
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 whitespace-nowrap",
                      isPending && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                      isPreparing && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse",
                      isShipped && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                      isDelivered && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    )}
                  >
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Informações do Produto */}
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-gray-100 dark:border-slate-700">
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

                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                    {order.productName}
                  </h4>
                  <div className="text-xs font-black text-gray-900 dark:text-white mt-1">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalPrice)}
                  </div>
                  {order.deliveryAddress && (
                    <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                      Entrega: {order.deliveryAddress.city}/{order.deliveryAddress.state}
                    </div>
                  )}
                  {isDelivered && order.deliveredAt && (
                    <div className="text-[10px] text-green-600 dark:text-green-400 font-medium mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      Entregue em {format(new Date(order.deliveredAt), 'dd/MM/yyyy')}
                    </div>
                  )}
                </div>
              </div>

              {/* Rastreamento e Ações para Pedido Enviado */}
              {isShipped && (
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-300">
                      <Truck className="w-4 h-4 text-purple-600" />
                      <span>Objeto em Trânsito</span>
                    </div>
                    {order.trackingCode && (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-mono text-xs font-black text-purple-800 dark:text-purple-200 truncate max-w-[140px] sm:max-w-none">
                          {order.trackingCode}
                        </span>
                        <button
                          onClick={() => handleCopyTracking(order.trackingCode!, order.orderId)}
                          className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer"
                          title="Copiar Código"
                        >
                          {copiedCode === order.orderId ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {correiosUrl ? (
                      <a
                        href={correiosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Rastrear Correios</span>
                      </a>
                    ) : (
                      <div className="text-[11px] text-purple-700 dark:text-purple-300 py-2 flex items-center">
                        Rastreio em processamento.
                      </div>
                    )}

                    {/* Botão de Confirmação Manual de Recebimento (Plano B do Usuário) */}
                    <button
                      onClick={() => setConfirmModalOrder(order)}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar Recebimento</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Botão de Suporte WhatsApp (Regra de Pós-Venda & Troca/Devolução) */}
              <button
                onClick={() => handleOpenWhatsAppSupport(order)}
                className={cn(
                  "w-full py-2.5 px-4 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer",
                  isDelivered
                    ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 shadow-2xs"
                    : "bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40"
                )}
              >
                {isDelivered ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Ajuda com Troca ou Devolução</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span>Precisa de Ajuda com este Pedido?</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ========================================================
          MODAL DE CONFIRMAÇÃO ANTI-MISSCLICK (RECEBIMENTO)
          ======================================================== */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            {/* Header do Modal */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                    Confirmar Recebimento
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Pedido #{confirmModalOrder.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isConfirming && setConfirmModalOrder(null)}
                disabled={isConfirming}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview do Produto */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-3.5 rounded-2xl flex items-center gap-3 border border-gray-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700 overflow-hidden shrink-0">
                {confirmModalOrder.productImage ? (
                  <img
                    src={confirmModalOrder.productImage}
                    alt={confirmModalOrder.productName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {confirmModalOrder.productName}
                </h4>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                  Rastreio: {confirmModalOrder.trackingCode || 'Correios'}
                </p>
              </div>
            </div>

            {/* Pergunta de Segurança Anti-Missclick */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Confirmação de Entrega</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">
                Você confirma que recebeu este produto em perfeitas condições?
              </p>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              💡 <span className="font-semibold">Fique tranquilo:</span> Caso ocorra qualquer divergência, avaria no transporte ou necessidade de troca, nossa equipe de suporte está à disposição no WhatsApp.
            </p>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                disabled={isConfirming}
                className="w-full py-2.5 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Ainda não recebi
              </button>
              <button
                type="button"
                onClick={handleConfirmReceipt}
                disabled={isConfirming}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sim, recebi o produto</span>
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
