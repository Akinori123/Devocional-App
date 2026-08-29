import { User, Crown, LogOut, Flame, Camera, Loader2, Coins } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRef, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { CoinHistoryModal } from '../gamification/CoinHistoryModal';
import { CoinIcon } from '../common/CoinIcon';

export function ProfileHeader() {
  const toast = useToast();
  const { user, profile, logout } = useAuth();
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';

  const userName = profile?.name || 'Irmã(o)';
  const streakCount = profile?.streakCount || 0;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCoinHistory, setShowCoinHistory] = useState(false);

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const MAX_HEIGHT = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64String = canvas.toDataURL('image/jpeg', 0.7);
          
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            photoURL: base64String
          });
          setIsUploading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao atualizar foto.');
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-yellow-400 dark:bg-slate-900 px-4 sm:px-5 pt-8 sm:pt-10 pb-5 sm:pb-6 rounded-b-3xl text-yellow-950 dark:text-white shadow-sm shrink-0 transition-colors duration-200 border-b border-yellow-500/20 dark:border-slate-800">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="relative shrink-0">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-yellow-900/10 dark:bg-slate-800 rounded-full flex items-center justify-center backdrop-blur-sm border-2 sm:border-4 border-yellow-900/20 dark:border-slate-700 overflow-hidden shadow-sm">
            {isUploading ? (
              <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-950 dark:text-white animate-spin" />
            ) : profile?.photoURL ? (
              <img src={profile.photoURL} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-950/70 dark:text-yellow-400" />
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-0 right-0 sm:bottom-1 sm:right-1 bg-white dark:bg-slate-700 text-yellow-500 dark:text-yellow-400 p-1.5 sm:p-2 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors z-10 border border-gray-100 dark:border-slate-600"
            title="Trocar Foto"
          >
            <Camera className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            accept="image/*"
            className="hidden"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold font-serif mb-1 line-clamp-1 text-yellow-950 dark:text-white">{userName}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {isAdmin ? (
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap shrink-0">
                <Crown className="w-3 h-3" />
                <span>ADMIN</span>
              </div>
            ) : profile?.isPremium ? (
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-950 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap shrink-0">
                <Crown className="w-3 h-3" />
                <span>PREMIUM</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 bg-yellow-900/10 dark:bg-slate-800 text-yellow-950 dark:text-gray-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap shrink-0 border border-yellow-900/5 dark:border-slate-700">
                <User className="w-3 h-3" />
                <span>PLANO GRATUITO</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1 bg-yellow-900/10 dark:bg-slate-800 text-yellow-950 dark:text-gray-200 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap shrink-0 border border-yellow-900/5 dark:border-slate-700">
              <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
              <span>{streakCount} Dias</span>
            </div>
            <button 
              onClick={() => setShowCoinHistory(true)}
              className="inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap shrink-0 border border-amber-500/30 transition-colors active:scale-95 cursor-pointer"
              title="Ver Extrato de Moedas"
            >
              <CoinIcon className="w-3.5 h-3.5" />
              <span>{profile?.coins || 0} Moedas</span>
            </button>
          </div>
        </div>
        <button 
          onClick={logout}
          className="p-2 sm:p-2.5 bg-yellow-900/10 dark:bg-slate-800 hover:bg-yellow-900/20 dark:hover:bg-slate-700 text-yellow-950 dark:text-gray-200 border border-yellow-900/5 dark:border-slate-700 rounded-full transition-colors shrink-0 flex-shrink-0 ml-1"
          title="Sair"
        >
          <LogOut className="w-4 h-4 text-yellow-950 dark:text-gray-200" />
        </button>
      </div>

      <CoinHistoryModal 
        isOpen={showCoinHistory} 
        onClose={() => setShowCoinHistory(false)} 
      />
    </div>
  );
}
