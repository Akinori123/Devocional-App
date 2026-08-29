import { Video, Heart, Trash2, Crown, Lock } from 'lucide-react';
import { useVideoFavorites } from '../../services/videoFavoritesService';
import { YouTubeFacade } from '../video/YouTubeFacade';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

interface FavoriteVideosTabProps {
  onGoToPremium?: () => void;
  onExploreVideos?: () => void;
}

export function FavoriteVideosTab({ onGoToPremium, onExploreVideos }: FavoriteVideosTabProps) {
  const { favoriteVideos, loadingFavorites, toggleFavorite } = useVideoFavorites();
  const { profile, user } = useAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;

  if (loadingFavorites) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <div className="w-8 h-8 border-3 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Carregando seus vídeos favoritos...</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          Vídeos Favoritos ({favoriteVideos.length})
        </h3>
        {favoriteVideos.length > 0 && onExploreVideos && (
          <button 
            onClick={onExploreVideos}
            className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 hover:underline"
          >
            Ver Acervo Completo
          </button>
        )}
      </div>

      {favoriteVideos.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-100 dark:border-slate-700 text-center space-y-3">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto text-rose-500">
            <Heart className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-gray-900 dark:text-white text-base">Nenhum vídeo favoritado ainda</h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
            Toque no ícone de coração nos vídeos do Acervo para guardar suas mensagens e palavras preferidas aqui.
          </p>
          {onExploreVideos && (
            <button
              onClick={onExploreVideos}
              className="mt-2 inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Video className="w-4 h-4" />
              Explorar Acervo de Vídeos
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {favoriteVideos.map((video) => {
            const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
            const isLocked = isVideoPremium && !hasAccess;

            return (
              <div 
                key={video.id} 
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden group transition-all"
              >
                <div className="aspect-video relative bg-slate-900">
                  <YouTubeFacade 
                    videoId={video.videoId}
                    title={video.verseRef || "Vídeo Favorito"}
                    isLocked={isLocked}
                    isPremium={isVideoPremium}
                    onLockClick={() => setShowPremiumModal(true)}
                  />
                </div>

                <div className="p-4 flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {video.verseRef && (
                      <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1 flex items-center gap-2">
                        {video.verseRef}
                        {isVideoPremium && (
                          <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3" /> VIP
                          </span>
                        )}
                      </h4>
                    )}
                    {video.verseText && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm italic line-clamp-2">
                        "{video.verseText}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => toggleFavorite(video)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors shrink-0"
                    title="Remover dos favoritos"
                    aria-label="Remover dos favoritos"
                  >
                    <Heart className="w-5 h-5 fill-rose-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Premium if locked video clicked */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conteúdo Exclusivo VIP</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                Assine o Florescer Premium para desbloquear este e todos os outros vídeos exclusivos.
              </p>
              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  if (onGoToPremium) onGoToPremium();
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Conhecer Florescer Premium
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
