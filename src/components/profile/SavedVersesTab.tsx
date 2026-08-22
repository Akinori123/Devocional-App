import { Bookmark, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';

interface SavedVerse {
  id: string;
  reference: string;
  text: string;
  createdAt: Timestamp | null;
}

export function SavedVersesTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [verses, setVerses] = useState<SavedVerse[]>([]);

  useEffect(() => {
    if (!user) return;

    const versesRef = collection(db, 'users', user.uid, 'savedVerses');
    const q = query(versesRef, orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedVerses = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as SavedVerse[];
      setVerses(fetchedVerses);
    }, (error) => {
      console.error("Error loading saved verses:", error);
    });

    return () => unsub();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'savedVerses', id));
    } catch (error) {
      console.error("Error deleting verse:", error);
      toast.error("Não foi possível remover o versículo. Tente novamente.");
    }
  };

  return (
    <div className="p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Versículos Favoritos</h3>
      {verses.length === 0 ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-6">Nenhum versículo salvo ainda.</p>
      ) : (
        verses.map(verse => (
          <div key={verse.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden transition-colors duration-200 group">
            <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 dark:bg-yellow-400" />
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-yellow-900 dark:text-yellow-300 text-sm">{verse.reference}</h4>
              <button 
                onClick={() => handleDelete(verse.id)}
                className="text-gray-400 hover:text-red-500 transition-colors p-1 -mr-1"
                title="Remover versículo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-serif italic text-[15px] leading-relaxed">
              "{verse.text}"
            </p>
          </div>
        ))
      )}
    </div>
  );
}
