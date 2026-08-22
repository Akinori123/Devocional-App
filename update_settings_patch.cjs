const fs = require('fs');
const file = 'src/components/profile/SettingsTab.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const { permission, isSupported, loading: pushLoading, requestPermission } = usePushNotifications();',
  'const { permission, isSupported, loading: pushLoading, isSubscribed, toggleSubscription } = usePushNotifications();\n  const [showPushModal, setShowPushModal] = useState(false);'
);

content = content.replace(
  `  const handleTogglePush = async () => {
    if (permission === 'granted') {
      toast.success("As notificações já estão ativadas!");
      return;
    }
    
    try {
      await requestPermission();
      toast.success("Notificações ativadas com sucesso! Você receberá o Versículo do Dia.");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível ativar as notificações.");
    }
  };`,
  `  const handleTogglePush = async () => {
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
  };`
);

content = content.replace(
  /isSupported \? permission === 'granted' : false/g,
  "isSubscribed"
);

// Add the modal for permission denied
const modalHTML = `
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
              className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 rounded-xl transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
`;

// Insert the modal just before the closing </div> of SettingsTab return
content = content.replace(/    <\/div>\n  \);\n}/, modalHTML + '    </div>\n  );\n}');

fs.writeFileSync(file, content);
console.log('Patched SettingsTab.tsx');
