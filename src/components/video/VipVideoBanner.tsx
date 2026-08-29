import React from 'react';
import { Video, Crown, ChevronRight, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VipVideoBannerProps {
  onClick: () => void;
  className?: string;
  variant?: 'compact' | 'full';
}

export function VipVideoBanner({ onClick, className, variant = 'full' }: VipVideoBannerProps) {
  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between group active:scale-[0.99]",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5 font-bold text-sm leading-tight">
              <span>Acervo de Vídeos</span>
              <span className="bg-yellow-950/30 text-yellow-100 text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                <Crown className="w-3 h-3 text-amber-200" /> VIP
              </span>
            </div>
            <p className="text-xs text-amber-100 font-medium">Assista a todas as mensagens e ministrações</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-full bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-700 text-white rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group active:scale-[0.99]",
        className
      )}
    >
      {/* Background Decorative Glow */}
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
      <div className="absolute -left-10 -top-10 w-24 h-24 bg-yellow-300/20 rounded-full blur-lg pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <Crown className="w-3.5 h-3.5 text-amber-200" />
              Acervo VIP
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white text-yellow-950 group-hover:scale-110 transition-all shadow-sm">
            <Play className="w-4 h-4 fill-white group-hover:fill-yellow-900 text-white group-hover:text-yellow-900 ml-0.5 transition-colors" />
          </div>
        </div>

        <div>
          <h3 className="font-serif font-bold text-lg leading-tight text-white mb-1">
            Acervo de Palavras em Vídeo
          </h3>
          <p className="text-xs text-amber-50 line-clamp-2 leading-relaxed">
            Mensagens diárias, reflexões bíblicas profundas e conteúdos exclusivos para edificar sua fé.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/15 text-xs font-semibold text-amber-100 group-hover:text-white transition-colors">
          <span>Acessar acervo completo</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}
