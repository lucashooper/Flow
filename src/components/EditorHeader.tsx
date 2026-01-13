import { Minimize2, Pencil, Timer, Menu, MoreVertical, FileText, CreditCard } from 'lucide-react';
import { SyncStatus } from './SyncStatus';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect } from 'react';
import type { Note } from '../types';
import { DraggableTab } from './DraggableTab';
import { useFocusMode } from '../contexts/FocusModeContext';
import { CardsModal } from './CardsModal';
import { useTimerStore } from '../stores/timerStore';

interface EditorHeaderProps {
  openNotes: Note[];
  activeNoteId: string | null;
  tabsEnabled: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
  isTimerVisible: boolean;
  setIsTimerVisible: (value: boolean) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
}

export const EditorHeader = ({ 
  openNotes,
  activeNoteId,
  tabsEnabled,
  onTabClick,
  onTabClose,
  isTimerVisible,
  setIsTimerVisible,
  isMobile = false,
  onOpenSidebar,
}: EditorHeaderProps) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  
  // Check plugin states from localStorage
  const focusModeEnabled = (() => {
    const saved = localStorage.getItem('focusModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();
  
  const pomodoroEnabled = (() => {
    const saved = localStorage.getItem('pomodoroEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();

  const wordCountEnabled = (() => {
    const saved = localStorage.getItem('wordCountEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();

  const drawingModeEnabled = (() => {
    const saved = localStorage.getItem('drawingModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  })();

  const cardsEnabled = (() => {
    const saved = localStorage.getItem('cardsEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  })();

  const syncIndicatorEnabled = (() => {
    const saved = localStorage.getItem('syncIndicatorEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  })();

  const [showCardsModal, setShowCardsModal] = useState(false);
  const { resetSession } = useTimerStore();

  // Global event listener for Pomodoro completion (always active)
  useEffect(() => {
    const handlePomodoroComplete = (e: Event) => {
      console.log('📥 [EditorHeader] Received pomodoroCompleted event:', e);
      
      const customEvent = e as CustomEvent;
      const { minutes: mins, rating } = customEvent.detail;
      
      console.log('📊 [EditorHeader] Event details:', { minutes: mins, rating });
      console.log('🔢 [EditorHeader] Minutes type:', typeof mins, 'Value:', mins);
      
      // Create card directly
      const newCard = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: 'Lock-in Session',
        minutes: mins,
        rating: rating || 3,
        tags: [],
        note: '',
        background: '/cards/Cool-Vinland-Saga-image.jpg',
        createdAt: new Date().toISOString(),
      };

      console.log('💾 [EditorHeader] Creating new card:', newCard);

      const saved = localStorage.getItem('flowCards');
      const existingCards = saved ? JSON.parse(saved) : [];
      const updatedCards = [newCard, ...existingCards];
      localStorage.setItem('flowCards', JSON.stringify(updatedCards));
      
      console.log('✅ [EditorHeader] Card saved successfully. Total cards:', updatedCards.length);
      
      resetSession();
      
      // Auto-open Cards modal to Create tab with pre-populated form
      setShowCardsModal(true);
      
      // Dispatch event to pre-populate form
      window.dispatchEvent(new CustomEvent('cardCreatedFromPomodoro', {
        detail: { minutes: mins, rating }
      }));
    };

    console.log('👂 [EditorHeader] Event listener attached for pomodoroCompleted');
    window.addEventListener('pomodoroCompleted', handlePomodoroComplete);
    return () => {
      console.log('🔇 [EditorHeader] Event listener removed');
      window.removeEventListener('pomodoroCompleted', handlePomodoroComplete);
    };
  }, [resetSession]);

  return (
    <>
      <div className="tabs top-nav border-b border-subtle px-3 flex items-center">
        {/* Mobile Hamburger */}
        {isMobile && onOpenSidebar && (
          <button
            onClick={onOpenSidebar}
            className="p-2 mr-2 rounded-lg transition-colors"
            style={{ color: 'var(--text)', minWidth: '44px', minHeight: '44px' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Tabs area - flush contiguous tabs like Chrome/Obsidian */}
        {tabsEnabled && openNotes.length > 0 && (
          <SortableContext items={openNotes.map(n => `tab-${n.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="flex items-end flex-1 overflow-x-auto scrollbar-hide">
              {openNotes.map((note) => (
                <DraggableTab
                  key={note.id}
                  note={note}
                  isActive={activeNoteId === note.id}
                  onTabClick={onTabClick}
                  onTabClose={onTabClose}
                />
              ))}
            </div>
          </SortableContext>
        )}

        {/* Right-side actions */}
        <div className="ml-auto nav-actions flex items-center gap-1.5">
          {!isMobile ? (
            // Desktop: Show all icons
            <>
              {focusModeEnabled && (
                <button
                  onClick={toggleFocusMode}
                  className={`nav-item p-2 rounded transition-colors ${
                    isFocusMode ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                  }`}
                  style={{ color: isFocusMode ? 'var(--accent)' : 'var(--muted)' }}
                  title="Toggle Focus Mode"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              {drawingModeEnabled && (
                <button
                  onClick={() => window.dispatchEvent(new Event('toggleDrawingMode'))}
                  className="nav-item p-2 rounded hover:bg-[#1a1a1a] transition-colors"
                  style={{ color: 'var(--muted)' }}
                  title="Toggle Drawing Mode"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {syncIndicatorEnabled && (
                <SyncStatus />
              )}
              <button
                onClick={() => setIsTimerVisible(!isTimerVisible)}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="Toggle Timer"
              >
                <Timer className="w-5 h-5 text-[#888888]" />
              </button>
              {wordCountEnabled && (
                <button
                  onClick={() => window.dispatchEvent(new Event('toggleWordCount'))}
                  className="nav-item p-2 rounded hover:bg-[#1a1a1a] transition-colors"
                  style={{ color: 'var(--muted)' }}
                  title="Toggle Word Count"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              {cardsEnabled && (
                <button
                  onClick={() => setShowCardsModal(true)}
                  className="nav-item p-2 rounded hover:bg-[#1a1a1a] transition-colors"
                  style={{ color: 'var(--muted)' }}
                  title="Focus Cards"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            // Mobile: Show more menu
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="nav-item p-2 rounded hover:bg-[#1a1a1a] text-[#888888] transition-colors"
                title="More options"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMobileMenu && (
                <div 
                  className="absolute right-0 top-full mt-2 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
                  style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)' }}
                >
                  {focusModeEnabled && (
                    <button
                      onClick={() => {
                        toggleFocusMode();
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Minimize2 className="w-5 h-5" />
                      <span>Focus Mode</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowMobileMenu(false)}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                    style={{ color: 'var(--text)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Pencil className="w-5 h-5" />
                    <span>Draw Mode</span>
                  </button>
                  {pomodoroEnabled && (
                    <button
                      onClick={() => {
                        setIsTimerVisible(!isTimerVisible);
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Timer className="w-5 h-5" />
                      <span>Pomodoro Timer</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Cards Modal */}
      <CardsModal isOpen={showCardsModal} onClose={() => setShowCardsModal(false)} />
    </>
  );
};
