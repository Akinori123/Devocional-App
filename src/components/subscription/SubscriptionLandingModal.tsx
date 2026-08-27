import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Crown, Sparkles, CheckCircle2, Loader2, BookOpen, Bot, Image as ImageIcon, Heart, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SubscriptionLandingModalProps {
  onSuccessClose?: () => void;
}

export function SubscriptionLandingModal({ onSuccessClose }: SubscriptionLandingModalProps) {
  const { profile } = useAuth();
  const isPremium = profile?.isPremium === true;

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [showDelayedMessage, setShowDelayedMessage] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const hasTriggeredCelebration = useRef(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Escuta de URL (Redirect Handling)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const subParam = urlParams.get('subscription');
    const payParam = urlParams.get('payment');
    const statusParam = urlParams.get('status');
    const preapprovalId = urlParams.get('preapproval_id');
    const collectionStatus = urlParams.get('collection_status');

    const isSuccessOrPending = 
      subParam === 'success' || 
      subParam === 'pending' ||
      payParam === 'success' ||
      payParam === 'pending' ||
      statusParam === 'approved' ||
      collectionStatus === 'approved' ||
      Boolean(preapprovalId);

    if (isSuccessOrPending) {
      setIsOpen(true);
      // If user is already premium, jump straight to celebration
      if (isPremium) {
        setIsProcessing(false);
      }
    }
  }, []);

  // 2. Transição de Processamento -> Celebração quando isPremium se torna true
  useEffect(() => {
    if (!isOpen) return;

    if (isPremium) {
      setIsProcessing(false);

      if (!hasTriggeredCelebration.current) {
        hasTriggeredCelebration.current = true;

        // Dispara chuva de confetes
        try {
          confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.55 },
            colors: ['#EAB308', '#A855F7', '#EC4899', '#3B82F6', '#10B981']
          });
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0 }
            });
            confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 1 }
            });
          }, 350);
        } catch (e) {
          // Ignora se confetti falhar em algum ambiente restrito
        }

        // Inicia contagem regressiva para fechamento suave
        let count = 4;
        setCountdown(count);
        const interval = setInterval(() => {
          count -= 1;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(interval);
            handleCloseModal();
          }
        }, 1000);

        return () => clearInterval(interval);
      }
    } else {
      // Temporizador para caso o webhook demore alguns segundos a mais
      const timeout = setTimeout(() => {
        setShowDelayedMessage(true);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isOpen, isPremium]);

  const handleCloseModal = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    // Limpeza da URL removendo parâmetros de retorno
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
    setIsOpen(false);
    if (onSuccessClose) {
      onSuccessClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="subscription-landing-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      >
        <motion.div
          id="subscription-landing-card"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950 border border-yellow-500/30 rounded-3xl p-6 shadow-2xl text-center overflow-hidden"
        >
          {/* Luz de fundo decorativa */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

          {isProcessing ? (
            /* ESTADO 1: PROCESSANDO / AGUARDANDO CONFIRMAÇÃO DO MERCADO PAGO */
            <div className="relative z-10 py-4 flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-2xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center shadow-lg">
                  <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-slate-950 p-1.5 rounded-full shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <h2 className="text-xl font-black text-white mb-2 tracking-tight">
                Recebemos o seu retorno!
              </h2>
              <p className="text-sm text-purple-200/90 leading-relaxed mb-6">
                Processando a liberação do seu acesso <span className="font-semibold text-yellow-400">Florescer Premium</span>...
              </p>

              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-5 text-left flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping mt-1.5 shrink-0" />
                <p className="text-xs text-gray-300 leading-relaxed">
                  Estamos aguardando a sincronização automática do Mercado Pago com o nosso servidor. Isso costuma levar apenas alguns segundos.
                </p>
              </div>

              {showDelayedMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full mb-4"
                >
                  <p className="text-xs text-purple-300/80 mb-3 leading-relaxed">
                    A confirmação bancária pode demorar até 1 minuto em horários de pico. Você já pode usar o app normalmente enquanto ativamos em segundo plano.
                  </p>
                  <button
                    id="btn-subscription-continue-anyway"
                    onClick={handleCloseModal}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Continuar no App</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            /* ESTADO 2: CELEBRAÇÃO / SUCESSO CONFIRMADO */
            <div className="relative z-10 py-2 flex flex-col items-center">
              <motion.div 
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                className="relative mb-5"
              >
                <div className="w-22 h-22 rounded-3xl bg-gradient-to-tr from-yellow-500 to-amber-300 p-0.5 shadow-xl shadow-yellow-500/20 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                    <Crown className="w-11 h-11 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </motion.div>

              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black text-white mb-1.5 tracking-tight"
              >
                Bem-vindo ao Premium! 🎉
              </motion.h2>

              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xs text-purple-200/90 leading-relaxed mb-5"
              >
                Sua assinatura foi ativada com sucesso. Todos os recursos estão 100% liberados!
              </motion.p>

              {/* Lista de benefícios ativos */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="w-full space-y-2.5 mb-6 text-left"
              >
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="bg-yellow-500/20 text-yellow-400 p-2 rounded-xl">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Teólogo Particular com IA</p>
                    <p className="text-[11px] text-gray-300">Perguntas e explicações bíblicas sem limite</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="bg-purple-500/20 text-purple-300 p-2 rounded-xl">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Jornadas e Capítulos Ilimitados</p>
                    <p className="text-[11px] text-gray-300">Desbloqueio de todos os dias e devocionais</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3">
                  <div className="bg-pink-500/20 text-pink-300 p-2 rounded-xl">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Gerador de Imagens Diário</p>
                    <p className="text-[11px] text-gray-300">Crie artes bíblicas e compartilhe a Palavra</p>
                  </div>
                </div>
              </motion.div>

              <motion.button
                id="btn-subscription-enjoy-now"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                onClick={handleCloseModal}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 hover:from-yellow-400 hover:to-amber-300 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-yellow-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Começar a Aproveitar</span>
                <Sparkles className="w-4 h-4" />
              </motion.button>

              <p className="text-[11px] text-purple-300/60 mt-3">
                Fechando automaticamente em {countdown}s...
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
