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
  RefreshCw 
} from 'lucide-react';
import { StoreOrder } from '../../types';
import { getStoreOrders } from '../../services/storeService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface MyOrdersTabProps {
  onGoToStore?: () => void;
}

export function MyOrdersTab({ onGoToStore }: MyOrdersTabProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    loadUserOrders();
  }, [user?.uid]);

  const loadUserOrders = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await getStoreOrders(user.uid);
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

  const handleOpenWhatsAppSupport = (order: StoreOrder) => {
    const rawNumber = '5511999999999'; // Número da central Florescer
    const message = `Olá, preciso de ajuda com o meu pedido #${order.orderId} - ${order.productName}.`;
    const url = `https://wa.me/${rawNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Acompanhe suas compras e entregas</p>
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
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
                    #{order.orderId}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    • {order.createdAt ? format(new Date(order.createdAt), 'dd/MM/yyyy') : ''}
                  </span>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                    isPending && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                    isPreparing && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse",
                    isShipped && "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
                    isDelivered && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  )}
                >
                  {order.status}
                </span>
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
                </div>
              </div>

              {/* Rastreamento Automático Correios (Regra 5) */}
              {isShipped && (
                <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900 dark:text-purple-300">
                      <Truck className="w-4 h-4 text-purple-600" />
                      <span>Objeto em Trânsito</span>
                    </div>
                    {order.trackingCode && (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-black text-purple-800 dark:text-purple-200">
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

                  {correiosUrl ? (
                    <a
                      href={correiosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Acompanhar Entrega no Correios</span>
                    </a>
                  ) : (
                    <div className="text-[11px] text-purple-700 dark:text-purple-300">
                      O código de rastreamento será disponibilizado em breve.
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Suporte WhatsApp (Regra 5) */}
              <button
                onClick={() => handleOpenWhatsAppSupport(order)}
                className="w-full py-2.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-950/30 text-green-700 dark:text-green-400 font-bold text-xs rounded-xl border border-green-200 dark:border-green-900/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Precisa de Ajuda com este Pedido?</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
