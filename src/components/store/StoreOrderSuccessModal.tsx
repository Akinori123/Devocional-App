import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { PackageCheck, Truck, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { verifyStoreOrderPaymentApi } from '../../services/storeService';

interface StoreOrderSuccessModalProps {
  onNavigateToOrders?: () => void;
}

export function StoreOrderSuccessModal({ onNavigateToOrders }: StoreOrderSuccessModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type') || urlParams.get('order_type');
    const orderIdParam = urlParams.get('orderId') || urlParams.get('external_reference');
    const paymentIdParam = urlParams.get('payment_id') || urlParams.get('collection_id') || urlParams.get('data.id');
    const payParam = urlParams.get('payment');
    const statusParam = urlParams.get('status');
    const collectionStatus = urlParams.get('collection_status');

    // Detectar retorno de checkout de produto da loja
    const isStorePaymentReturn = 
      (typeParam === 'store_order' || (orderIdParam && orderIdParam.startsWith('ord_')) || urlParams.get('subTab') === 'orders') &&
      (payParam === 'success' || payParam === 'pending' || statusParam === 'approved' || collectionStatus === 'approved');

    if (isStorePaymentReturn) {
      const activeOrderId = orderIdParam || null;
      setOrderId(activeOrderId);
      setIsOpen(true);

      // Auto-sincronizar pagamento com o backend e Mercado Pago de forma resiliente
      if (activeOrderId || paymentIdParam) {
        verifyStoreOrderPaymentApi({
          orderId: activeOrderId || undefined,
          paymentId: paymentIdParam || undefined
        }).catch((err) => {
          console.warn('[StoreOrderSuccessModal] Auto verify payment notice:', err);
        });
      }

      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.55 },
            colors: ['#EAB308', '#10B981', '#3B82F6', '#F59E0B']
          });
        } catch {
          // Ambiente sem canvas/confetti suportado
        }
      }
    }
  }, []);

  const handleClose = (shouldNavigateToOrders = false) => {
    // Limpar parâmetros da URL de retorno do Mercado Pago
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    setIsOpen(false);

    if (shouldNavigateToOrders && onNavigateToOrders) {
      onNavigateToOrders();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="store-order-success-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          id="store-order-success-card"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/80 border border-yellow-500/30 rounded-3xl p-6 shadow-2xl text-center overflow-hidden"
        >
          {/* Botão de Fechar */}
          <button
            onClick={() => handleClose(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Luz de fundo decorativa */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 py-2 flex flex-col items-center">
            {/* Ícone de Sucesso */}
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-yellow-500/20 to-emerald-500/20 border border-yellow-500/40 flex items-center justify-center shadow-lg">
                <PackageCheck className="w-10 h-10 text-yellow-400" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-slate-950 p-1.5 rounded-full shadow-md">
                <Truck className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Título Obrigatório */}
            <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
              Recebemos o seu pedido!
            </h2>

            {/* Subtítulo Obrigatório */}
            <p className="text-sm text-amber-100/90 leading-relaxed mb-5">
              Seu pagamento foi confirmado com sucesso. Estamos preparando o seu produto para envio!
            </p>

            {/* Cartão de Detalhes do Pedido */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-left flex flex-col gap-2.5">
              {orderId && (
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-gray-400 font-medium">Identificador:</span>
                  <span className="text-yellow-400 font-mono font-bold">{orderId}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                <span className="text-gray-400 font-medium">Status do Pedido:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Preparando Envio
                </span>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Assim que o pacote for despachado nos Correios, você poderá acompanhar o rastreio em tempo real na aba de pedidos.
                </p>
              </div>
            </div>

            {/* Botão de Ação Obrigatório: "Ver Meus Pedidos →" */}
            <button
              onClick={() => handleClose(true)}
              className="w-full bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3.5 px-6 rounded-2xl shadow-xl shadow-yellow-500/20 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer text-sm"
            >
              <span>Ver Meus Pedidos →</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
