import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VideoItem } from '../types';
import { ArrowLeft, Loader2, Edit2, Trash2, X, Check, Save, Crown, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';

interface VideoHistoryProps {
  onBack: () => void;
  onGoToPremium: () => void;
}

type TabType = 'open' | 'exclusive';

export function VideoHistory({ onBack, onGoToPremium }: VideoHistoryProps) {
  const toast = useToast();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>('open');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { user, profile } = useAuth();
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVideoId, setEditVideoId] = useState('');
  const [editVerseRef, setEditVerseRef] = useState('');
  const [editVerseText, setEditVerseText] = useState('');
  const [editIsExclusive, setEditIsExclusive] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedVideos: VideoItem[] = [];
      querySnapshot.forEach((doc) => {
        fetchedVideos.push(doc.data() as VideoItem);
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
      fetchVideos();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const filteredVideos = videos.filter(video => {
    const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
    return currentTab === 'exclusive' ? isVideoPremium : !isVideoPremium;
  });

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-20 transition-colors duration-200 animate-in slide-in-from-right relative">
      <div className="bg-white dark:bg-slate-900 sticky top-0 z-10 px-5 pt-12 pb-4 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold font-serif text-gray-900 dark:text-white">Acervo de Palavras</h1>
        </div>
        
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setCurrentTab('open')}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg transition-all",
              currentTab === 'open' 
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            Gratuitos
          </button>
          <button
            onClick={() => setCurrentTab('exclusive')}
            className={cn(
              "flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5",
              currentTab === 'exclusive' 
                ? "bg-yellow-500 text-white shadow-sm font-bold" 
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            <Crown className="w-4 h-4 text-amber-200" />
            Exclusivos VIP
          </button>
        </div>
      </div>

      <div className="p-5 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-yellow-500" />
            <p>Carregando histórico...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">Nenhum vídeo encontrado nesta categoria.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {filteredVideos.map((video) => {
              const hasAccess = profile?.isPremium || isAdmin;
              const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
              const isLocked = isVideoPremium && !hasAccess;
              
              return (
              <div key={video.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden group">
                <div className="aspect-video relative bg-gray-100 dark:bg-slate-700">
                  {/* VIP Badge on top right if video is VIP and user has access */}
                  {isVideoPremium && !isLocked && (
                    <div className="absolute top-2 right-2 z-10 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                      <Crown className="w-3.5 h-3.5" />
                      <span>VIP</span>
                    </div>
                  )}

                  {isLocked ? (
                    <div 
                      className="w-full h-full absolute inset-0 cursor-pointer group/lock"
                      onClick={() => setShowPremiumModal(true)}
                    >
                      <img 
                        src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`} 
                        alt="Miniatura do Vídeo" 
                        className="w-full h-full object-cover opacity-50 transition-opacity group-hover/lock:opacity-40"
                      />
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-4 text-center backdrop-blur-[2px]">
                        <div className="w-12 h-12 bg-yellow-500/90 rounded-full flex items-center justify-center mb-3 shadow-lg group-hover/lock:scale-110 transition-transform">
                          <Lock className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-bold text-base mb-1 flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-amber-300" />
                          <span>Vídeo Exclusivo VIP</span>
                        </h3>
                        <p className="text-xs text-yellow-200 font-medium">Assine o Premium para assistir</p>
                      </div>
                    </div>
                  ) : (
                    <iframe 
                      className="w-full h-full absolute inset-0"
                      src={`https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`} 
                      title="Palavra em Vídeo" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      referrerPolicy="strict-origin-when-cross-origin" 
                      allowFullScreen>
                    </iframe>
                  )}
                </div>
                <div className="p-4">
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
                          className={cn(isLocked && "cursor-pointer")}
                        >
                          {video.verseRef && (
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 flex items-center gap-2">
                              {video.verseRef}
                              {isVideoPremium && (
                                <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Crown className="w-3 h-3" /> VIP
                                </span>
                              )}
                            </h3>
                          )}
                          {video.verseText && (
                            <p className="text-gray-600 dark:text-gray-300 text-sm italic">"{video.verseText}"</p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleEditClick(video)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                              title="Editar vídeo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            
                            {confirmDeleteId === video.id ? (
                              <div className="flex items-center bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm p-1 gap-1 border border-red-100 dark:border-red-800">
                                <button
                                  onClick={() => handleDelete(video.id)}
                                  disabled={deletingId === video.id}
                                  className="p-1 text-red-600 hover:bg-red-200 dark:hover:bg-red-800 rounded transition-colors disabled:opacity-50"
                                  title="Confirmar exclusão"
                                >
                                  {deletingId === video.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={deletingId === video.id}
                                  className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(video.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                title="Excluir vídeo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {video.createdAt && (
                        <p className="text-xs text-gray-400 mt-3 font-medium uppercase tracking-wider">
                          {new Date(video.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Premium Lock Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conteúdo Exclusivo VIP</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                Os vídeos da área Exclusivos VIP são reservados para assinantes do Florescer Premium.
              </p>
              
              <div className="w-full bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 mb-6">
                <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">R$ 29,90 <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ mês</span></div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cancele quando quiser, direto pelo aplicativo.</p>
              </div>

              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  if (onGoToPremium) onGoToPremium();
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
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
