import { useState, useRef, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { Moon, Sun, User as UserIcon, Trash2, Edit2, X, Loader2, Camera, Bell, AlertTriangle, ShieldAlert } from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useToast } from '../../context/ToastContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export function SettingsTab() {
  const toast = useToast();
  const { theme, setTheme } = useSettings();
  const { user, profile, logout } = useAuth();
  
  const { permission, isSupported, loading: pushLoading, isSubscribed, toggleSubscription } = usePushNotifications();
  const [showPushModal, setShowPushModal] = useState(false);

  // Auto-close permission denied modal when permission becomes granted
  useEffect(() => {
    if (permission === 'granted' && showPushModal) {
      setShowPushModal(false);
      toast.success("Permissão concedida! Notificações ativadas.");
    }
  }, [permission, showPushModal, toast]);

  const handleTogglePush = async () => {
    try {
      const subscribed = await toggleSubscription();
      if (subscribed) {
        toast.success("Notificações ativadas com sucesso!");
      } else {
        toast.success("Notificações silenciadas.");
      }
    } catch (error: any) {
      if (error.message === "PERMISSION_DENIED") {
        setShowPushModal(true);
      } else {
        toast.error(error.message || "Não foi possível alterar as notificações.");
      }
    }
  };
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editNeedArea, setEditNeedArea] = useState(profile?.needArea || '');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploadingPhoto(true);
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
          setIsUploadingPhoto(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao atualizar foto.');
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    try {
      setIsSaving(true);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editName.trim(),
        needArea: editNeedArea.trim(),
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Não foi possível salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmationText.trim().toUpperCase() !== 'EXCLUIR') return;
    try {
      setIsDeleting(true);

      // 1. Chamar o backend para cancelar assinatura ativa no Mercado Pago e limpar registros
      try {
        const response = await fetch('/api/delete-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid })
        });
        if (!response.ok) {
          console.warn('Backend delete-account responded with non-200 status');
        }
      } catch (apiErr) {
        console.warn('Backend delete-account call notice:', apiErr);
      }

      // 2. Apagar documento do usuário no Firestore caso ainda exista
      try {
        const userRef = doc(db, 'users', user.uid);
        await deleteDoc(userRef);
      } catch (fsErr) {
        console.warn('Firestore user doc cleanup notice:', fsErr);
      }
      
      // 3. Apagar usuário no Firebase Auth
      try {
        await deleteUser(user);
      } catch (authError: any) {
        if (authError.code === 'auth/requires-recent-login') {
          toast.error('Por segurança, faça login novamente antes de concluir a exclusão.');
          await logout();
          return;
        }
        console.warn('Client auth user deletion notice:', authError);
      }
      
      toast.success('Sua conta foi excluída com sucesso.');
      await logout();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Não foi possível excluir a conta. Tente novamente.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmationText('');
    }
  };

  const isDeleteButtonEnabled = deleteConfirmationText.trim().toUpperCase() === 'EXCLUIR';

  return (
    <div className="p-5 space-y-6">
      {/* Seção: Aparência */}
      <section className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-200">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Aparência</h3>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-gray-900 dark:text-white text-base">Modo Escuro</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Mudar o tema do aplicativo</p>
          </div>
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-xl font-medium transition-colors hover:bg-yellow-100 dark:hover:bg-yellow-900/50 cursor-pointer"
          >
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            {theme === 'dark' ? 'Escuro' : 'Claro'}
          </button>
        </div>
      </section>

      {/* Seção: Notificações */}
      {isSupported && (
        <section className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-200">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Notificações</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base">Versículo do Dia</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                  {permission === 'denied' 
                    ? 'Bloqueado nas configurações' 
                    : isSubscribed 
                      ? 'Notificações ativadas' 
                      : 'Receba alertas diários'}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Ativar ou desativar notificações do versículo do dia"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                pushLoading ? 'opacity-70 cursor-wait' : 'cursor-pointer'
              } ${
                isSubscribed ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              >
                {pushLoading && (
                  <Loader2 className="w-2.5 h-2.5 text-blue-600 animate-spin" />
                )}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* Seção: Gestão de Conta */}
      <section className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-200">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Sua Conta</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-full text-yellow-500 dark:text-yellow-400">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base">Perfil Pessoal</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Atualizar nome e interesses</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditName(profile?.name || '');
                setEditNeedArea(profile?.needArea || '');
                setIsEditingProfile(true);
              }}
              className="text-sm font-semibold text-yellow-500 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 cursor-pointer"
            >
              Editar
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-base">Excluir Conta</h4>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5 text-balance">Apagar todos os dados permanentemente (LGPD)</p>
              </div>
            </div>
            <button
              onClick={() => {
                setDeleteConfirmationText('');
                setShowDeleteConfirm(true);
              }}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors text-sm cursor-pointer"
            >
              Excluir
            </button>
          </div>
        </div>
      </section>

      {/* Modal Editar Perfil */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsEditingProfile(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-white mb-6">Editar Perfil</h2>
            
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-3">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-sm flex items-center justify-center">
                  {isUploadingPhoto ? (
                    <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                  ) : profile?.photoURL ? (
                    <img src={profile.photoURL} alt="Foto de perfil" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Trocar Foto
              </button>
              {isUploadingPhoto && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">Atualizando foto...</span>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Como devemos te chamar?</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área de Necessidade (Opcional)</label>
                <input
                  type="text"
                  value={editNeedArea}
                  onChange={(e) => setEditNeedArea(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Ex: Paz financeira, Saúde, Ansiedade"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Ista ajuda nossa IA a gerar devocionais mais precisos para o seu momento.
                </p>
              </div>
              
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || !editName.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-700 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-70 mt-2 flex justify-center items-center gap-2 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zona de Perigo (Danger Zone) - Confirmação Forte com Proteção Financeira */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl relative border border-red-200/60 dark:border-red-900/40 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                if (!isDeleting) {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmationText('');
                }
              }}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Ícone de Perigo */}
            <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-red-200 dark:border-red-900/60 shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold font-serif text-gray-900 dark:text-white text-center mb-2">
              Zona de Perigo: Excluir Conta
            </h2>

            {/* Box de Alerta Financeiro Crítico */}
            <div className="my-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                <strong>Atenção:</strong> Esta ação é irreversível. Se você for um usuário VIP, sua assinatura no cartão será cancelada imediatamente e os dias restantes de PIX serão perdidos.
              </p>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 text-center mb-5 leading-relaxed">
              Todos os seus devocionais salvos, notas do diário, versículos favoritos e histórico serão permanentemente excluídos do banco de dados.
            </p>
            
            {/* Input de Confirmação Obrigatória */}
            <div className="mb-5 space-y-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Para confirmar a exclusão definitiva, digite <strong className="text-red-600 dark:text-red-400">EXCLUIR</strong> abaixo:
              </label>
              <input
                type="text"
                autoCapitalize="characters"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Digite EXCLUIR para confirmar"
                disabled={isDeleting}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/90 border border-gray-300 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all uppercase tracking-wider"
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDeleteAccount}
                disabled={!isDeleteButtonEnabled || isDeleting}
                className={`w-full font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 text-sm shadow-md ${
                  isDeleteButtonEnabled && !isDeleting
                    ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer hover:shadow-red-600/20'
                    : 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-300/40 dark:border-slate-700/50'
                }`}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Cancelando assinaturas e excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Deletar Minha Conta</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmationText('');
                }}
                disabled={isDeleting}
                className="w-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold py-3 rounded-xl transition-all text-sm cursor-pointer"
              >
                Cancelar e Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPushModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-6 h-6 text-red-600 dark:text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Notificações Bloqueadas</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Você bloqueou as notificações. Para voltar a receber, vá nas <b>Configurações do seu celular</b> &gt; <b>Aplicativos</b> &gt; <b>Florescer</b> e permita as notificações.
            </p>
            <button
              onClick={() => setShowPushModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
