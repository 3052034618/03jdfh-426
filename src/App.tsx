import { useState, useEffect } from 'react';
import { Archive, LayoutGrid, BookOpen, Settings } from 'lucide-react';
import { cn } from './lib/utils';
import { useAppStore } from './store/useAppStore';
import { ArchiveLibrary } from './windows/ArchiveLibrary';
import { ClueWall } from './windows/ClueWall';
import { ChapterPreview } from './windows/ChapterPreview';

type TabType = 'archive' | 'clue' | 'chapter';

interface TabConfig {
  id: TabType;
  label: string;
  icon: typeof Archive;
}

const tabs: TabConfig[] = [
  { id: 'archive', label: '档案库', icon: Archive },
  { id: 'clue', label: '线索墙', icon: LayoutGrid },
  { id: 'chapter', label: '章节预览', icon: BookOpen },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('archive');
  const initialize = useAppStore((state) => state.initialize);
  const isLoading = useAppStore((state) => state.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'archive':
        return <ArchiveLibrary />;
      case 'clue':
        return <ClueWall />;
      case 'chapter':
        return <ChapterPreview />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[var(--bg-dark)] noise-bg">
        <div className="text-[var(--text-secondary)] animate-pulse">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-dark)] text-[var(--text-primary)] noise-bg overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-[var(--bg-darker)] border-b border-[var(--line-dashed)] z-10">
        <div className="flex items-center gap-4">
          <h1 
            className="text-xl font-semibold tracking-wider text-[var(--text-primary)]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span className="text-[var(--accent-red)]">CLUE</span> WALL
          </h1>
          <nav className="flex items-center gap-1 ml-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded text-sm transition-all duration-200',
                    'hover:bg-[var(--bg-card)]',
                    isActive 
                      ? 'bg-[var(--bg-card)] text-[var(--accent-red)] border border-[var(--accent-red)]' 
                      : 'text-[var(--text-secondary)] border border-transparent'
                  )}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors">
          <Settings size={18} />
        </button>
      </header>
      <main className="flex-1 overflow-hidden relative z-10">
        <div 
          key={activeTab}
          className="h-full w-full animate-[fade-in_0.3s_ease-out]"
        >
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
