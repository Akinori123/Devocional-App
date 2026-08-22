import { useState } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, X, Crown, Image as ImageIcon, Headphones, Video, Calendar, CreditCard, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function SubscriptionTab() {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const isPremium = profile?.isPremium;
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  
  const isCanceled = profile?.cancelAtPeriodEnd === true || profile?.subscriptionStatus === 'canceled';
  
  // Calculate an approximate expiration date if none is provided, or just show text
  // Ideally, your backend would save currentPeriodEnd timestamp from MP. 
  // For now we show a friendly text if date is unknown.
  const expirationText = "o final do seu ciclo de faturamento";

  const vipBenefits = [
    { 
      icon: <ImageIcon className="w-6 h-6 text-rose-300" />, 
      title: 'Imagens de IA', 
      desc: 'Gere fotos exclusivas e personalizadas para suas reflexões.' 
    },
    { 
      icon: <Headphones className="w-6 h-6 text-rose-300" />, 
      title: 'Áudios da Bíblia', 
      desc: 'Ouça capítulos narrados automaticamente onde estiver.' 
    },
    { 
      icon: <Video className="w-6 h-6 text-rose-300" />, 
      title: 'Vídeos Restritos', 
      desc: 'Acesso a mensagens e devocionais em vídeo exclusivos.' 
    }
  ];

  if (isAdmin) {
    return (
      <div className="p-5">
        <div className="bg-gradient-to-br from-purple-950 via-purple-900 to-purple-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-purple-800/50 shadow-purple-900/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-400 opacity-20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
          
          <div className="relative z-10 text-center">
            <div className="flex flex-col items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-purple-400/20 to-purple-600/20 p-5 rounded-3xl border border-purple-400/30 shadow-inner backdrop-blur-md mb-2">
                <ShieldCheck className="w-10 h-10 text-purple-200" />
              </div>
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-purple-400/30 shadow-inner backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Nível Administrador</span>
              </div>
              <h3 className="text-3xl font-bold font-serif text-white tracking-wide mt-2">Acesso Total</h3>
            </div>
            
            <div className="bg-purple-900/30 rounded-2xl p-6 mb-6 border border-purple-700/30 backdrop-blur-md shadow-inner text-left">
              <div className="flex items-start gap-4">
                <Crown className="w-6 h-6 text-purple-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-base text-white font-semibold">Conta Administrativa Blindada</p>
                  <p className="text-sm text-purple-200/80 mt-1.5 leading-relaxed">
                    Você possui todos os benefícios Premium VIP liberados permanentemente. Imagens de IA, Áudios, Vídeos e gerenciamento de plataforma.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3 mb-2 text-left">
              {vipBenefits.map((benefit, i) => (
                <div key={i} className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <div className="bg-purple-800/40 p-2.5 rounded-xl border border-purple-700/30 shadow-inner text-purple-300">
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{benefit.title}</p>
                    <p className="text-xs text-purple-200/80 mt-0.5 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubscribe = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para assinar.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.uid, userEmail: user.email })
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
      toast.error("Houve um erro ao processar sua assinatura. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

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
      toast.success("Sua assinatura foi cancelada com sucesso. Você tem acesso até o fim do ciclo!");
      setShowCancelModal(false);
      // It will auto-refresh if they have a real-time listener on the profile in AuthContext
      setTimeout(() => {
         window.location.reload();
      }, 1500);
    } catch (error) {
      console.error(error);
      toast.error("Houve um erro ao cancelar sua assinatura. Pode ser que ela já esteja cancelada ou ocorra um erro de rede.");
    } finally {
      setCanceling(false);
    }
  };

  if (isPremium) {
    return (
      <div className="p-5">
        <div className="bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-rose-800/50 shadow-rose-900/20">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-400 opacity-20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-rose-400/20 to-rose-600/20 p-3 rounded-2xl border border-rose-400/30 shadow-inner backdrop-blur-md">
                  <Crown className="w-6 h-6 text-rose-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold font-serif text-white tracking-wide">Área VIP</h3>
                  <p className="text-rose-200/90 text-sm font-medium tracking-wider uppercase mt-0.5">Florescer Premium</p>
                </div>
              </div>
              
              <div className={`px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-sm ${isCanceled ? 'bg-orange-950/40 border-orange-500/30 text-orange-300' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'}`}>
                {isCanceled ? 'Cancelado' : 'Ativo'}
              </div>
            </div>

            <div className="bg-rose-900/30 rounded-2xl p-5 mb-8 border border-rose-700/30 backdrop-blur-md shadow-inner">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <p className="text-base text-white font-semibold">Sua assinatura VIP está {isCanceled ? 'cancelada' : 'ativa'}</p>
                  <p className="text-sm text-rose-200/80 mt-1.5 leading-relaxed">
                    {isCanceled 
                      ? `Você continuará com acesso VIP até ${expirationText}. Após essa data, sua conta voltará para o plano gratuito.`
                      : `Sua assinatura é renovada automaticamente. Próxima cobrança no final do ciclo.`}
                  </p>
                </div>
              </div>
            </div>

            <h4 className="text-xs font-bold text-rose-200/60 uppercase tracking-widest mb-5 ml-1">Benefícios Destravados</h4>
            <div className="space-y-3 mb-6">
              {vipBenefits.map((benefit, i) => (
                <div key={i} className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-sm">
                  <div className="bg-rose-800/40 p-2.5 rounded-xl border border-rose-700/30 shadow-inner text-rose-300">
                    {benefit.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{benefit.title}</p>
                    <p className="text-xs text-rose-200/80 mt-0.5 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {!isCanceled && (
              <button 
                onClick={() => setShowCancelModal(true)}
                className="w-full bg-rose-950/40 text-rose-300 py-4 rounded-2xl font-bold shadow-sm hover:bg-rose-900/60 hover:text-rose-200 active:scale-95 transition-all flex justify-center items-center gap-2 border border-rose-800/50 backdrop-blur-md mt-4 hover:border-rose-700/50"
              >
                Cancelar Assinatura
              </button>
            )}
          </div>
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-2">Desativar Renovação?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Tem certeza que deseja cancelar? Você manterá seus benefícios VIP até o fim do ciclo atual, mas não haverá novas cobranças.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={canceling}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {canceling ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Sim, quero cancelar"
                    )}
                  </button>
                  <button
                    onClick={() => setShowCancelModal(false)}
                    disabled={canceling}
                    className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-50 text-gray-900 dark:text-white font-bold py-3.5 px-4 rounded-xl transition-colors"
                  >
                    Não, manter assinatura
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Free Tier Promotiom
  return (
    <div className="p-5">
      <div className="bg-gradient-to-br from-rose-950 via-rose-900 to-rose-950 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden border border-rose-800/50 shadow-rose-900/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-400 opacity-10 rounded-full -ml-8 -mb-8 blur-xl"></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-rose-500/20 to-orange-500/20 text-rose-200 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 border border-rose-400/30 shadow-inner backdrop-blur-md">
            <Crown className="w-3.5 h-3.5" />
            <span>VIP / Premium</span>
          </div>
          
          <h3 className="text-3xl font-bold font-serif mb-3 tracking-wide">Aprofunde sua jornada</h3>
          <p className="text-rose-200/90 text-sm mb-6 leading-relaxed">
            Desbloqueie todo o potencial do Florescer. Tenha ferramentas exclusivas para o seu momento com Deus.
          </p>
          
          <div className="space-y-3 mb-6">
            {vipBenefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-4 text-sm bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                <CheckCircle2 className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-base">{benefit.title}</p>
                  <p className="text-sm text-rose-200/80 mt-1">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-8 text-center bg-black/20 rounded-3xl p-6 border border-white/10 backdrop-blur-md shadow-inner">
            <div className="text-4xl font-black text-white mb-1 tracking-tight">R$ 29,90 <span className="text-lg font-normal text-rose-300">/ mês</span></div>
            <p className="text-sm text-rose-200/60 uppercase tracking-widest font-medium mt-2">Cancele quando quiser, sem burocracia.</p>
          </div>

          <button 
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full bg-white text-rose-950 py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
            {loading ? "Processando..." : "Assinar via Mercado Pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
