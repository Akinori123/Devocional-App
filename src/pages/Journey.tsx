import { useState, useEffect } from 'react';
import { JourneyList } from '../components/journey/JourneyList';
import { DevotionalReader } from '../components/journey/DevotionalReader';
import { CreateDevotional } from '../components/journey/CreateDevotional';
import { DevotionalItem } from '../data/devotionals';
import { useDevotionals } from '../context/DevotionalContext';
import { TabType } from '../types';

type JourneyView = 'list' | 'reader' | 'create';

interface JourneyProps {
  onChangeTab?: (tab: TabType) => void;
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
}

export function Journey({ onChangeTab, onNavigateToBible }: JourneyProps) {
  const { activeDevotional, setActiveDevotional } = useDevotionals();
  const [view, setView] = useState<JourneyView>('list');
  const [selectedDevotional, setSelectedDevotional] = useState<DevotionalItem | null>(null);
  const [isAllRead, setIsAllRead] = useState(false);
  const [createTheme, setCreateTheme] = useState<string | undefined>();

  useEffect(() => {
    if (activeDevotional) {
      setSelectedDevotional(activeDevotional);
      setIsAllRead(false);
      setView('reader');
      setActiveDevotional(null); // consume it
    }
  }, [activeDevotional, setActiveDevotional]);

  const handleSelectDevotional = (devotional: DevotionalItem, allRead: boolean) => {
    setSelectedDevotional(devotional);
    setIsAllRead(allRead);
    setView('reader');
  };

  const handleCreateNew = (theme?: string) => {
    setCreateTheme(theme);
    setView('create');
  };

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-slate-900 h-full overflow-y-auto transition-colors duration-200">
      {view === 'list' && (
        <JourneyList 
          onSelectDevotional={handleSelectDevotional} 
          onCreateNew={handleCreateNew}
          onChangeTab={onChangeTab}
        />
      )}
      
      {view === 'reader' && selectedDevotional && (
        <DevotionalReader 
          devotional={selectedDevotional} 
          isAllRead={isAllRead}
          onChangeTab={onChangeTab}
          onNavigateToBible={onNavigateToBible}
          onCreateNew={handleCreateNew}
          onGenerated={(newDev) => {
            setSelectedDevotional(newDev);
            setIsAllRead(false);
          }}
          onBack={() => {
            setSelectedDevotional(null);
            setView('list');
          }} 
        />
      )}
      
      {view === 'create' && (
        <CreateDevotional onBack={() => setView('list')} initialTheme={createTheme} onChangeTab={onChangeTab} />
      )}
    </div>
  );
}
