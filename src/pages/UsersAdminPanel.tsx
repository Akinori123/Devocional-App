import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { TabType } from '../types';
import { useToast } from '../context/ToastContext';
import { ShieldAlert, Search, Loader2, Star, Trash2, RefreshCw, X, ShieldOff, UserX, UserCheck, Users, PlaySquare } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { AdminTab } from '../components/profile/AdminTab';

interface UsersAdminPanelProps {
  onChangeTab: (tab: TabType) => void;
}

export function UsersAdminPanel({ onChangeTab }: UsersAdminPanelProps) {
  const { profile, user } = useAuth();
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userToSuspend, setUserToSuspend] = useState<any>(null);
  const [userToSoftDelete, setUserToSoftDelete] = useState<any>(null);
  const [userToHardDelete, setUserToHardDelete] = useState<any>(null);
  const [currentView, setCurrentView] = useState<'active' | 'trash'>('active');
  const [mainTab, setMainTab] = useState<'users' | 'content'>('users');
  const toast = useToast();

  useEffect(() => {
    if (!isAdmin) {
      onChangeTab('home');
      return;
    }
    loadUsers();
  }, [isAdmin, onChangeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const loadedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(loadedUsers);
    } catch (err) {
      toast.error('Erro ao buscar usuários.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isUserAdmin = (u: any) => {
    return u?.isAdmin === true || 
      u?.email === 'dofekrafael@gmail.com' || 
      u?.email === 'sjhonatan916@gmail.com' || 
      u?.email === 'floresceremadoracao@gmail.com';
  };

  const togglePremium = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Ação Bloqueada: Contas de Administrador possuem imunidade e privilégios permanentes.');
      return;
    }
    try {
      const isCurrentlyPremium = targetUser.isPremium === true;
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        isPremium: !isCurrentlyPremium,
        subscriptionStatus: !isCurrentlyPremium ? 'premium' : 'free',
        subscriptionDate: !isCurrentlyPremium ? format(new Date(), 'yyyy-MM-dd') : null
      });
      toast.success(`Usuário ${!isCurrentlyPremium ? 'promovido a Premium' : 'rebaixado a Free'}.`);
      setUsers(users.map(u => u.id === targetUser.id ? {
        ...u,
        isPremium: !isCurrentlyPremium,
        subscriptionStatus: !isCurrentlyPremium ? 'premium' : 'free',
      } : u));
    } catch (err) {
      toast.error('Erro ao atualizar status do usuário.');
    }
  };

  const resetImageLimit = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Ação desnecessária: Administradores possuem geração ilimitada de imagens.');
      return;
    }
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        dailyImageCount: 0
      });
      toast.success('Limite de imagens resetado com sucesso.');
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, dailyImageCount: 0 } : u));
    } catch (err) {
      toast.error('Erro ao resetar limite de imagens.');
    }
  };

  const toggleBanUser = async () => {
    if (!userToSuspend) return;
    if (isUserAdmin(userToSuspend)) {
      toast.error('Ação Bloqueada: Não é permitido suspender ou banir um Administrador.');
      setUserToSuspend(null);
      return;
    }
    try {
      const isCurrentlyBanned = userToSuspend.isBanned === true;
      const userRef = doc(db, 'users', userToSuspend.id);
      await updateDoc(userRef, {
        isBanned: !isCurrentlyBanned
      });
      toast.success(isCurrentlyBanned ? 'Usuário desbanido com sucesso.' : 'Usuário banido com sucesso.');
      setUsers(users.map(u => u.id === userToSuspend.id ? { ...u, isBanned: !isCurrentlyBanned } : u));
      setUserToSuspend(null);
    } catch (err) {
      toast.error('Erro ao suspender/desbanir usuário.');
    }
  };

  const softDeleteUser = async () => {
    if (!userToSoftDelete) return;
    if (isUserAdmin(userToSoftDelete)) {
      toast.error('Ação Bloqueada: Não é permitido mover um Administrador para a lixeira.');
      setUserToSoftDelete(null);
      return;
    }
    try {
      const userRef = doc(db, 'users', userToSoftDelete.id);
      await updateDoc(userRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString()
      });
      toast.success('Usuário movido para a lixeira.');
      setUsers(users.map(u => u.id === userToSoftDelete.id ? { ...u, isDeleted: true, deletedAt: new Date().toISOString() } : u));
      setUserToSoftDelete(null);
    } catch (err) {
      toast.error('Erro ao mover usuário para a lixeira.');
    }
  };

  const restoreUser = async (targetUser: any) => {
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        isDeleted: false,
        deletedAt: null
      });
      toast.success('Usuário restaurado com sucesso.');
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, isDeleted: false, deletedAt: null } : u));
    } catch (err) {
      toast.error('Erro ao restaurar usuário.');
    }
  };

  const hardDeleteUser = async () => {
    if (!userToHardDelete) return;
    if (isUserAdmin(userToHardDelete)) {
      toast.error('Ação Bloqueada: Não é permitido excluir um Administrador.');
      setUserToHardDelete(null);
      return;
    }
    try {
      const userRef = doc(db, 'users', userToHardDelete.id);
      await deleteDoc(userRef);
      toast.success('Usuário excluído permanentemente.');
      setUsers(users.filter(u => u.id !== userToHardDelete.id));
      setUserToHardDelete(null);
    } catch (err) {
      toast.error('Erro ao excluir usuário permanentemente.');
    }
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = name.includes(term) || email.includes(term);
    
    if (currentView === 'trash') {
      return matchesSearch && u.isDeleted === true;
    }
    return matchesSearch && u.isDeleted !== true;
  });

  if (!isAdmin) return null;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-32 transition-colors duration-200">
      {/* Header Info & Tabs (Flows naturally on scroll) */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 pt-10 pb-4 shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Central Administrativa</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mainTab === 'users' ? `${users.length} usuários registrados` : 'Gerencie vídeos e devocionais'}
            </p>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-3 rounded-xl text-red-800 dark:text-red-200 text-xs sm:text-sm mb-4">
          <p className="font-bold mb-0.5">Painel Restrito</p>
          <p>Apenas criadores têm acesso a esta área. Aqui você controla todo o aplicativo.</p>
        </div>

        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
          <button
            onClick={() => setMainTab('users')}
            className={cn(
              "flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-all",
              mainTab === 'users'
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            )}
          >
            <Users className="w-4 h-4" />
            Gestão de Usuários
          </button>
          <button
            onClick={() => setMainTab('content')}
            className={cn(
              "flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg transition-all",
              mainTab === 'content'
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            )}
          >
            <PlaySquare className="w-4 h-4" />
            Gestão de Conteúdo
          </button>
        </div>
      </div>

      {/* Compact Sticky Search & Filter Bar for Users Tab */}
      {mainTab === 'users' && (
        <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-3 pb-2.5 space-y-2 border-b border-gray-200/70 dark:border-slate-800/70 transition-colors duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none transition-all text-gray-900 dark:text-white placeholder:text-gray-500 shadow-xs"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentView('active')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs",
                currentView === 'active' 
                  ? "bg-red-600 text-white shadow-sm" 
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/60"
              )}
            >
              Usuários Ativos
            </button>
            <button
              onClick={() => setCurrentView('trash')}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs",
                currentView === 'trash' 
                  ? "bg-red-600 text-white shadow-sm" 
                  : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700/60"
              )}
            >
              Lixeira
            </button>
          </div>
        </div>
      )}

      {/* Content Area - Natural Page Scrolling */}
      <div className="p-4 space-y-4">
        {mainTab === 'content' ? (
          <AdminTab />
        ) : (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          filteredUsers.map(u => {
            const isTargetAdmin = u.isAdmin === true || u.email === 'dofekrafael@gmail.com' || u.email === 'sjhonatan916@gmail.com' || u.email === 'floresceremadoracao@gmail.com';
            return (
            <div key={u.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{u.name || 'Sem Nome'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{u.email || 'Sem E-mail (Antigo)'}</p>
                </div>
                {isTargetAdmin ? (
                  <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 flex items-center gap-1 shadow-sm">
                    👑 ADMIN
                  </div>
                ) : (
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                    u.isPremium 
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" 
                      : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                  )}>
                    {u.isPremium ? 'Premium' : 'Free'}
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                <p>ID: <span className="font-mono">{u.id}</span></p>
                {u.dailyImageCount !== undefined && <p>Imagens Hoje: {u.dailyImageCount}</p>}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                {currentView === 'active' ? (
                  <>
                    <button
                      onClick={() => togglePremium(u)}
                      disabled={isTargetAdmin}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        u.isPremium 
                          ? "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-gray-200"
                          : "bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400"
                      )}
                    >
                      {u.isPremium ? <ShieldOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                      {u.isPremium ? 'Revogar Premium' : 'Tornar Premium'}
                    </button>

                    <button
                      onClick={() => resetImageLimit(u)}
                      disabled={isTargetAdmin}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Resetar Limite de Imagem Diário"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setUserToSuspend(u)}
                      disabled={isTargetAdmin}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-orange-50 hover:bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 dark:text-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={u.isBanned ? "Desbanir Usuário" : "Suspender Usuário"}
                    >
                      {u.isBanned ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => setUserToSoftDelete(u)}
                      disabled={isTargetAdmin}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Mover para Lixeira"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => restoreUser(u)}
                      disabled={isTargetAdmin}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Restaurar
                    </button>

                    <button
                      onClick={() => setUserToHardDelete(u)}
                      disabled={isTargetAdmin}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir Definitivamente
                    </button>
                  </>
                )}
              </div>
            </div>
          )})
        )}
        </>
        )}
      </div>

      {/* Suspend Modal */}
      {userToSuspend && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              {userToSuspend.isBanned ? <UserCheck className="w-6 h-6 text-red-600 dark:text-red-500" /> : <UserX className="w-6 h-6 text-red-600 dark:text-red-500" />}
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{userToSuspend.isBanned ? 'Desbanir Usuário?' : 'Suspender Usuário?'}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja {userToSuspend.isBanned ? 'desbanir' : 'suspender'} <b>{userToSuspend.name}</b>?
              {!userToSuspend.isBanned && " O usuário será deslogado imediatamente e não poderá acessar o aplicativo."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToSuspend(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={toggleBanUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
              >
                {userToSuspend.isBanned ? 'Desbanir' : 'Suspender'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {userToSoftDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Mover para a Lixeira?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Tem certeza que deseja enviar <b>{userToSoftDelete.name}</b> para a lixeira? A conta será desativada e poderá ser restaurada em até 30 dias.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToSoftDelete(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={softDeleteUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
              >
                Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hard Delete Modal */}
      {userToHardDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Excluir Definitivamente?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Atenção! Esta ação <b>não pode ser desfeita</b>. Você excluirá permanentemente os dados de <b>{userToHardDelete.name}</b> do banco de dados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setUserToHardDelete(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={hardDeleteUser}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
