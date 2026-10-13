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
  X, 
  Trash2,
  RotateCcw,
  Inbox,
  History,
  FileText,
  AlertTriangle,
  HelpCircle,
  Search
} from 'lucide-react';
import { StoreOrder, StoreOrderStatus } from '../../types';
import { 
  getUserStoreOrders, 
  subscribeUserStoreOrders, 
  updateStoreOrderStatusApi, 
  verifyStoreOrderPaymentApi,
  deleteStoreOrder
} from '../../services/storeService';
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
  
  // Organização da Aba do Cliente: Em Andamento vs Histórico
  const [customerTab, setCustomerTab] = useState<'ongoing' | 'history'>('ongoing');
  const [orderSearch, setOrderSearch] = useState('');

  // Estado para Modal Anti-Missclick de Confirmação de Recebimento
  const [confirmModalOrder, setConfirmModalOrder] = useState<StoreOrder | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Modal Regra B: Solicitação de Cancelamento (Pago, Preparando Envio)
  const [cancelModalOrder, setCancelModalOrder] = useState<StoreOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Comprei por engano');
  const [cancelNotes, setCancelNotes] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Modal Regra C: Solicitação de Devolução / Inquérito (Enviado / Entregue)
  const [returnModalOrder, setReturnModalOrder] = useState<StoreOrder | null>(null);
  const [returnReason, setReturnReason] = useState<string>('Defeito / Avaria de fabricação');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [copiedMpId, setCopiedMpId] = useState<string | null>(null);
  const [customPaymentIdInput, setCustomPaymentIdInput] = useState<{ [orderId: string]: string }>({});
  const [showPaymentIdInput, setShowPaymentIdInput] = useState<{ [orderId: string]: boolean }>({});

  useEffect(() => {
    if (!user?.uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Inscrição em Tempo Real (onSnapshot) para sincronização instantânea com o Webhook
    const unsubscribe = subscribeUserStoreOrders(
      user.uid,
      user.email || undefined,
      (updatedOrders) => {
        setOrders(updatedOrders);
        setLoading(false);
      },
      (err) => {
        console.warn('Falha no listener em tempo real, carregando via fallback:', err);
        loadUserOrders();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, user?.email]);

  const handleVerifyOrderPayment = async (order: StoreOrder, customPaymentId?: string) => {
    setVerifyingOrderId(order.orderId);
    try {
      const res = await verifyStoreOrderPaymentApi({
        orderId: order.orderId,
        paymentId: customPaymentId || customPaymentIdInput[order.orderId] || (order as any).paymentId,
        userEmail: user?.email || order.userEmail
      });

      if (res.success && res.status !== 'Aguardando Pagamento') {
        const newStatus = (res.status as any) || 'Preparando Envio';
        toast.success(res.message || 'Pagamento confirmado com sucesso!');
        setOrders(prev => prev.map(o => o.orderId === order.orderId ? { ...o, status: newStatus } : o));
        loadUserOrders();
      } else {
        toast.info(res.message || 'Nenhum pagamento aprovado foi localizado no Mercado Pago para este pedido até o momento.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar pagamento no Mercado Pago.');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const handleCancelPendingOrder = async (order: StoreOrder) => {
    setCancellingOrderId(order.orderId);
    try {
      const reason = 'Desistência antes do pagamento';
      await updateStoreOrderStatusApi({
        orderId: order.orderId,
        status: 'Cancelado',
        cancellationReason: reason
      });

      toast.success('Pedido cancelado com sucesso. Ele foi movido para o Histórico.');
      setConfirmCancelId(null);
      // Move para status Cancelado no estado (vai para aba Histórico)
      setOrders(prev => prev.map(o => o.orderId === order.orderId ? { ...o, status: 'Cancelado', cancellationReason: reason } : o));
    } catch (err: any) {
      console.error('Erro ao cancelar o pedido:', err);
      toast.error(err?.message || 'Erro ao cancelar o pedido.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleRequestCancellation = async () => {
    if (!cancelModalOrder) return;
    setIsSubmittingCancel(true);
    const targetOrderId = cancelModalOrder.orderId;
    const fullReason = cancelNotes.trim() ? `${cancelReason} - ${cancelNotes.trim()}` : cancelReason;
    try {
      await updateStoreOrderStatusApi({
        orderId: targetOrderId,
        status: 'Cancelamento Solicitado',
        cancellationReason: fullReason
      });
      setOrders(prev => prev.map(o => o.orderId === targetOrderId ? { ...o, status: 'Cancelamento Solicitado', cancellationReason: fullReason } : o));
      toast.success('Solicitação de cancelamento enviada! A administração analisará e processará o estorno.');
      setCancelModalOrder(null);
      setCancelNotes('');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar cancelamento.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!returnModalOrder) return;
    setIsSubmittingReturn(true);
    const targetOrderId = returnModalOrder.orderId;
    const fullReason = returnNotes.trim() ? `${returnReason} - ${returnNotes.trim()}` : returnReason;
    try {
      await updateStoreOrderStatusApi({
        orderId: targetOrderId,
        status: 'Em Análise (Inquérito)',
        disputeReason: fullReason
      });
      setOrders(prev => prev.map(o => o.orderId === targetOrderId ? { ...o, status: 'Em Análise (Inquérito)', disputeReason: fullReason } : o));
      toast.success('Inquérito de devolução aberto! Analisaremos o envio da logística reversa.');
      setReturnModalOrder(null);
      setReturnNotes('');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao solicitar devolução.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

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

  const handleCopyOrderId = (id: string) => {
    const pedCode = `#PED-${(id.replace(/\D/g, '').slice(-6) || id.slice(-6)).toUpperCase()}`;
    navigator.clipboard.writeText(pedCode);
    setCopiedOrderId(id);
    toast.success(`Código ${pedCode} copiado com sucesso!`);
    setTimeout(() => setCopiedOrderId(null), 2500);
  };

  const handleCopyMpId = (mpId: string) => {
    navigator.clipboard.writeText(mpId);
    setCopiedMpId(mpId);
    toast.success('Nº da Operação do Mercado Pago copiado!');
    setTimeout(() => setCopiedMpId(null), 2500);
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

  const ongoingOrders = orders.filter(o => 
    ['Aguardando Pagamento', 'Preparando Envio', 'Enviado', 'Cancelamento Solicitado', 'Em Análise (Inquérito)', 'Devolução Aprovada'].includes(o.status)
  );

  const historyOrders = orders.filter(o => 
    ['Entregue', 'Cancelado', 'Reembolsado'].includes(o.status)
  );

  const getCustomerPedCode = (orderId: string): string => {
    if (!orderId) return '';
    const digits = orderId.replace(/\D/g, '');
    return (digits.slice(-6) || orderId.slice(-6)).toUpperCase();
  };

  const currentTabOrders = customerTab === 'ongoing' ? ongoingOrders : historyOrders;

  const displayedOrders = currentTabOrders.filter(o => {
    const rawSearch = orderSearch.trim().toLowerCase();
    if (!rawSearch) return true;

    const cleanSearch = rawSearch.startsWith('#') ? rawSearch.slice(1).trim() : rawSearch;
    const pedCode = getCustomerPedCode(o.orderId).toLowerCase();
    const pedTag = `ped-${pedCode}`;
    const pedTagHash = `#${pedTag}`;
    const pedTagNoDash = `ped${pedCode}`;

    const orderIdLower = (o.orderId || '').toLowerCase();
    const orderIdHash = `#${orderIdLower}`;
    const orderIdDigits = o.orderId.replace(/\D/g, '');

    const matchesId =
      pedCode.includes(cleanSearch) ||
      pedTag.includes(rawSearch) ||
      pedTag.includes(cleanSearch) ||
      pedTagHash.includes(rawSearch) ||
      pedTagNoDash.includes(cleanSearch.replace(/[-_ ]/g, '')) ||
      orderIdLower.includes(rawSearch) ||
      orderIdLower.includes(cleanSearch) ||
      orderIdHash.includes(rawSearch) ||
      (orderIdDigits.length > 0 && orderIdDigits.includes(cleanSearch));

    const matchesOther =
      (o.productName && o.productName.toLowerCase().includes(rawSearch)) ||
      (o.trackingCode && o.trackingCode.toLowerCase().includes(rawSearch)) ||
      (o.returnTrackingCode && o.returnTrackingCode.toLowerCase().includes(rawSearch));

    return matchesId || matchesOther;
  });

  return (
    <div className="space-y-4 p-4">
      {/* Topo do Header */}
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

      {/* Sub-abas de Navegação: Em Andamento vs Histórico */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-2xl w-full">
        <button
          onClick={() => setCustomerTab('ongoing')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
            customerTab === 'ongoing'
              ? "bg-white dark:bg-slate-900 text-yellow-600 dark:text-yellow-400 shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Inbox className="w-3.5 h-3.5 shrink-0" />
          <span>Em Andamento</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.2 rounded-full font-black shrink-0",
            ongoingOrders.length > 0
              ? "bg-yellow-500 text-white"
              : "bg-gray-200 dark:bg-slate-700 text-gray-500"
          )}>
            {ongoingOrders.length}
          </span>
        </button>

        <button
          onClick={() => setCustomerTab('history')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 sm:py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer",
            customerTab === 'history'
              ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>Histórico</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 shrink-0">
            {historyOrders.length}
          </span>
        </button>
      </div>

      {/* Barra de Pesquisa de Pedidos */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="Buscar por #PED, Nº do pedido (ord_) ou produto..."
          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/30 shadow-2xs"
        />
        {orderSearch && (
          <button
            type="button"
            onClick={() => setOrderSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors cursor-pointer"
            title="Limpar pesquisa"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Listagem de Pedidos ou Estado Vazio da Sub-aba */}
      {displayedOrders.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs my-2">
          <div className="w-14 h-14 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            {customerTab === 'ongoing' ? <Inbox className="w-7 h-7" /> : <History className="w-7 h-7" />}
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            {orderSearch 
              ? `Nenhum pedido encontrado para "${orderSearch}"`
              : (customerTab === 'ongoing' ? 'Nenhum pedido em andamento' : 'Nenhum pedido no histórico')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {orderSearch ? (
              <button
                type="button"
                onClick={() => setOrderSearch('')}
                className="text-yellow-600 dark:text-yellow-400 hover:underline font-semibold cursor-pointer"
              >
                Limpar pesquisa para ver todos os pedidos
              </button>
            ) : (
              customerTab === 'ongoing'
                ? 'Você não possui compras ativas no momento. Quando realizar um pedido, acompanhe o envio por aqui.'
                : 'Seus pedidos entregues, cancelados ou reembolsados serão arquivados aqui.'
            )}
          </p>
          {customerTab === 'ongoing' && onGoToStore && !orderSearch && (
            <button
              onClick={onGoToStore}
              className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Visitar a Loja Florescer
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedOrders.map((order) => {
            const isShipped = order.status === 'Enviado';
            const isDelivered = order.status === 'Entregue';
            const isPreparing = order.status === 'Preparando Envio';
            const isPending = order.status === 'Aguardando Pagamento';
            const isCancelRequested = order.status === 'Cancelamento Solicitado';
            const isDisputeReview = order.status === 'Em Análise (Inquérito)';
            const isReturnApproved = order.status === 'Devolução Aprovada';
            const isRefunded = order.status === 'Reembolsado';
            const isCanceled = order.status === 'Cancelado';

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
                  <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/40 text-xs font-black font-mono shrink-0 shadow-2xs">
                      <span>#PED-{(order.orderId.replace(/\D/g, '').slice(-6) || order.orderId.slice(-6)).toUpperCase()}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOrderId(order.orderId)}
                        className="p-0.5 text-yellow-700 dark:text-yellow-400 hover:text-yellow-950 dark:hover:text-yellow-200 transition-colors cursor-pointer"
                        title="Copiar Código do Pedido"
                      >
                        {copiedOrderId === order.orderId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <span className="text-[11px] text-gray-500 dark:text-gray-400 shrink-0 whitespace-nowrap font-medium">
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
                        isDelivered && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
                        isCancelRequested && "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40",
                        isDisputeReview && "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40",
                        isReturnApproved && "bg-teal-100 text-teal-900 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40",
                        isRefunded && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40",
                        isCanceled && "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 border border-gray-200 dark:border-slate-700"
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                        {order.productName}
                      </h4>
                      {order.quantity && order.quantity > 1 ? (
                        <span className="text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800/60 shrink-0">
                          {order.quantity}x unidades juntas
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          (1 unidade)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalPrice)}
                      </span>
                      {order.quantity && order.quantity > 1 && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.unitPrice || (order.totalPrice / order.quantity))} un.)
                        </span>
                      )}
                    </div>
                    {order.deliveryAddress && (
                      <div className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                        Entrega: {order.deliveryAddress.city}/{order.deliveryAddress.state}
                      </div>
                    )}
                    {(order.mpPaymentId || order.paymentId) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1">
                          <span>Nº da Operação MP:</span>
                          <strong className="select-all">{order.mpPaymentId || order.paymentId}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMpId(order.mpPaymentId || order.paymentId!)}
                          className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer shrink-0"
                          title="Copiar Nº da Operação MP"
                        >
                          {copiedMpId === (order.mpPaymentId || order.paymentId) ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
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

                {/* =======================================================
                    FLUXO REGRA A: Pedido com Pagamento Pendente
                    ======================================================= */}
                {isPending && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Aguardando Confirmação do Pagamento</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      Se você já realizou o pagamento no Mercado Pago, clique no botão abaixo para sincronizar e confirmar seu pedido imediatamente.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleVerifyOrderPayment(order)}
                      disabled={verifyingOrderId === order.orderId}
                      className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {verifyingOrderId === order.orderId ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verificando com Mercado Pago...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Já Paguei / Verificar Pagamento</span>
                        </>
                      )}
                    </button>

                    <div className="pt-1">
                      {!showPaymentIdInput[order.orderId] ? (
                        <button
                          type="button"
                          onClick={() => setShowPaymentIdInput(prev => ({ ...prev, [order.orderId]: true }))}
                          className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold w-full text-center cursor-pointer"
                        >
                          Tem o Nº da Operação/Comprovante do Mercado Pago? Clique aqui
                        </button>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-amber-900 dark:text-amber-300">
                            Nº da Operação no Comprovante MP / Pix:
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={customPaymentIdInput[order.orderId] || ''}
                              onChange={(e) => setCustomPaymentIdInput(prev => ({ ...prev, [order.orderId]: e.target.value }))}
                              placeholder="Ex: 10482938491"
                              className="flex-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleVerifyOrderPayment(order, customPaymentIdInput[order.orderId])}
                              disabled={verifyingOrderId === order.orderId || !customPaymentIdInput[order.orderId]?.trim()}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Regra A: Botão Desistir cancela na hora e o pedido vai para o histórico */}
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                      {confirmCancelId === order.orderId ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50">
                          <span className="text-xs text-red-700 dark:text-red-300 font-semibold">
                            Confirmar cancelamento deste pedido pendente?
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCancelPendingOrder(order)}
                              disabled={cancellingOrderId === order.orderId}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                            >
                              {cancellingOrderId === order.orderId ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Cancelando...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Sim, desistir</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmCancelId(null)}
                              disabled={cancellingOrderId === order.orderId}
                              className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setConfirmCancelId(order.orderId)}
                            disabled={cancellingOrderId === order.orderId}
                            className="text-[11px] text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 py-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Desistir / Cancelar este pedido</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* =======================================================
                    FLUXO REGRA B: Pedido Pago em Preparação (Preparando Envio)
                    ======================================================= */}
                {isPreparing && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span>Pagamento Confirmado • Em Separação</span>
                      </div>
                      <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                        Embalando produto
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                      Seu pedido está sendo cuidadosamente preparado por nossa equipe para postagem nos Correios.
                    </p>

                    {/* Botão Regra B: Solicitar Cancelamento com Estorno */}
                    <div className="pt-1.5 border-t border-blue-200/60 dark:border-blue-900/40 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalOrder(order);
                          setCancelReason('Comprei por engano');
                          setCancelNotes('');
                        }}
                        className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 font-bold transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Solicitar Cancelamento da Compra</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =======================================================
                    FLUXO REGRA C: Pedido Enviado (Objeto em Trânsito)
                    ======================================================= */}
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

                    {order.quantity && order.quantity > 1 && (
                      <div className="text-[11px] text-purple-800 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-900/40 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
                        <span>📦 Envio Unificado: Todas as {order.quantity} unidades deste pedido foram enviadas juntas no mesmo pacote.</span>
                      </div>
                    )}

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

                      {/* Botão de Confirmação Manual de Recebimento */}
                      <button
                        onClick={() => setConfirmModalOrder(order)}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmar Recebimento</span>
                      </button>
                    </div>

                    {/* Regra C: Opção de Solicitar Devolução / Inquérito caso já tenha chegado ou com problema */}
                    <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/40 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setReturnModalOrder(order);
                          setReturnReason('Defeito / Avaria de fabricação');
                          setReturnNotes('');
                        }}
                        className="text-xs text-purple-700 dark:text-purple-300 hover:underline font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Solicitar Devolução / Reembolso</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =======================================================
                    FLUXO REGRA C: Pedido Entregue (Pós-Venda)
                    ======================================================= */}
                {isDelivered && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Entrega Concluída</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        Garantia CDC Ativa
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                      <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                        Precisou trocar ou devolver o item?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReturnModalOrder(order);
                          setReturnReason('Defeito / Avaria de fabricação');
                          setReturnNotes('');
                        }}
                        className="text-xs text-rose-700 dark:text-rose-300 hover:text-rose-900 font-bold transition-colors cursor-pointer flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-rose-100/60 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span>Solicitar Devolução / Reembolso</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =======================================================
                    STATUS: Cancelamento Solicitado (Regra B em auditoria)
                    ======================================================= */}
                {isCancelRequested && (
                  <div className="bg-orange-50 dark:bg-orange-950/25 border border-orange-200/80 dark:border-orange-900/50 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-orange-900 dark:text-orange-200">
                      <Clock className="w-4 h-4 text-orange-600 shrink-0" />
                      <span>Cancelamento Solicitado • Em Análise Financeira</span>
                    </div>
                    <p className="text-xs text-orange-800/90 dark:text-orange-300/90 leading-relaxed">
                      Sua solicitação de cancelamento foi registrada e está sendo processada pela administração. O estorno será efetuado no método original de pagamento.
                    </p>
                    {order.cancellationReason && (
                      <div className="text-[11px] text-orange-950 dark:text-orange-200 bg-orange-100/70 dark:bg-orange-900/30 p-2 rounded-xl">
                        <strong>Motivo informado:</strong> {order.cancellationReason}
                      </div>
                    )}
                  </div>
                )}

                {/* =======================================================
                    STATUS: Em Análise (Inquérito aberto para Devolução)
                    ======================================================= */}
                {isDisputeReview && (
                  <div className="bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Em Análise de Devolução • Inquérito Aberto</span>
                    </div>
                    <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
                      Sua solicitação de devolução está sendo auditada por nossos especialistas. Assim que deferida, emitiremos o código de postagem reversa dos Correios.
                    </p>
                    {order.disputeReason && (
                      <div className="text-[11px] text-indigo-950 dark:text-indigo-200 bg-indigo-100/70 dark:bg-indigo-900/30 p-2 rounded-xl">
                        <strong>Motivo da Devolução:</strong> {order.disputeReason}
                      </div>
                    )}
                  </div>
                )}

                {/* =======================================================
                    STATUS: Devolução Aprovada (Instruções de Logística Reversa)
                    ======================================================= */}
                {isReturnApproved && (
                  <div className="bg-teal-50 dark:bg-teal-950/25 border border-teal-200/80 dark:border-teal-900/50 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>Devolução Aprovada • Logística Reversa Autorizada</span>
                    </div>
                    <p className="text-xs text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
                      Sua devolução foi autorizada. Siga as orientações abaixo para postar o produto. O reembolso será concluído assim que a encomenda chegar à nossa central e for conferida.
                    </p>

                    {order.returnTrackingCode && (
                      <div className="flex items-center justify-between bg-teal-100/80 dark:bg-teal-900/40 p-2.5 rounded-xl border border-teal-200 dark:border-teal-800/60">
                        <div className="text-xs font-bold text-teal-900 dark:text-teal-100">
                          Código de Postagem Reversa: <span className="font-mono">{order.returnTrackingCode}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(order.returnTrackingCode!);
                            toast.success('Código reverso copiado!');
                          }}
                          className="p-1 text-teal-700 hover:text-teal-900 dark:text-teal-300 cursor-pointer"
                          title="Copiar Código"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {order.returnInstructions && (
                      <div className="text-[11px] text-teal-950 dark:text-teal-200 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-teal-200/60 dark:border-teal-900/40">
                        <strong>Instruções de Envio:</strong> {order.returnInstructions}
                      </div>
                    )}
                  </div>
                )}

                {/* =======================================================
                    STATUS: Reembolsado (Finalizado)
                    ======================================================= */}
                {isRefunded && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Reembolso Concluído</span>
                    </div>
                    <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                      O valor total desta compra ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.totalPrice)}) foi estornado com sucesso.
                    </p>
                    {order.refundedAt && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        Data do estorno: {format(new Date(order.refundedAt), 'dd/MM/yyyy HH:mm')}
                      </div>
                    )}
                  </div>
                )}

                {/* =======================================================
                    STATUS: Cancelado (Histórico)
                    ======================================================= */}
                {isCanceled && (
                  <div className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      <X className="w-3.5 h-3.5 text-gray-500" />
                      <span>Pedido Cancelado</span>
                    </div>
                    {order.cancellationReason && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Motivo: {order.cancellationReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Botão de Suporte WhatsApp */}
                <button
                  onClick={() => handleOpenWhatsAppSupport(order)}
                  className="w-full py-2.5 px-4 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/40"
                >
                  <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span>Precisa de Ajuda com este Pedido? Fale no WhatsApp</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          MODAL REGRA B: SOLICITAÇÃO DE CANCELAMENTO (PAGO)
          ======================================================== */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                    Solicitar Cancelamento
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Pedido #{cancelModalOrder.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSubmittingCancel && setCancelModalOrder(null)}
                disabled={isSubmittingCancel}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso Informativo Obrigatório sobre Estorno */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Estorno em Conta / Cartão</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                Seu pedido já foi pago e está em separação. O estorno de <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cancelModalOrder.totalPrice)}</strong> será realizado pela administração em até <strong>3 a 5 dias úteis</strong> no mesmo método de pagamento (Cartão ou PIX).
              </p>
            </div>

            {/* Seleção do Motivo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Motivo do Cancelamento:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  'Comprei por engano',
                  'Prazo de entrega longo',
                  'Mudei de ideia',
                  'Endereço incorreto',
                  'Outro motivo'
                ].map((reasonOption) => (
                  <button
                    key={reasonOption}
                    type="button"
                    onClick={() => setCancelReason(reasonOption)}
                    className={cn(
                      "text-xs py-2 px-2.5 rounded-xl font-medium border text-left transition-colors cursor-pointer truncate",
                      cancelReason === reasonOption
                        ? "bg-amber-500 text-white border-amber-500 font-bold"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100"
                    )}
                  >
                    {reasonOption}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Observações adicionais (opcional):
              </label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                placeholder="Explique detalhes para agilizar o atendimento..."
                rows={2}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                disabled={isSubmittingCancel}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRequestCancellation}
                disabled={isSubmittingCancel}
                className="py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCancel ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Confirmar Cancelamento</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL REGRA C: INQUÉRITO DE DEVOLUÇÃO / LOGÍSTICA REVERSA
          ======================================================== */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                    Solicitar Devolução / Reembolso
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Pedido #{returnModalOrder.orderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSubmittingReturn && setReturnModalOrder(null)}
                disabled={isSubmittingReturn}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso Obrigatório de Logística Reversa (Regra do Negócio) */}
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Aviso de Logística Reversa</span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed font-medium">
                ⚠️ O reembolso só será liberado <strong>APÓS</strong> você postar o produto nos Correios com o código reverso e ele chegar em nossa central para conferência de integridade.
              </p>
            </div>

            {/* Seleção do Motivo */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Motivo da Devolução:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  'Defeito / Avaria de fabricação',
                  'Produto diferente do anunciado',
                  'Arrependimento (Art. 49 CDC)',
                  'Avaria no transporte',
                  'Outro motivo'
                ].map((reasonOption) => (
                  <button
                    key={reasonOption}
                    type="button"
                    onClick={() => setReturnReason(reasonOption)}
                    className={cn(
                      "text-xs py-2 px-2.5 rounded-xl font-medium border text-left transition-colors cursor-pointer truncate",
                      returnReason === reasonOption
                        ? "bg-purple-600 text-white border-purple-600 font-bold"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100"
                    )}
                  >
                    {reasonOption}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Descreva o motivo detalhadamente:
              </label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Informe o que ocorreu com o item para orientar a conferência..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setReturnModalOrder(null)}
                disabled={isSubmittingReturn}
                className="py-2.5 px-4 rounded-xl border border-gray-200 dark:border-slate-700 font-bold text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleRequestReturn}
                disabled={isSubmittingReturn}
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReturn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Abrindo...</span>
                  </>
                ) : (
                  <span>Abrir Inquérito</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE CONFIRMAÇÃO ANTI-MISSCLICK (RECEBIMENTO)
          ======================================================== */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-4">
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
