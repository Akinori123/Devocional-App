import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextData {
  addToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((message: string) => addToast(message, 'success'), [addToast]);
  const error = useCallback((message: string) => addToast(message, 'error'), [addToast]);
  const info = useCallback((message: string) => addToast(message, 'info'), [addToast]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, success, error, info }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 left-4 right-4 z-50 flex flex-col gap-2 max-w-sm mx-auto pointer-events-none sm:left-auto sm:right-6 sm:top-6 sm:mx-0 sm:max-w-md">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all ${
                toast.type === 'success' 
                  ? 'bg-green-50/95 border-green-200 text-green-800 dark:bg-green-950/80 dark:border-green-800/60 dark:text-green-200'
                  : toast.type === 'error'
                  ? 'bg-red-50/95 border-red-200 text-red-800 dark:bg-red-950/80 dark:border-red-800/60 dark:text-red-200'
                  : 'bg-white/95 border-amber-200/80 text-gray-800 dark:bg-slate-900/90 dark:border-slate-700 dark:text-gray-100'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
                {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
              </div>
              <p className="flex-1 text-xs sm:text-sm font-medium leading-relaxed break-words">{toast.message}</p>
              <button 
                onClick={() => removeToast(toast.id)}
                className="shrink-0 p-1.5 -mr-1.5 -mt-1 opacity-60 hover:opacity-100 transition-opacity rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
