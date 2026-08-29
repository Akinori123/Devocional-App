import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { VideoItem } from '../types';
import { useToast } from '../context/ToastContext';

export function useVideoFavorites() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [favoriteVideoIds, setFavoriteVideoIds] = useState<Set<string>>(new Set());
  const [favoriteVideos, setFavoriteVideos] = useState<VideoItem[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  const isAdmin = profile?.isAdmin === true || 
    user?.email === 'dofekrafael@gmail.com' || 
    user?.email === 'sjhonatan916@gmail.com' || 
    user?.email === 'floresceremadoracao@gmail.com';

  const hasAccess = profile?.isPremium || isAdmin;

  useEffect(() => {
    if (!user) {
      setFavoriteVideoIds(new Set());
      setFavoriteVideos([]);
      setLoadingFavorites(false);
      return;
    }

    const favRef = collection(db, 'users', user.uid, 'favoriteVideos');
    const unsubscribe = onSnapshot(favRef, (snapshot) => {
      const ids = new Set<string>();
      const videos: VideoItem[] = [];
      snapshot.forEach((d) => {
        ids.add(d.id);
        videos.push({
          id: d.id,
          ...d.data()
        } as VideoItem);
      });
      setFavoriteVideoIds(ids);
      setFavoriteVideos(videos);
      setLoadingFavorites(false);
    }, (error) => {
      console.error("Error loading favorite videos:", error);
      setLoadingFavorites(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleFavorite = async (video: VideoItem, onRequirePremium?: () => void) => {
    if (!user) {
      toast.info("Faça login para salvar seus vídeos favoritos.");
      return;
    }

    const isVideoPremium = video.isPremium ?? video.isExclusive ?? false;
    const isFav = favoriteVideoIds.has(video.id);

    // Se o vídeo for VIP e o usuário não for Premium nem Admin, bloquear a ação de favoritar
    if (!isFav && isVideoPremium && !hasAccess) {
      toast.info("Vídeos VIP só podem ser favoritados por assinantes Florescer Premium.");
      if (onRequirePremium) {
        onRequirePremium();
      }
      return;
    }

    const favDocRef = doc(db, 'users', user.uid, 'favoriteVideos', video.id);

    try {
      if (isFav) {
        await deleteDoc(favDocRef);
        toast.info("Vídeo removido dos favoritos.");
      } else {
        await setDoc(favDocRef, {
          id: video.id,
          videoId: video.videoId,
          verseRef: video.verseRef || '',
          verseText: video.verseText || '',
          isExclusive: isVideoPremium,
          isPremium: isVideoPremium,
          createdAt: video.createdAt || new Date().toISOString(),
          favoritedAt: serverTimestamp()
        });
        toast.success("Vídeo salvo nos favoritos! ❤️");
      }
    } catch (error: any) {
      console.error("Error toggling favorite video:", error);
      toast.error("Não foi possível atualizar o favorito.");
    }
  };

  const isFavorite = (videoId: string) => favoriteVideoIds.has(videoId);

  return {
    favoriteVideoIds,
    favoriteVideos,
    loadingFavorites,
    toggleFavorite,
    isFavorite,
    hasAccess
  };
}
