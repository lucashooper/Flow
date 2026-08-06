import { Minimize2, Maximize2, SunDim, Pencil, Timer, Menu, MoreVertical, FileText, CreditCard, CheckCircle, Volume2, TrendingUp, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { SyncStatus } from './SyncStatus';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';
import { DraggableTab } from './DraggableTab';
import { useFocusMode } from '../contexts/FocusModeContext';
import { CardsModal } from './CardsModal';
import { useTimerStore } from '../stores/timerStore';
import { readPluginSetting } from '../utils/pluginSettings';

interface EditorHeaderProps {
  openNotes: Note[];
  activeNoteId: string | null;
  tabsEnabled: boolean;
  onTabClick: (noteId: string) => void;
  onTabClose: (noteId: string) => void;
  isTimerVisible: boolean;
  setIsTimerVisible: (value: boolean) => void;
  isTasksVisible: boolean;
  setIsTasksVisible: (value: boolean) => void;
  isAmbientVisible?: boolean;
  setIsAmbientVisible?: (value: boolean) => void;
  isStatsVisible?: boolean;
  setIsStatsVisible?: (value: boolean) => void;
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  isPlannerOpen?: boolean;
  onTogglePlanner?: () => void;
}

export const EditorHeader = ({ 
  openNotes,
  activeNoteId,
  tabsEnabled,
  onTabClick,
  onTabClose,
  isTimerVisible,
  setIsTimerVisible,
  isTasksVisible,
  setIsTasksVisible,
  isAmbientVisible,
  setIsAmbientVisible,
  isStatsVisible,
  setIsStatsVisible,
  isMobile = false,
  onOpenSidebar,
  isPlannerOpen = false,
  onTogglePlanner,
}: EditorHeaderProps) => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { isDimMode, toggleDimMode, isFullscreen, toggleFullscreen } = useFocusMode();

  const syncPluginFlags = useCallback(() => {
    setFocusModeEnabled(readPluginSetting('focusModeEnabled', true));
    setFullscreenModeEnabled(readPluginSetting('fullscreenModeEnabled', true));
    setPomodoroEnabled(readPluginSetting('pomodoroEnabled', true));
    setWordCountEnabled(readPluginSetting('wordCountEnabled', true));
    setDrawingModeEnabled(readPluginSetting('drawingModeEnabled', true));
    setCardsEnabled(readPluginSetting('cardsEnabled', false));
    setSyncIndicatorEnabled(readPluginSetting('syncIndicatorEnabled', false));
    setAmbientSoundsEnabled(readPluginSetting('ambientSoundsEnabled', true));
    setFocusStatsEnabled(readPluginSetting('focusStatsEnabled', true));
    setPlannerEnabled(readPluginSetting('plannerEnabled', true));
  }, []);

  const [focusModeEnabled, setFocusModeEnabled] = useState(() => readPluginSetting('focusModeEnabled', true));
  const [fullscreenModeEnabled, setFullscreenModeEnabled] = useState(() => readPluginSetting('fullscreenModeEnabled', true));
  const [pomodoroEnabled, setPomodoroEnabled] = useState(() => readPluginSetting('pomodoroEnabled', true));
  const [wordCountEnabled, setWordCountEnabled] = useState(() => readPluginSetting('wordCountEnabled', true));
  const [drawingModeEnabled, setDrawingModeEnabled] = useState(() => readPluginSetting('drawingModeEnabled', true));
  const [cardsEnabled, setCardsEnabled] = useState(() => readPluginSetting('cardsEnabled', false));
  const [syncIndicatorEnabled, setSyncIndicatorEnabled] = useState(() => readPluginSetting('syncIndicatorEnabled', false));
  const [ambientSoundsEnabled, setAmbientSoundsEnabled] = useState(() => readPluginSetting('ambientSoundsEnabled', true));
  const [focusStatsEnabled, setFocusStatsEnabled] = useState(() => readPluginSetting('focusStatsEnabled', true));
  const [plannerEnabled, setPlannerEnabled] = useState(() => readPluginSetting('plannerEnabled', true));

  useEffect(() => {
    syncPluginFlags();
    window.addEventListener('pluginSettingsChanged', syncPluginFlags);
    window.addEventListener('storage', syncPluginFlags);
    return () => {
      window.removeEventListener('pluginSettingsChanged', syncPluginFlags);
      window.removeEventListener('storage', syncPluginFlags);
    };
  }, [syncPluginFlags]);

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
                  onClick={toggleDimMode}
                  className={`focus-toggle nav-item p-2 rounded transition-colors ${
                    isDimMode ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                  }`}
                  style={{ color: isDimMode ? 'var(--accent)' : 'var(--muted)' }}
                  title="Dim sidebar & inactive tabs"
                >
                  <SunDim className="w-4 h-4" />
                </button>
              )}
              {fullscreenModeEnabled && (
                <button
                  onClick={toggleFullscreen}
                  className={`fullscreen-toggle nav-item p-2 rounded transition-colors ${
                    isFullscreen ? 'bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'
                  }`}
                  style={{ color: isFullscreen ? 'var(--accent)' : 'var(--muted)' }}
                  title="Fullscreen presentation (Esc to exit)"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
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
              <button
                onClick={() => setIsTasksVisible(!isTasksVisible)}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                title="Toggle Tasks"
              >
                <CheckCircle className="w-5 h-5 text-[#888888]" />
              </button>
              {plannerEnabled && onTogglePlanner && (
                <button
                  onClick={onTogglePlanner}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  title="Toggle Planner"
                >
                  {isPlannerOpen ? <PanelRightClose className="w-5 h-5 text-[#888888]" /> : <PanelRightOpen className="w-5 h-5 text-[#888888]" />}
                </button>
              )}
              {ambientSoundsEnabled && setIsAmbientVisible && (
                <button
                  onClick={() => setIsAmbientVisible(!isAmbientVisible)}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  title="Toggle Ambient Sounds"
                >
                  <Volume2 className="w-5 h-5 text-[#888888]" />
                </button>
              )}
              {focusStatsEnabled && setIsStatsVisible && (
                <button
                  onClick={() => setIsStatsVisible(!isStatsVisible)}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                  title="Toggle Focus Stats"
                >
                  <TrendingUp className="w-5 h-5 text-[#888888]" />
                </button>
              )}
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
                        toggleDimMode();
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <SunDim className="w-5 h-5" />
                      <span>{isDimMode ? 'Exit dim mode' : 'Dim sidebar'}</span>
                    </button>
                  )}
                  {fullscreenModeEnabled && (
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                      <span>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
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
                  {plannerEnabled && onTogglePlanner && (
                    <button
                      onClick={() => {
                        onTogglePlanner();
                        setShowMobileMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                      style={{ color: 'var(--text)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elev)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {isPlannerOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                      <span>Planner</span>
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
