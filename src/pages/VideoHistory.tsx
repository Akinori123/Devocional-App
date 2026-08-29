import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VideoItem } from '../types';
import { 
  ArrowLeft, 
  Loader2, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Save, 
  Crown, 
  Search, 
  Heart, 
  Play, 
  Sparkles,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { YouTubeFacade } from '../components/video/YouTubeFacade';
import { useVideoFavorites } from '../services/videoFavoritesService';

interface VideoHistoryProps {
  onBack: () => void;
  onGoToPremium: () => void;
}

type TabType = 'all' | 'open' | 'exclusive' | 'favorites';

const PAGE_SIZE = 10;

export function VideoHistory({ onBack, onGoToPremium }: VideoHistoryProps) {
  const toast = useToast();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  
  const { user, profile } = useAuth();
  const { favoriteVideoIds, toggleFavorite, isFavorite } = useVideoFavorites();
  
  const isAdmin = profile?.isAdmin === true || 
    user?.email === 'dofekrafael@gmail.com' || 
    user?.email === 'sjhonatan916@gmail.com' || 
    user?.email === 'floresceremadoracao@gmail.com';

  const hasAccess = profile?.isPremium || isAdmin;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVideoId, setEditVideoId] = useState('');
  const [editVerseRef, setEditVerseRef] = useState('');
  const [editVerseText, setEditVerseText] = useState('');
  const [editIsExclusive, setEditIsExclusive] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = tabsContainerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !tabsContainerRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasMovedRef.current = true;
      tabsContainerRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 100);
  };

  const handleTabClick = (tab: TabType) => {
    if (hasMovedRef.current) return;
    setCurrentTab(tab);
  };

  const fetchVideos = async () => {
    try {
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedVideos: VideoItem[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedVideos.push({
          id: docSnap.id,
          ...docSnap.data()
        } as VideoItem);
      });
      setVideos(fetchedVideos);
    } catch (error) {
      console.error("Error fetching video history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Filtered list based on Search + Category Tab
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
      const matchesSearch = 
        (video.verseRef || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.verseText || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (currentTab === 'favorites') {
        return favoriteVideoIds.has(video.id);
      }
      if (currentTab === 'exclusive') {
        return isVideoPremium;
      }
      if (currentTab === 'open') {
        return !isVideoPremium;
      }
      return true; // 'all'
    });
  }, [videos, searchQuery, currentTab, favoriteVideoIds]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, currentTab]);

  // Infinite Scroll Trigger via IntersectionObserver
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && visibleCount < filteredVideos.length) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [visibleCount, filteredVideos.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '120px',
      threshold: 0.1,
    });

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [handleObserver]);

  // Paginated slice
  const paginatedVideos = useMemo(() => {
    return filteredVideos.slice(0, visibleCount);
  }, [filteredVideos, visibleCount]);

  const handleEditClick = (video: VideoItem) => {
    setEditingId(video.id);
    setEditVideoId(video.videoId || '');
    setEditVerseRef(video.verseRef || '');
    setEditVerseText(video.verseText || '');
    setEditIsExclusive(video.isPremium ?? video.isExclusive ?? false);
    setConfirmDeleteId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (videoId: string) => {
    try {
      setSavingId(videoId);
      let parsedVideoId = editVideoId.trim();
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = parsedVideoId.match(regExp);
      if (match && match[2].length === 11) {
        parsedVideoId = match[2];
      }

      await updateDoc(doc(db, 'videos', videoId), {
        videoId: parsedVideoId,
        verseRef: editVerseRef,
        verseText: editVerseText,
        isExclusive: editIsExclusive,
        isPremium: editIsExclusive
      });
      
      setEditingId(null);
      toast.success("Vídeo atualizado com sucesso!");
      fetchVideos();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    try {
      setDeletingId(videoId);
      await deleteDoc(doc(db, 'videos', videoId));
      toast.success("Vídeo removido com sucesso!");
      fetchVideos();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-24 transition-colors duration-200 animate-in slide-in-from-right relative overflow-y-auto">
      {/* Natural Scrolling Top Header (Scrolls away with page) */}
      <div className="bg-white dark:bg-slate-900 px-5 pt-8 pb-3 border-b border-gray-100 dark:border-slate-800 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold font-serif text-gray-900 dark:text-white leading-tight">
                Acervo de Palavras
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'mensagem' : 'mensagens em vídeo'}
              </p>
            </div>
          </div>

          {!hasAccess && (
            <button
              onClick={() => setShowPremiumModal(true)}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm hover:opacity-95 transition-opacity"
            >
              <Crown className="w-3.5 h-3.5 text-amber-200" />
              <span>Assinar VIP</span>
            </button>
          )}
        </div>
      </div>

      {/* Sticky Header: Search Bar & Filter Tabs ONLY (Opaque background) */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-900 px-5 py-3 shadow-sm border-b border-gray-100 dark:border-slate-800 flex flex-col gap-2.5 transition-colors duration-200">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por referência ou texto bíblico..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Filter Tabs with Drag-to-Scroll on PC & Horizontal Wheel Scroll */}
        <div 
          ref={tabsContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            if (tabsContainerRef.current && e.deltaY !== 0) {
              tabsContainerRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="flex gap-1.5 p-1 bg-gray-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto scrollbar-hide no-scrollbar cursor-grab active:cursor-grabbing select-none"
        >
          <button
            onClick={() => handleTabClick('all')}
            className={cn(
              "flex-1 min-w-[70px] py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap text-center shrink-0 cursor-pointer",
              currentTab === 'all' 
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => handleTabClick('open')}
            className={cn(
              "flex-1 min-w-[80px] py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap text-center shrink-0 cursor-pointer",
              currentTab === 'open' 
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            Gratuitos
          </button>
          <button
            onClick={() => handleTabClick('exclusive')}
            className={cn(
              "flex-1 min-w-[110px] py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer",
              currentTab === 'exclusive' 
                ? "bg-yellow-500 text-white shadow-sm font-black" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Crown className="w-3.5 h-3.5 text-amber-200" />
            Exclusivos VIP
          </button>
          <button
            onClick={() => handleTabClick('favorites')}
            className={cn(
              "flex-1 min-w-[100px] py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 whitespace-nowrap shrink-0 cursor-pointer",
              currentTab === 'favorites' 
                ? "bg-rose-500 text-white shadow-sm font-bold" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", currentTab === 'favorites' ? "fill-white" : "text-rose-500")} />
            Favoritos ({favoriteVideoIds.size})
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="p-5 flex-1 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-yellow-500" />
            <p className="text-sm font-medium">Carregando acervo de vídeos...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 space-y-3">
            <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-950/40 rounded-full flex items-center justify-center mx-auto text-yellow-600">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Nenhum vídeo encontrado</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
              {searchQuery 
                ? `Não encontramos resultados para "${searchQuery}". Tente outros termos.`
                : currentTab === 'favorites'
                ? "Você ainda não favoritou nenhum vídeo nesta aba."
                : "Nenhum vídeo disponível nesta categoria."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs font-bold text-yellow-600 dark:text-yellow-400 underline pt-1"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {paginatedVideos.map((video) => {
              const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
              const isLocked = isVideoPremium && !hasAccess;
              const favorited = isFavorite(video.id);
              
              return (
                <div 
                  key={video.id} 
                  className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700/80 overflow-hidden group hover:shadow-md transition-all duration-300"
                >
                  {/* YouTube Facade (Instant Render, Lazy Loaded Iframe) */}
                  <div className="aspect-video relative bg-slate-900">
                    <YouTubeFacade 
                      videoId={video.videoId}
                      title={video.verseRef || "Palavra em Vídeo"}
                      isLocked={isLocked}
                      isPremium={isVideoPremium}
                      onLockClick={() => setShowPremiumModal(true)}
                    />
                  </div>

                  {/* Card Content & Details */}
                  <div className="p-4 sm:p-5">
                    {editingId === video.id ? (
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">ID do Vídeo ou Link YouTube</label>
                          <input 
                            type="text" 
                            value={editVideoId}
                            onChange={(e) => setEditVideoId(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Referência (Ex: João 3:16)</label>
                          <input 
                            type="text" 
                            value={editVerseRef}
                            onChange={(e) => setEditVerseRef(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Texto (Opcional)</label>
                          <textarea 
                            value={editVerseText}
                            onChange={(e) => setEditVerseText(e.target.value)}
                            rows={3}
                            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
                          />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer my-1 p-2 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                          <input 
                            type="checkbox" 
                            checked={editIsExclusive}
                            onChange={(e) => setEditIsExclusive(e.target.checked)}
                            className="w-4 h-4 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                          />
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            Conteúdo Premium/VIP
                          </span>
                        </label>

                        <div className="flex justify-end gap-2 mt-2">
                          <button 
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleSaveEdit(video.id)}
                            disabled={savingId === video.id || !editVideoId}
                            className="px-3 py-1.5 text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {savingId === video.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start gap-4">
                          <div 
                            onClick={() => isLocked && setShowPremiumModal(true)}
                            className={cn("flex-1", isLocked && "cursor-pointer")}
                          >
                            {video.verseRef && (
                              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 flex items-center gap-2">
                                {video.verseRef}
                                {isVideoPremium && (
                                  <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Crown className="w-3 h-3" /> VIP
                                  </span>
                                )}
                              </h3>
                            )}
                            {video.verseText && (
                              <p className="text-gray-600 dark:text-gray-300 text-sm italic leading-relaxed">
                                "{video.verseText}"
                              </p>
                            )}
                          </div>

                          {/* Action Buttons (Favorite + Admin options) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Favorite Button */}
                            <button
                              onClick={() => toggleFavorite(video, () => setShowPremiumModal(true))}
                              className={cn(
                                "p-2 rounded-full transition-all active:scale-90",
                                favorited 
                                  ? "text-rose-500 bg-rose-50 dark:bg-rose-950/40" 
                                  : "text-gray-400 hover:text-rose-500 hover:bg-gray-100 dark:hover:bg-slate-700"
                              )}
                              title={favorited ? "Remover dos favoritos" : isVideoPremium && !hasAccess ? "Exclusivo VIP (Florescer Premium)" : "Salvar nos favoritos"}
                              aria-label="Favoritar vídeo"
                            >
                              <Heart className={cn("w-5 h-5 transition-transform", favorited && "fill-rose-500 scale-110")} />
                            </button>

                            {/* Admin Controls */}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEditClick(video)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                  title="Editar vídeo"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                
                                {confirmDeleteId === video.id ? (
                                  <div className="flex items-center bg-red-50 dark:bg-red-900/20 rounded-xl shadow-sm p-1 gap-1 border border-red-100 dark:border-red-800">
                                    <button
                                      onClick={() => handleDelete(video.id)}
                                      disabled={deletingId === video.id}
                                      className="p-1 text-red-600 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50"
                                      title="Confirmar exclusão"
                                    >
                                      {deletingId === video.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      disabled={deletingId === video.id}
                                      className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteId(video.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Excluir vídeo"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        
                        {video.createdAt && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3 font-medium uppercase tracking-wider">
                            {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Intersection Observer Anchor for Infinite Scroll */}
            <div ref={observerTarget} className="py-2 flex justify-center items-center">
              {visibleCount < filteredVideos.length && (
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                  <span>Carregando mais vídeos...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Premium Lock Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Crown className="w-7 h-7 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Acervo Exclusivo VIP</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm leading-relaxed">
                Desbloqueie todas as ministrações, reflexões bíblicas e mensagens exclusivas com o Florescer Premium.
              </p>
              
              <div className="w-full bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 mb-6">
                <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                  R$ 29,90 <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ mês</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Acesso ilimitado. Cancele quando quiser.</p>
              </div>

              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  if (onGoToPremium) onGoToPremium();
                }}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md active:scale-95"
              >
                Conhecer o Florescer Premium
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
