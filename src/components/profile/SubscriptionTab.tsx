import { useState } from 'react';
import { 
  ShieldCheck, 
  Loader2, 
  AlertTriangle, 
  Crown, 
  Image as ImageIcon, 
  Headphones, 
  Video, 
  Calendar, 
  CreditCard, 
  CheckCircle2, 
  QrCode, 
  Clock, 
  Sparkles,
  ArrowRight,
  Zap,
  RefreshCw
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PixPaymentModal, PixPaymentData } from '../subscription/PixPaymentModal';

export function SubscriptionTab() {
  const toast = useToast();
  const { user, profile } = useAuth();
  
  const [loadingCard, setLoadingCard] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // PIX Modal State
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);

  const isPremium = profile?.isPremium === true;
  const isAdmin = profile?.isAdmin === true || 
    user?.email === 'dofekrafael@gmail.com' || 
    user?.email === 'sjhonatan916@gmail.com' || 
    user?.email === 'floresceremadoracao@gmail.com';
  
  const isCanceled = profile?.cancelAtPeriodEnd === true || profile?.subscriptionStatus === 'canceled';
  const isPixPrepaid = profile?.subscriptionType === 'pix_prepaid';

  // Format expiration date
  const getFormattedExpiration = () => {
    if (!profile?.subscriptionExpiresAt) return "o final do seu ciclo de faturamento";
    try {
      return format(new Date(profile.subscriptionExpiresAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return "o final do seu ciclo";
    }
  };

  // Calculate remaining days for PIX
  const getRemainingDays = () => {
    if (!profile?.subscriptionExpiresAt) return null;
    try {
      const days = differenceInDays(new Date(profile.subscriptionExpiresAt), new Date());
      return Math.max(0, days);
    } catch {
      return null;
    }
  };

  const remainingDays = getRemainingDays();

  const vipBenefits = [
    { 
      icon: <ImageIcon className="w-5 h-5 text-yellow-300" />, 
      title: 'Gerador de Imagens com IA', 
      desc: 'Crie artes e reflexões visuais personalizadas para meditar e compartilhar.' 
    },
    { 
      icon: <Headphones className="w-5 h-5 text-yellow-300" />, 
      title: 'Áudios Bíblicos & Devocionais', 
      desc: 'Ouça capítulos e reflexões guiadas com narração onde você estiver.' 
    },
    { 
      icon: <Video className="w-5 h-5 text-yellow-300" />, 
      title: 'Vídeos & Conteúdos Restritos', 
      desc: 'Acesso total a mensagens pastorais e devocionais exclusivos.' 
    },
    { 
      icon: <Crown className="w-5 h-5 text-yellow-300" />, 
      title: 'Teólogo Particular com IA', 
      desc: 'Tire dúvidas bíblicas, peça estudos e receba respostas aprofundadas.' 
    }
  ];

  // 1. Assinatura no Cartão
  const handleSubscribeCard = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para assinar.");
      return;
    }
    setLoadingCard(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userId: user.uid, 
          userEmail: user.email,
          userName: profile?.name || user.displayName
        })
      });
      if (!response.ok) {
        throw new Error('Falha ao gerar link de pagamento');
      }
      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error('Link de pagamento não retornado');
      }
    } catch (error) {
      console.error(error);
      toast.error("Houve um erro ao processar sua assinatura no cartão. Tente novamente.");
    } finally {
      setLoadingCard(false);
    }
  };

  // 2. Passe de 30 Dias no PIX
  const handleGeneratePix = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para gerar o PIX.");
      return;
    }
    setLoadingPix(true);
    setPixModalOpen(true);
    setPixData(null);
    try {
      const response = await fetch('/api/create-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          userId: user.uid, 
          userEmail: user.email,
          userName: profile?.name || user.displayName,
          amount: 1.00
        })
      });
      if (!response.ok) {
        throw new Error('Falha ao gerar PIX');
      }
      const data = await response.json();
      setPixData(data);
    } catch (error) {
      console.error(error);
      toast.error("Houve um erro ao gerar o código PIX. Tente novamente.");
      setPixModalOpen(false);
    } finally {
      setLoadingPix(false);
    }
  };

  // 3. Cancelar Assinatura Recorrente no Cartão
  const handleCancelSubscription = async () => {
    if (!user) return;
    setCanceling(true);
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid })
      });
      if (!response.ok) {
        throw new Error('Falha ao cancelar assinatura');
      }
      toast.success("Sua renovação automática foi cancelada. Seu acesso VIP continua ativo até o final do ciclo!");
      setShowCancelModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Houve um erro ao cancelar. Pode ser que ela já esteja cancelada.");
    } finally {
      setCanceling(false);
    }
  };

  // ================= ADMIN VIEW =================
  if (isAdmin) {
    return (
      <div className="p-4 sm:p-5 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-purple-800/40">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 text-center">
            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 p-4 rounded-2xl border border-purple-400/30 backdrop-blur-md">
                <ShieldCheck className="w-9 h-9 text-purple-300" />
              </div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-200 text-xs font-bold uppercase tracking-widest px-3.5 py-1 rounded-full border border-purple-400/30">
                <span>Nível Administrador</span>
              </div>
              <h3 className="text-2xl font-bold text-white tracking-wide mt-1">Acesso Total Vitalício</h3>
            </div>
            
            <div className="bg-purple-900/25 rounded-2xl p-4 mb-6 border border-purple-700/30 text-left">
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-purple-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white font-semibold">Conta Administrativa Blindada</p>
                  <p className="text-xs text-purple-200/80 mt-1 leading-relaxed">
                    Você possui todos os benefícios Premium VIP liberados permanentemente sem necessidade de pagamento.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5 text-left">
              {vipBenefits.map((benefit, i) => (
                <div key={i} className="flex gap-3.5 items-center bg-white/5 p-3.5 rounded-2xl border border-white/10">
                  <div className="bg-purple-800/40 p-2 rounded-xl border border-purple-700/30 text-purple-300">
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-white">{benefit.title}</p>
                    <p className="text-[11px] text-purple-200/70">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= ACTIVE PREMIUM VIEW =================
  if (isPremium) {
    return (
      <div className="p-4 sm:p-5 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-yellow-500/30">
          {/* Luzes decorativas */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3.5">
                <div className="bg-gradient-to-tr from-yellow-500 to-amber-300 p-0.5 rounded-2xl shadow-lg shadow-yellow-500/20">
                  <div className="bg-slate-950 p-2.5 rounded-[14px]">
                    <Crown className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-wide">Área VIP Florescer</h3>
                  <p className="text-xs font-bold text-yellow-400/90 tracking-wider uppercase">
                    {isPixPrepaid ? 'Passe de 30 Dias (PIX)' : 'Assinatura no Cartão'}
                  </p>
                </div>
              </div>
              
              <div className={`px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-widest backdrop-blur-md shadow-sm ${
                isCanceled 
                  ? 'bg-orange-950/60 border-orange-500/40 text-orange-300' 
                  : isPixPrepaid 
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                    : 'bg-yellow-950/60 border-yellow-500/40 text-yellow-300'
              }`}>
                {isCanceled ? 'Renovação Desativada' : isPixPrepaid ? 'Passe Ativo' : 'Assinatura Ativa'}
              </div>
            </div>

            {/* Cartão de Status do Acesso */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 mb-6 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                {isPixPrepaid ? (
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
                    <Calendar className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white font-bold">
                      {isPixPrepaid 
                        ? 'Seu Passe de 30 Dias via PIX' 
                        : isCanceled 
                          ? 'Acesso válido até o término do ciclo' 
                          : 'Assinatura Recorrente no Cartão'}
                    </p>
                    {isPixPrepaid && remainingDays !== null && (
                      <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {remainingDays} {remainingDays === 1 ? 'dia restante' : 'dias restantes'}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    {isPixPrepaid ? (
                      <>
                        Válido até <strong>{getFormattedExpiration()}</strong>. Este passe não possui cobranças automáticas e encerrará sozinho ao término do prazo.
                      </>
                    ) : isCanceled ? (
                      <>
                        Você continuará com acesso VIP completo até <strong>{getFormattedExpiration()}</strong>. Nenhuma nova cobrança será realizada.
                      </>
                    ) : (
                      <>
                        Sua assinatura é renovada automaticamente todo mês no cartão. Você pode desativar a qualquer momento abaixo.
                      </>
                    )}
                  </p>

                  {/* Ação rápida para quem está no PIX (adicionar +30 dias) */}
                  {isPixPrepaid && (
                    <button
                      id="btn-renew-pix-30days"
                      onClick={handleGeneratePix}
                      disabled={loadingPix}
                      className="mt-3.5 w-full py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Renovar ou Adicionar +30 Dias via PIX</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
              Seus Benefícios VIP Desbloqueados
            </h4>
            <div className="space-y-2.5 mb-6">
              {vipBenefits.map((benefit, i) => (
                <div key={i} className="flex gap-3.5 items-center bg-white/5 p-3.5 rounded-2xl border border-white/10">
                  <div className="bg-yellow-500/20 p-2 rounded-xl text-yellow-400">
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-white">{benefit.title}</p>
                    <p className="text-[11px] text-gray-300 mt-0.5 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão de Cancelar Assinatura (Apenas para quem paga via Cartão e está ativo) */}
            {!isPixPrepaid && !isCanceled && (
              <button 
                id="btn-open-cancel-subscription"
                onClick={() => setShowCancelModal(true)}
                className="w-full bg-white/5 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 py-3.5 rounded-2xl text-xs font-bold transition-all flex justify-center items-center gap-2 border border-white/10 hover:border-rose-800/40 active:scale-98"
              >
                <span>Desativar Renovação Automática do Cartão</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal de Cancelamento */}
        {showCancelModal && (
          <div 
            id="cancel-modal-overlay"
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div 
              id="cancel-modal-card"
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center text-white animate-in zoom-in-95 duration-200"
            >
              <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-white text-lg mb-2">Desativar Renovação Automática?</h3>
              <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                Você não será cobrado no próximo ciclo e <strong>manterá seu acesso VIP até o final do período já pago</strong> ({getFormattedExpiration()}).
              </p>
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  id="btn-confirm-cancel-subscription"
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {canceling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Sim, desativar renovação"
                  )}
                </button>
                <button
                  id="btn-abort-cancel-subscription"
                  onClick={() => setShowCancelModal(false)}
                  disabled={canceling}
                  className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs py-3 px-4 rounded-xl transition-colors"
                >
                  Continuar com Assinatura Ativa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIX Modal */}
        <PixPaymentModal
          isOpen={pixModalOpen}
          onClose={() => setPixModalOpen(false)}
          pixData={pixData}
          loading={loadingPix}
          onSuccess={() => {
            setPixModalOpen(false);
            toast.success("Passe PIX ativado com sucesso!");
          }}
        />
      </div>
    );
  }

  // ================= FREE TIER PROMOTION (DUAL OPTIONS: PIX + RECURRING CARD) =================
  return (
    <div className="p-4 sm:p-5 max-w-2xl mx-auto">
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-yellow-500/30">
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-300 text-xs font-bold uppercase tracking-widest px-3.5 py-1 rounded-full mb-4 border border-yellow-400/30 backdrop-blur-md">
            <Crown className="w-3.5 h-3.5" />
            <span>Florescer Premium VIP</span>
          </div>
          
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Aprofunde sua comunhão com Deus
          </h3>
          <p className="text-xs sm:text-sm text-purple-200/90 mb-6 leading-relaxed">
            Escolha o modelo que preferir: teste por 30 dias via PIX sem renovação automática ou assine no cartão com cancelamento fácil.
          </p>
          
          {/* Benefícios */}
          <div className="space-y-2.5 mb-6">
            {vipBenefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400 shrink-0">
                  {benefit.icon}
                </div>
                <div>
                  <p className="font-bold text-white text-xs sm:text-sm">{benefit.title}</p>
                  <p className="text-[11px] sm:text-xs text-gray-300 mt-0.5 leading-relaxed">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* DUAL PAYMENT OPTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            
            {/* OPÇÃO 1: PIX 30 DIAS (Passe Avulso) */}
            <div 
              id="plan-card-pix-30days"
              className="bg-gradient-to-b from-emerald-950/50 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-400/60 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                    Sem Renovação
                  </span>
                </div>

                <div className="mb-3">
                  <h4 className="text-base font-bold text-white leading-snug">Passe de 30 Dias</h4>
                  <p className="text-xs text-emerald-300/80 mt-0.5">Pagamento único via PIX</p>
                </div>

                <div className="my-3 pt-2 border-t border-emerald-500/20">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">R$ 1,00</span>
                    <span className="text-xs text-gray-400 font-medium">/ 30 dias de acesso</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    Ideal para testar. Encerra automaticamente após 30 dias sem surpresas ou cobranças no cartão.
                  </p>
                </div>
              </div>

              <button
                id="btn-buy-pix-pass"
                onClick={handleGeneratePix}
                disabled={loadingPix}
                className="mt-4 w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70"
              >
                {loadingPix ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Pagar com PIX (R$ 1,00)</span>
                  </>
                )}
              </button>
            </div>

            {/* OPÇÃO 2: CARTÃO RECORRENTE */}
            <div 
              id="plan-card-card-recurring"
              className="bg-gradient-to-b from-purple-950/50 to-slate-900 border border-yellow-500/40 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group hover:border-yellow-400/60 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="p-2 rounded-xl bg-yellow-500/20 text-yellow-400 shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <span className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Recorrente</span>
                  </span>
                </div>

                <div className="mb-3">
                  <h4 className="text-base font-bold text-white leading-snug">Assinatura Mensal</h4>
                  <p className="text-xs text-yellow-300/80 mt-0.5">Renovação automática</p>
                </div>

                <div className="my-3 pt-2 border-t border-yellow-500/20">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">R$ 1,00</span>
                    <span className="text-xs text-gray-400 font-medium">/ mês no cartão</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    Acesso contínuo sem precisar renovar todo mês. Cancele com 1 clique no app a qualquer hora.
                  </p>
                </div>
              </div>

              <button
                id="btn-buy-card-subscription"
                onClick={handleSubscribeCard}
                disabled={loadingCard}
                className="mt-4 w-full py-3 px-4 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-yellow-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-70"
              >
                {loadingCard ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Assinar no Cartão (R$ 1,00)</span>
                  </>
                )}
              </button>
            </div>

          </div>

          <div className="text-center text-[11px] text-gray-400">
            🔒 Pagamentos 100% seguros processados via Mercado Pago com criptografia bancária.
          </div>
        </div>
      </div>

      {/* PIX Modal */}
      <PixPaymentModal
        isOpen={pixModalOpen}
        onClose={() => setPixModalOpen(false)}
        pixData={pixData}
        loading={loadingPix}
        onSuccess={() => {
          setPixModalOpen(false);
          toast.success("Passe PIX de 30 dias ativado com sucesso!");
        }}
      />
    </div>
  );
}
