import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, Copy, Check, Sparkles, Loader2, X, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface PixPaymentData {
  id: string | number;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
  amount?: number;
}

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: PixPaymentData | null;
  loading: boolean;
  onSuccess: () => void;
}

export function PixPaymentModal({
  isOpen,
  onClose,
  pixData,
  loading,
  onSuccess
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-polling para verificar se o pagamento foi concluído
  useEffect(() => {
    if (!isOpen || !pixData?.id || isApproved) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        setIsChecking(true);
        const res = await fetch(`/api/payment/status/${pixData.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isApproved || data.status === 'approved') {
            setIsApproved(true);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            
            // Dispara confetes de vitória
            try {
              confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
              });
            } catch (e) {
              // Ignore
            }

            setTimeout(() => {
              onSuccess();
            }, 2500);
          }
        }
      } catch (err) {
        console.warn("Polling error:", err);
      } finally {
        setIsChecking(false);
      }
    };

    // Polling a cada 3 segundos
    pollIntervalRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, pixData?.id, isApproved, onSuccess]);

  // Reset states ao abrir
  useEffect(() => {
    if (isOpen) {
      setIsApproved(false);
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!pixData?.qrCode) return;
    navigator.clipboard.writeText(pixData.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="pix-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          id="pix-modal-content"
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl text-white overflow-hidden max-h-[92vh] flex flex-col"
        >
          {/* Luz de fundo */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Botão fechar */}
          <button
            id="btn-close-pix-modal"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {isApproved ? (
            /* SUCESSO APROVADO */
            <div className="py-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/20 animate-bounce">
                <Check className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">PIX Confirmado! 🎉</h3>
              <p className="text-sm text-emerald-200/90 leading-relaxed mb-6 max-w-xs">
                Seu <strong>Passe VIP de 30 Dias</strong> foi ativado com sucesso. Aproveite todos os recursos ilimitados!
              </p>
              <div className="inline-flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-2 rounded-xl">
                <Sparkles className="w-4 h-4" />
                <span>Atualizando seu aplicativo...</span>
              </div>
            </div>
          ) : loading ? (
            /* CARREGANDO GERAÇÃO */
            <div className="py-12 flex flex-col items-center text-center">
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">Gerando seu QR Code PIX...</h3>
              <p className="text-xs text-gray-400">Conectando ao Mercado Pago</p>
            </div>
          ) : (
            /* CONTEÚDO PRINCIPAL DO PIX */
            <div className="overflow-y-auto pr-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 mb-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Passe Avulso de 30 Dias</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Pagamento via PIX</h3>
                </div>
              </div>

              {/* Informações de Valor e Não-Recorrência */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 mb-4 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-gray-300">Valor único:</span>
                  <span className="text-base font-black text-emerald-400">R$ {pixData?.amount?.toFixed(2) || "1,00"}</span>
                </div>
                <div className="flex items-start gap-1.5 text-emerald-200/80 text-[11px] leading-relaxed">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Sem assinatura nem renovação automática. Seu acesso VIP encerra sozinho após 30 dias.</span>
                </div>
              </div>

              {/* Imagem do QR Code se disponível */}
              {pixData?.qrCodeBase64 && (
                <div className="flex flex-col items-center justify-center bg-white p-4 rounded-2xl mb-4 border border-gray-200 shadow-inner">
                  <img 
                    src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                    alt="QR Code PIX Florescer" 
                    className="w-48 h-48 object-contain"
                  />
                  <p className="text-[11px] font-medium text-gray-500 mt-2">
                    Abra o app do seu banco e aponte a câmera
                  </p>
                </div>
              )}

              {/* Código Copia e Cola */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Ou pague pelo Pix Copia e Cola:
                </label>
                <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-2xl p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={pixData?.qrCode || ''}
                    className="bg-transparent text-xs text-gray-300 font-mono flex-1 outline-none truncate"
                  />
                  <button
                    id="btn-copy-pix-code"
                    onClick={handleCopy}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      copied 
                        ? 'bg-emerald-500 text-slate-950' 
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 active:scale-95'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Passo a Passo */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-4 text-xs space-y-1.5 text-gray-300">
                <p className="font-semibold text-white text-[11px] uppercase tracking-wider mb-1">Como pagar:</p>
                <p>1. Abra o aplicativo do seu banco</p>
                <p>2. Escolha <strong>PIX</strong> &gt; <strong>Pix Copia e Cola</strong> ou <strong>Ler QR Code</strong></p>
                <p>3. Cole o código ou aponte a câmera e confirme</p>
              </div>

              {/* Status de espera em tempo real */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-1">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span>Aguardando pagamento... liberação imediata ao pagar</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
