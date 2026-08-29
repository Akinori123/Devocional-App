import { CoinIcon } from './common/CoinIcon';
import { useAuth } from '../context/AuthContext';
import { TabType } from '../types';

interface HeaderProps {
  onChangeTab?: (tab: TabType) => void;
  onOpenMissions?: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({ onChangeTab, onOpenMissions, title, subtitle }: HeaderProps) {
  const { user, profile } = useAuth();
  const userName = profile?.name || user?.displayName || 'Irmão(ã)';
  const userCoins = profile?.coins || 0;

  return (
    <div className="bg-yellow-400 dark:bg-slate-900 text-yellow-950 dark:text-white shadow-sm rounded-b-3xl transition-colors duration-200 border-b border-yellow-500/20 dark:border-slate-800 overflow-hidden">
      {/* Top Bar with Logo, Coins Counter & Avatar */}
      <div className="bg-yellow-400 dark:bg-slate-800 px-6 pt-5 pb-2.5 flex justify-between items-center transition-colors duration-200 border-b border-yellow-950/20 dark:border-slate-700/60">
        
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5">
          <div className="bg-white/40 dark:bg-slate-700/80 p-1 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-11 h-11 shrink-0 border border-white/40 dark:border-slate-600">
            <img src="/images/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif font-bold text-yellow-950 dark:text-yellow-400 text-xl tracking-tight">Florescer</span>
        </div>

        {/* Right Actions: Coins Balance & Profile Avatar */}
        <div className="flex items-center gap-2.5">
          
          {/* Moedas Counter Button (Abre Modal de Missões / Extrato) */}
          <button
            onClick={onOpenMissions}
            className="bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-xs hover:scale-105 transition-all cursor-pointer shrink-0"
            title="Ver Missões Diárias e Saldo de Moedas"
          >
            <CoinIcon className="w-4 h-4" />
            <span>{userCoins}</span>
          </button>

          {/* Profile Photo Avatar */}
          <button 
            onClick={() => onChangeTab?.('profile')} 
            className="w-11 h-11 rounded-full border-2 border-white/60 dark:border-slate-600 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 dark:bg-slate-700 hover:scale-105 transition-transform shrink-0 cursor-pointer"
            title="Acessar Perfil"
          >
            {profile?.photoURL || user?.photoURL ? (
              <img 
                src={profile?.photoURL || user?.photoURL || ''} 
                alt={userName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <span className="text-yellow-900 dark:text-yellow-400 font-bold text-base">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Optional Title & Subtitle Area (e.g. for Bible screen) */}
      {title && (
        <div className="px-6 pt-3 pb-5">
          <h1 className="text-2xl font-bold font-serif mb-0.5 text-yellow-950 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-yellow-900 dark:text-gray-300 text-sm">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
