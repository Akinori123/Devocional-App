import { PenLine, Calendar, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot, doc, setDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '../../context/ToastContext';

interface DiaryNote {
  id: string;
  title: string;
  text: string;
  createdAt: Timestamp | null;
}

export function DiaryTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const notesRef = collection(db, 'users', user.uid, 'diaryNotes');
    const q = query(notesRef, orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DiaryNote[];
      setNotes(fetchedNotes);
    }, (error) => {
      console.error("Error loading diary notes:", error);
    });

    return () => unsub();
  }, [user]);

  const handleSave = async () => {
    if (!user || !newText.trim()) return;
    
    setIsSaving(true);
    try {
      const noteRef = doc(collection(db, 'users', user.uid, 'diaryNotes'));
      await setDoc(noteRef, {
        title: newTitle.trim(),
        text: newText.trim(),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewTitle('');
      setNewText('');
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar anotação. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Hoje';
    return format(timestamp.toDate(), "dd MMM yyyy", { locale: ptBR });
  };

  return (
    <div className="p-5 space-y-4">
      <button 
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-900/50 text-yellow-700 dark:text-yellow-400 py-4 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors active:scale-95"
      >
        <PenLine className="w-5 h-5" />
        ✍️ Escrever para Deus...
      </button>

      <div className="space-y-3 mt-6">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Suas Reflexões</h3>
        {notes.length === 0 ? (
          <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">Seu diário está em branco. Feche os olhos, respire fundo e escreva o que Deus ministrou ao seu coração hoje.</p>
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-medium mb-2">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(note.createdAt)}
              </div>
              {note.title && <h4 className="font-bold text-gray-900 dark:text-white mb-1">{note.title}</h4>}
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{note.text}</p>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95 shadow-2xl transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">✍️ Escrever para Deus...</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Título (opcional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
              />
              <textarea 
                placeholder="O que Deus falou ao seu coração hoje?"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={5}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none transition-colors"
              ></textarea>
              
              <button 
                onClick={handleSave}
                disabled={isSaving || !newText.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-3.5 rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
