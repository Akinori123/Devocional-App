import React, { useState, useEffect } from 'react';
import { Play, Crown, Lock, Film } from 'lucide-react';
import { cn } from '../../lib/utils';

interface YouTubeFacadeProps {
  videoId: string;
  title?: string;
  isLocked?: boolean;
  isPremium?: boolean;
  onLockClick?: () => void;
  className?: string;
  autoPlay?: boolean;
}

export function YouTubeFacade({
  videoId,
  title = 'Vídeo',
  isLocked = false,
  isPremium = false,
  onLockClick,
  className,
  autoPlay = true,
}: YouTubeFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  // fallbackStage:
  // 0: maxresdefault.jpg (Alta Resolução HD)
  // 1: hqdefault.jpg (Média / Alta Resolução)
  // 2: mqdefault.jpg (Média Resolução)
  // 3: /images/video-placeholder.jpg (Imagem local genérica)
  // 4: /video-placeholder.jpg (Fallback raiz)
  // 5: Fallback de renderização interna (gradiente com ícone)
  const [fallbackStage, setFallbackStage] = useState<number>(0);

  const cleanVideoId = (videoId || '').trim();

  // Reinicia o fallback caso o videoId mude
  useEffect(() => {
    setFallbackStage(0);
    setIsPlaying(false);
  }, [cleanVideoId]);

  // Calcula o src atual da thumbnail baseado no estágio de fallback
  const getThumbnailSrc = () => {
    if (!cleanVideoId) return '/images/video-placeholder.jpg';
    switch (fallbackStage) {
      case 0:
        return `https://img.youtube.com/vi/${cleanVideoId}/maxresdefault.jpg`;
      case 1:
        return `https://img.youtube.com/vi/${cleanVideoId}/hqdefault.jpg`;
      case 2:
        return `https://img.youtube.com/vi/${cleanVideoId}/mqdefault.jpg`;
      case 3:
        return '/images/video-placeholder.jpg';
      case 4:
        return '/video-placeholder.jpg';
      default:
        return '/images/video-placeholder.jpg';
    }
  };

  const handleImageError = () => {
    setFallbackStage((prev) => prev + 1);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    // YouTube costuma retornar uma imagem cinza de 120x90 quando a thumbnail maxres não existe
    if (fallbackStage < 2 && img.naturalWidth === 120 && img.naturalHeight === 90) {
      setFallbackStage((prev) => prev + 1);
    }
  };

  const thumbUrl = getThumbnailSrc();

  if (isLocked) {
    return (
      <div 
        className={cn("w-full h-full relative aspect-video bg-slate-900 rounded-2xl overflow-hidden cursor-pointer group select-none", className)}
        onClick={onLockClick}
      >
        {fallbackStage <= 4 ? (
          <img 
            src={thumbUrl}
            key={thumbUrl}
            onError={handleImageError}
            onLoad={handleImageLoad}
            alt={title} 
            loading="lazy"
            className="w-full h-full object-cover opacity-40 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-950 flex items-center justify-center opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-center text-white p-4 text-center backdrop-blur-[1.5px]">
          <div className="w-13 h-13 bg-yellow-500/90 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-yellow-500/20 group-hover:scale-110 transition-transform">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-base mb-1 flex items-center gap-1.5 drop-shadow-sm">
            <Crown className="w-4 h-4 text-amber-300" />
            <span>Vídeo Exclusivo VIP</span>
          </h3>
          <p className="text-xs text-yellow-200 font-medium">Toque para desbloquear com Florescer Premium</p>
        </div>
      </div>
    );
  }

  if (isPlaying) {
    return (
      <div className={cn("w-full h-full relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner", className)}>
        <iframe 
          className="w-full h-full absolute inset-0"
          src={`https://www.youtube.com/embed/${cleanVideoId}?autoplay=${autoPlay ? 1 : 0}&rel=0&modestbranding=1`} 
          title={title} 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
          referrerPolicy="strict-origin-when-cross-origin" 
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "w-full h-full relative aspect-video bg-slate-900 rounded-2xl overflow-hidden cursor-pointer group select-none shadow-sm transition-all duration-300 hover:shadow-md", 
        className
      )}
      onClick={() => setIsPlaying(true)}
      role="button"
      tabIndex={0}
      aria-label={`Reproduzir ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsPlaying(true);
        }
      }}
    >
      {fallbackStage <= 4 ? (
        <img 
          src={thumbUrl}
          key={thumbUrl}
          onError={handleImageError}
          onLoad={handleImageLoad}
          alt={title} 
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-yellow-950/30 to-slate-950 flex flex-col items-center justify-center p-4">
          <Film className="w-10 h-10 text-yellow-500/60 mb-2" />
          <span className="text-xs text-yellow-200/80 font-medium line-clamp-1">{title}</span>
        </div>
      )}
      
      {/* Subtle overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 group-hover:from-black/70 transition-colors" />

      {/* Play Button Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 rounded-full flex items-center justify-center shadow-xl shadow-black/40 transform group-hover:scale-110 transition-all duration-300">
          <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-yellow-950 ml-1 text-yellow-950" />
        </div>
      </div>

      {/* VIP Badge */}
      {isPremium && (
        <div className="absolute top-2.5 right-2.5 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
          <Crown className="w-3.5 h-3.5" />
          <span>VIP</span>
        </div>
      )}

      {/* Quick Play Hint */}
      <div className="absolute bottom-2.5 left-3 text-[11px] font-medium text-white/90 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-sm">
        Toque para assistir
      </div>
    </div>
  );
}
