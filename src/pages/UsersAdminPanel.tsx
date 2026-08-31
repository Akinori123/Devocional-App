import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { TabType } from '../types';
import { useToast } from '../context/ToastContext';
import { 
  ShieldAlert, 
  Search, 
  Loader2, 
  Star, 
  Trash2, 
  RefreshCw, 
  X, 
  ShieldOff, 
  AlertTriangle,
  UserX, 
  UserCheck, 
  Users, 
  PlaySquare, 
  QrCode, 
  CreditCard, 
  Sparkles, 
  Crown, 
  Clock, 
  CheckCircle2,
  ExternalLink,
  Coins,
  Plus,
  Minus,
  Shield,
  ShieldCheck,
  BellRing
} from 'lucide-react';
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
  const [userToManageVip, setUserToManageVip] = useState<any>(null);
  const [userToRevokeVip, setUserToRevokeVip] = useState<any>(null);
  const [userToManageCoins, setUserToManageCoins] = useState<any>(null);
  const [cardSubscriptionIdInput, setCardSubscriptionIdInput] = useState('');
  const [savingVip, setSavingVip] = useState(false);
  const [coinsAmountInput, setCoinsAmountInput] = useState<string>('');
  const [savingCoins, setSavingCoins] = useState(false);
  const [currentView, setCurrentView] = useState<'active' | 'trash'>('active');
  const [mainTab, setMainTab] = useState<'users' | 'content'>('users');
  const [testingSaleAlert, setTestingSaleAlert] = useState(false);
  const toast = useToast();

  const handleTestSaleAlert = async () => {
    setTestingSaleAlert(true);
    try {
      const res = await fetch('/api/admin/test-sale-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 29.90,
          planName: "Assinatura VIP Florescer (Teste)",
          customerName: user?.displayName || "Assinante Exemplo",
          customerEmail: user?.email || "dofekrafael@gmail.com",
          paymentMethod: "PIX"
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Alerta Hotmart disparado! Push: ${data.result?.pushSent ? 'Enviado ✅' : 'Registrado'} | E-mail: ${data.result?.emailSent ? 'Enviado ✅' : 'Salvo no Log'}`);
      } else {
        toast.error('Erro ao disparar teste de alerta.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha de conexão com a API de alerta.');
    } finally {
      setTestingSaleAlert(false);
    }
  };

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

  // 1. Adicionar / Renovar +30 Dias (PIX / Suporte Pré-pago)
  const handleAdd30DaysPix = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Contas de Administrador já possuem acesso vitalício permanente.');
      return;
    }
    setSavingVip(true);
    try {
      // Se já tem data futura, estende a partir dela; senão, a partir de agora
      const now = Date.now();
      let baseTime = now;
      if (targetUser.subscriptionExpiresAt) {
        const existingExpires = new Date(targetUser.subscriptionExpiresAt).getTime();
        if (existingExpires > now) {
          baseTime = existingExpires;
        }
      }
      const newExpiresAt = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString();

      const userRef = doc(db, 'users', targetUser.id);
      const updatedData = {
        isPremium: true,
        subscriptionType: 'pix_prepaid',
        subscriptionStatus: 'active',
        subscriptionPlan: 'pix_30_days',
        subscriptionExpiresAt: newExpiresAt,
        cancelAtPeriodEnd: false,
        subscriptionUpdatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updatedData);
      toast.success(`+30 Dias adicionados com sucesso! Válido até ${newExpiresAt.slice(0, 10)}.`);
      
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, ...updatedData } : u));
      setUserToManageVip(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao adicionar 30 dias de acesso.');
    } finally {
      setSavingVip(false);
    }
  };

  // 2. Sincronizar Assinatura de Cartão (Mercado Pago)
  const handleLinkCardSubscription = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Contas de Administrador já possuem acesso vitalício permanente.');
      return;
    }
    const trimmedId = cardSubscriptionIdInput.trim();
    if (!trimmedId) {
      toast.error('Informe o ID da assinatura do Mercado Pago.');
      return;
    }

    setSavingVip(true);
    try {
      const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      const userRef = doc(db, 'users', targetUser.id);
      const updatedData = {
        isPremium: true,
        subscriptionType: 'credit_card_recurring',
        mpSubscriptionId: trimmedId,
        subscriptionStatus: 'authorized',
        subscriptionPlan: 'monthly_card',
        subscriptionExpiresAt: expiresAt,
        cancelAtPeriodEnd: false,
        subscriptionUpdatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updatedData);
      toast.success('Assinatura de cartão sincronizada com sucesso no cadastro do usuário!');
      
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, ...updatedData } : u));
      setUserToManageVip(null);
      setCardSubscriptionIdInput('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao vincular assinatura de cartão.');
    } finally {
      setSavingVip(false);
    }
  };

  // 3. Conceder VIP Cortesia / Vitalício (Admin Grant)
  const handleGrantAdminCourtesy = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Contas de Administrador já possuem acesso vitalício permanente.');
      return;
    }
    setSavingVip(true);
    try {
      const userRef = doc(db, 'users', targetUser.id);
      const updatedData = {
        isPremium: true,
        subscriptionType: 'admin_grant',
        subscriptionStatus: 'active',
        subscriptionPlan: 'admin_courtesy',
        subscriptionExpiresAt: null,
        cancelAtPeriodEnd: false,
        subscriptionUpdatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updatedData);
      toast.success('Acesso VIP Cortesia Vitalício concedido com sucesso!');
      
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, ...updatedData } : u));
      setUserToManageVip(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conceder acesso cortesia.');
    } finally {
      setSavingVip(false);
    }
  };

  // 4. Revogar Acesso VIP (Voltar para Free)
  const handleRevokeVip = async (targetUser: any) => {
    if (isUserAdmin(targetUser)) {
      toast.error('Ação Bloqueada: Contas de Administrador possuem imunidade.');
      return;
    }
    setSavingVip(true);
    try {
      const userRef = doc(db, 'users', targetUser.id);
      const updatedData = {
        isPremium: false,
        subscriptionType: null,
        subscriptionStatus: 'free',
        subscriptionExpiresAt: null,
        cancelAtPeriodEnd: false,
        subscriptionUpdatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updatedData);
      toast.success('Acesso VIP revogado. Usuário retornado ao plano Free.');
      
      setUsers(users.map(u => u.id === targetUser.id ? { ...u, ...updatedData } : u));
      setUserToManageVip(null);
      setUserToRevokeVip(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao revogar status VIP.');
    } finally {
      setSavingVip(false);
    }
  };

  // 5. Atualizar / Creditar Moedas no Perfil do Usuário
  const handleUpdateCoins = async (targetUser: any, newTotal: number) => {
    if (isNaN(newTotal) || newTotal < 0) {
      toast.error('Informe uma quantidade válida de moedas (maior ou igual a zero).');
      return;
    }
    setSavingCoins(true);
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        coins: newTotal,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Saldo atualizado com sucesso para ${newTotal.toLocaleString()} moedas!`);
      
      const updatedUser = { ...targetUser, coins: newTotal };
      setUsers(users.map(u => u.id === targetUser.id ? updatedUser : u));
      if (userToManageCoins?.id === targetUser.id) {
        setUserToManageCoins(updatedUser);
      }
      if (userToManageVip?.id === targetUser.id) {
        setUserToManageVip(updatedUser);
      }
      setCoinsAmountInput(newTotal.toString());
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar saldo de moedas no Firestore.');
    } finally {
      setSavingCoins(false);
    }
  };

  const handleAddCoinsIncrement = async (targetUser: any, increment: number) => {
    const currentVal = parseInt(coinsAmountInput, 10);
    const baseCoins = !isNaN(currentVal) ? currentVal : (typeof targetUser.coins === 'number' ? targetUser.coins : 0);
    const newTotal = Math.max(0, baseCoins + increment);
    setCoinsAmountInput(newTotal.toString());
    await handleUpdateCoins(targetUser, newTotal);
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

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 p-3.5 rounded-xl text-red-800 dark:text-red-200 text-xs sm:text-sm mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold mb-0.5">Painel Restrito & Alertas de Venda</p>
            <p>Controle de usuários, conteúdo e disparo de notificações automáticas via webhook.</p>
          </div>
          <button
            onClick={handleTestSaleAlert}
            disabled={testingSaleAlert}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title="Disparar teste de Push Notification estilo Hotmart e E-mail de Nova Venda"
          >
            {testingSaleAlert ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BellRing className="w-3.5 h-3.5" />
            )}
            Testar Alerta de Venda (Push + E-mail)
          </button>
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
                  <div className="flex flex-col items-end gap-1">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
                      u.isPremium 
                        ? (u.subscriptionType === 'admin_grant'
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : u.subscriptionType === 'pix_prepaid'
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400")
                        : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                    )}>
                      {u.isPremium 
                        ? (u.subscriptionType === 'admin_grant'
                            ? 'VIP Cortesia'
                            : u.subscriptionType === 'pix_prepaid' 
                              ? 'PIX (30 Dias)' 
                              : u.subscriptionType === 'credit_card_recurring'
                                ? 'Cartão Recorrente'
                                : 'VIP Ativo') 
                        : 'Free'}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1">
                <p>ID: <span className="font-mono">{u.id}</span></p>
                {u.subscriptionType && (
                  <p>Tipo: <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {u.subscriptionType === 'admin_grant' ? 'Cortesia Administrativa (Vitalício)' : u.subscriptionType === 'pix_prepaid' ? 'Passe de 30 Dias (PIX)' : 'Recorrente no Cartão'}
                  </span></p>
                )}
                {u.mpSubscriptionId && (
                  <p>ID MP: <span className="font-mono text-gray-700 dark:text-gray-300">{u.mpSubscriptionId}</span></p>
                )}
                {u.subscriptionExpiresAt && (
                  <p>Validade: <span className="font-medium text-gray-700 dark:text-gray-300">{u.subscriptionExpiresAt.slice(0, 10)}</span></p>
                )}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {(typeof u.coins === 'number' ? u.coins : 0).toLocaleString()} moedas
                  </span>
                </div>
                {u.dailyImageCount !== undefined && <p>Imagens Hoje: {u.dailyImageCount}</p>}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                {currentView === 'active' ? (
                  <>
                    {/* Botão de Gestão de Moedas (Aberto a todos os usuários e admins) */}
                    <button
                      id={`btn-manage-coins-${u.id}`}
                      onClick={() => {
                        setUserToManageCoins(u);
                        setCoinsAmountInput(typeof u.coins === 'number' ? u.coins.toString() : '0');
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 transition-colors active:scale-98"
                      title="Gerenciar Moedas do Usuário"
                    >
                      <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Moedas</span>
                    </button>

                    {/* Botão de Gestão VIP (Desabilitado para admin) */}
                    <button
                      id={`btn-manage-vip-${u.id}`}
                      onClick={() => {
                        if (isTargetAdmin) return;
                        setUserToManageVip(u);
                        setCardSubscriptionIdInput(u.mpSubscriptionId || '');
                      }}
                      disabled={isTargetAdmin}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed",
                        isTargetAdmin
                          ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/30"
                          : u.isPremium 
                            ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300"
                            : "bg-yellow-100 hover:bg-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 dark:text-yellow-400"
                      )}
                      title={isTargetAdmin ? "Conta de Administrador (Acesso Vitalício Total)" : u.isPremium ? "Gerenciar Assinatura VIP" : "Conceder Assinatura VIP"}
                    >
                      {isTargetAdmin ? <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" /> : <Crown className="w-4 h-4 text-amber-500" />}
                      <span>{isTargetAdmin ? 'Admin Vitalício' : u.isPremium ? 'Gerenciar VIP' : 'Conceder VIP'}</span>
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

      {/* Modal de Gestão VIP Exclusivo */}
      {userToManageVip && (
        <div 
          id="vip-management-modal-overlay"
          className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            id="vip-management-modal-card"
            className="bg-white dark:bg-slate-900 border-t sm:border border-gray-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-gray-900 dark:text-white"
          >
            {/* Header fixo */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400 border border-amber-500/20">
                  <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Gerenciamento VIP
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {userToManageVip.name || 'Sem Nome'} • <span className="font-mono">{userToManageVip.email}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserToManageVip(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo rolável com scroll suave no celular */}
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 flex-1">
              {/* Status Atual */}
              <div className="bg-gray-50 dark:bg-slate-800/60 rounded-2xl p-3.5 sm:p-4 border border-gray-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400 font-semibold">Status Atual:</span>
                  <span className={cn(
                    "font-bold px-2.5 py-0.5 rounded-full text-[11px]",
                    userToManageVip.isPremium 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
                  )}>
                    {userToManageVip.isPremium ? 'VIP Ativo' : 'Plano Gratuito'}
                  </span>
                </div>
                {userToManageVip.subscriptionExpiresAt && (
                  <div className="flex items-center justify-between text-xs mt-1.5 text-gray-600 dark:text-gray-300">
                    <span>Validade Atual:</span>
                    <span className="font-mono font-medium">{userToManageVip.subscriptionExpiresAt.slice(0, 10)}</span>
                  </div>
                )}
                {userToManageVip.mpSubscriptionId && (
                  <div className="flex items-center justify-between text-xs mt-1.5 text-gray-600 dark:text-gray-300">
                    <span>ID Assinatura Mercado Pago:</span>
                    <span className="font-mono font-medium text-[11px]">{userToManageVip.mpSubscriptionId}</span>
                  </div>
                )}
              </div>

              {/* Opções de Concessão VIP */}
              <div className="space-y-3">
                {/* Opção 1: +30 Dias PIX */}
                <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 transition-all hover:border-emerald-500/40">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Adicionar +30 Dias (PIX / Suporte)</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                        Soma 30 dias de acesso pré-pago sem renovação automática. Ideal para quem pagou via PIX ou recebeu dias de suporte.
                      </p>
                      <button
                        id="btn-add-30days-admin"
                        disabled={savingVip}
                        onClick={() => handleAdd30DaysPix(userToManageVip)}
                        className="mt-3 w-full sm:w-auto py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                      >
                        {savingVip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                        <span>Conceder / Renovar +30 Dias</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Opção 2: Sincronizar Cartão Mercado Pago */}
                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 transition-all hover:border-amber-500/40">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Vincular Assinatura no Cartão (Mercado Pago)</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                        Cole o ID da assinatura do Mercado Pago (ex: <code className="font-mono bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">2c938084...</code>) para que o sistema reconheça a recorrência automática.
                      </p>
                      
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          placeholder="Cole o ID da Assinatura (Preapproval ID)"
                          value={cardSubscriptionIdInput}
                          onChange={(e) => setCardSubscriptionIdInput(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-amber-500/30 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-gray-900 dark:text-white font-mono"
                        />
                        <button
                          id="btn-sync-card-subscription"
                          disabled={savingVip || !cardSubscriptionIdInput.trim()}
                          onClick={() => handleLinkCardSubscription(userToManageVip)}
                          className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 shrink-0"
                        >
                          {savingVip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Sincronizar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opção 3: VIP Cortesia Vitalício */}
                <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20 transition-all hover:border-purple-500/40">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">Conceder VIP Vitalício (Cortesia)</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
                        Acesso permanente sem data de expiração e sem cobrança vinculada. O usuário terá todos os benefícios VIP livres.
                      </p>
                      <button
                        id="btn-grant-vip-courtesy"
                        disabled={savingVip}
                        onClick={() => handleGrantAdminCourtesy(userToManageVip)}
                        className="mt-3 w-full sm:w-auto py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                      >
                        {savingVip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                        <span>Conceder VIP Vitalício</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Opção 4: Revogar VIP */}
                {userToManageVip.isPremium && (
                  <div className="pt-2">
                    <button
                      id="btn-revoke-vip-user"
                      disabled={savingVip}
                      onClick={() => setUserToRevokeVip(userToManageVip)}
                      className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>Revogar VIP (Tornar Usuário Gratuito)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestão de Moedas Separado */}
      {userToManageCoins && (
        <div 
          id="coins-management-modal-overlay"
          className="fixed inset-0 bg-black/75 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            id="coins-management-modal-card"
            className="bg-white dark:bg-slate-900 border-t sm:border border-gray-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-gray-900 dark:text-white"
          >
            {/* Header fixo */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-gray-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400 border border-amber-500/20">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Gerenciamento de Moedas
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {userToManageCoins.name || 'Sem Nome'} • <span className="font-mono">{userToManageCoins.email}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserToManageCoins(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo rolável */}
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 flex-1">
              {/* Card de Informações e Saldo Atual */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 dark:via-amber-900/10 dark:to-transparent rounded-2xl p-4 border border-amber-500/30">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Saldo Atual no Firestore:</span>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 font-bold text-sm shadow-sm border border-amber-500/20">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span>{(typeof userToManageCoins.coins === 'number' ? userToManageCoins.coins : 0).toLocaleString()} moedas</span>
                  </div>
                </div>
                
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Digite o novo saldo desejado ou utilize os botões rápidos abaixo para creditar ou debitar moedas imediatamente.
                </p>

                {/* Input do Novo Valor + Botão Gravar Saldo Exato */}
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      id="input-coins-amount"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Digite o novo saldo (ex: 9999 ou 0)"
                      value={coinsAmountInput}
                      onChange={(e) => setCoinsAmountInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 text-xs bg-white dark:bg-slate-800 border border-amber-500/40 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-gray-900 dark:text-white font-mono font-bold"
                    />
                    <Coins className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>

                  <button
                    id="btn-save-exact-coins"
                    type="button"
                    disabled={savingCoins || coinsAmountInput === ''}
                    onClick={() => handleUpdateCoins(userToManageCoins, parseInt(coinsAmountInput, 10))}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingCoins ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Atualizar Saldo</span>
                  </button>
                </div>
              </div>

              {/* Bloco de Atalhos Rápidos (+ / - / Zerar / Presets) */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Ajustes Rápidos (+ / -)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {/* Zerar */}
                  <button
                    type="button"
                    id="btn-quick-set-0"
                    disabled={savingCoins}
                    onClick={() => handleUpdateCoins(userToManageCoins, 0)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors border border-red-300 dark:border-red-800/40 disabled:opacity-50"
                    title="Zerar saldo de moedas"
                  >
                    Zerar (0)
                  </button>

                  {/* Subtrações Rápidas */}
                  <button
                    type="button"
                    id="btn-quick-sub-100"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, -100)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors border border-gray-200 dark:border-slate-600 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Minus className="w-3 h-3" />
                    <span>100</span>
                  </button>
                  <button
                    type="button"
                    id="btn-quick-sub-500"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, -500)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors border border-gray-200 dark:border-slate-600 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Minus className="w-3 h-3" />
                    <span>500</span>
                  </button>

                  {/* Adições Rápidas */}
                  <button
                    type="button"
                    id="btn-quick-add-100"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, 100)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors border border-amber-500/20 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>100</span>
                  </button>
                  <button
                    type="button"
                    id="btn-quick-add-500"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, 500)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors border border-amber-500/20 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>500</span>
                  </button>
                  <button
                    type="button"
                    id="btn-quick-add-1000"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, 1000)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors border border-amber-500/20 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>1.000</span>
                  </button>
                  <button
                    type="button"
                    id="btn-quick-add-5000"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, 5000)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors border border-amber-500/20 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>5.000</span>
                  </button>
                  <button
                    type="button"
                    id="btn-quick-add-10000"
                    disabled={savingCoins}
                    onClick={() => handleAddCoinsIncrement(userToManageCoins, 10000)}
                    className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 transition-colors border border-amber-500/20 disabled:opacity-50 flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>10.000</span>
                  </button>

                  {/* Presets */}
                  <button
                    type="button"
                    id="btn-quick-set-9999"
                    disabled={savingCoins}
                    onClick={() => handleUpdateCoins(userToManageCoins, 9999)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    Definir 9.999
                  </button>
                  <button
                    type="button"
                    id="btn-quick-set-999999"
                    disabled={savingCoins}
                    onClick={() => handleUpdateCoins(userToManageCoins, 999999)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 text-white hover:from-amber-700 hover:to-yellow-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    Definir 999.999
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke VIP Confirmation Modal */}
      {userToRevokeVip && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-rose-100 dark:border-rose-900/40 overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-rose-50 dark:ring-rose-950/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">
              Revogar Acesso Premium?
            </h3>
            
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Tem certeza que deseja revogar o acesso Premium deste usuário? Esta ação não reembolsa o usuário automaticamente.
            </p>

            <div className="bg-gray-50 dark:bg-slate-800/80 rounded-xl p-3 mb-6 text-left border border-gray-200 dark:border-slate-700/60">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Usuário afetado:</div>
              <div className="text-xs font-bold text-gray-900 dark:text-white truncate mt-0.5">{userToRevokeVip.name || 'Sem nome'}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{userToRevokeVip.email}</div>
            </div>

            <div className="flex gap-3">
              <button
                id="btn-cancel-revoke-vip"
                disabled={savingVip}
                onClick={() => setUserToRevokeVip(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-xl transition-colors text-xs active:scale-98 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-revoke-vip"
                disabled={savingVip}
                onClick={() => handleRevokeVip(userToRevokeVip)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-rose-600/20 text-xs flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {savingVip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
