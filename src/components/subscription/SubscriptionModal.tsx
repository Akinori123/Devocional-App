import { useState } from 'react';
import { Crown, Sparkles, Check, X, ArrowRight, ShieldCheck, Heart, Bot, Image as ImageIcon, Headphones, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PixPaymentModal, PixPaymentData } from './PixPaymentModal';
import { useToast } from '../../context/ToastContext';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSubscription?: () => void;
  featureName?: string;
}

export function SubscriptionModal({ 
  isOpen, 
  onClose, 
  onNavigateToSubscription,
  featureName = "Resumo Espiritual com Inteligência Artificial"
}: SubscriptionModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [loadingCard, setLoadingCard] = useState(false);

  if (!isOpen) return null;

  const vipFeatures = [
    {
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      title: "Resumo Espiritual da Semana (IA)",
      desc: "Análise profunda das suas orações e reflexões do diário com a IA teológica."
    },
    {
      icon: <ImageIcon className="w-4 h-4 text-amber-500" />,
      title: "Gerador de Imagens Bíblicas com IA",
      desc: "Crie artes sacras e reflexões visuais personalizadas para compartilhar."
    },
    {
      icon: <Headphones className="w-4 h-4 text-amber-500" />,
      title: "Narração em Áudio da Bíblia & Devocionais",
      desc: "Ouça a Palavra com voz humana de alta qualidade onde você estiver."
    },
    {
      icon: <Video className="w-4 h-4 text-amber-500" />,
      title: "Vídeos & Mensagens Pastorais Exclusivas",
      desc: "Acesso total ao acervo VIP de ministrações e orações."
    },
    {
      icon: <Bot className="w-4 h-4 text-amber-500" />,
      title: "Teólogo Particular IA Ilimitado",
      desc: "Tire dúvidas profundas sobre qualquer versículo ou tema bíblico."
    }
  ];

  const handleSubscribeCard = async () => {
    if (!user) {
      toast.error("Você precisa estar conectado à sua conta.");
      return;
    }

    try {
      setLoadingCard(true);
      const res = await fetch('/api/mercadopago/create-subscription-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          plan: 'monthly',
          amount: 29.90
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar link de pagamento.");

      if (data.init_point) {
        window.location.href = data.init_point;
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      toast.error(err.message || "Erro ao processar assinatura.");
    } finally {
      setLoadingCard(false);
    }
  };

  const handleSubscribePix = async () => {
    if (!user) {
      toast.error("Você precisa estar conectado à sua conta.");
      return;
    }

    try {
      setLoadingPix(true);
      const res = await fetch('/api/mercadopago/create-pix-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userEmail: user.email,
          plan: 'monthly',
          amount: 29.90
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar chave PIX.");

      if (data.qr_code && data.qr_code_base64) {
        setPixData({
          id: data.payment_id || String(Date.now()),
          qrCode: data.qr_code,
          qrCodeBase64: data.qr_code_base64,
          amount: 29.90,
          expiresAt: data.date_of_expiration
        });
        setPixModalOpen(true);
      }
    } catch (err: any) {
      console.error("PIX error:", err);
      toast.error(err.message || "Erro ao gerar PIX.");
    } finally {
      setLoadingPix(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-amber-200/50 dark:border-slate-800 overflow-hidden relative my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Luxury Glow */}
        <div className="bg-gradient-to-b from-amber-500/20 via-yellow-500/10 to-transparent p-6 text-center pt-7">
          <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30 text-white animate-bounce-subtle">
            <Crown className="w-7 h-7" />
          </div>

          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-900 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-amber-500/30 mb-2">
            <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Recurso Exclusivo VIP
          </span>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-serif">
            Florescer Premium
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 max-w-xs mx-auto">
            O <strong className="text-amber-600 dark:text-amber-400">{featureName}</strong> é uma ferramenta exclusiva para assinantes.
          </p>
        </div>

        {/* Benefits List */}
        <div className="px-6 py-2 space-y-2.5">
          {vipFeatures.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2.5 rounded-2xl bg-amber-50/50 dark:bg-slate-800/60 border border-amber-100/60 dark:border-slate-700/60">
              <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0 mt-0.5">
                {feat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">{feat.title}</h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Price Tag & Action */}
        <div className="p-6 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 mt-3 text-center">
          <div className="flex items-center justify-center gap-1 text-gray-900 dark:text-white mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Apenas</span>
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400">R$ 29,90</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">/mês</span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4">
            Sem fidelidade. Cancele quando quiser diretamente no aplicativo.
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSubscribeCard}
              disabled={loadingCard}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Crown className="w-4 h-4" />
              <span>{loadingCard ? "Carregando checkout..." : "Assinar com Cartão de Crédito"}</span>
            </button>

            <button
              onClick={handleSubscribePix}
              disabled={loadingPix}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-98"
            >
              <span>{loadingPix ? "Gerando PIX..." : "Pagar com PIX Mensal (R$ 29,90)"}</span>
            </button>

            {onNavigateToSubscription && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToSubscription();
                }}
                className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 mt-1 py-1"
              >
                Ver todos os detalhes dos planos
              </button>
            )}
          </div>
        </div>
      </div>

      {pixData && (
        <PixPaymentModal
          isOpen={pixModalOpen}
          onClose={() => setPixModalOpen(false)}
          pixData={pixData}
          loading={loadingPix}
          onSuccess={() => {
            setPixModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}
