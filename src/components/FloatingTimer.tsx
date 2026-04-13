import { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';

interface FloatingTimerProps {
  isVisible: boolean;
  onClose: () => void;
}

// Simple 25:00 countdown timer with premium glassmorphic styling
export const FloatingTimer = ({ isVisible, onClose }: FloatingTimerProps) => {
  const nodeRef = useRef(null);
  const [customDuration, setCustomDuration] = useState(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('timerExpanded');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [showLogButton, setShowLogButton] = useState(false);
  const [completedMinutes, setCompletedMinutes] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (secondsLeft === 0 && isRunning) {
      setIsRunning(false);
      
      // Calculate actual minutes worked (convert seconds to minutes with decimals)
      const minutesWorked = sessionStartTime 
        ? parseFloat(((Date.now() - sessionStartTime) / 60000).toFixed(2))
        : parseFloat((customDuration / 60).toFixed(2));
      
      console.log('⏱️ [FloatingTimer] Session completed:', { 
        customDuration, 
        customDurationMinutes: customDuration / 60,
        minutesWorked 
      });
      
      setCompletedMinutes(minutesWorked);
      setShowLogButton(true);
      setSessionStartTime(null);
    }
  }, [secondsLeft, isRunning, customDuration, sessionStartTime]);

  if (!isVisible) return null;

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  const progress = 1 - secondsLeft / customDuration;
  const strokeDasharray = 100;
  const strokeDashoffset = strokeDasharray * (1 - progress);

  const timePresets = [
    { label: '10s', seconds: 10 },
    { label: '5m', seconds: 5 * 60 },
    { label: '10m', seconds: 10 * 60 },
    { label: '15m', seconds: 15 * 60 },
    { label: '20m', seconds: 20 * 60 },
    { label: '25m', seconds: 25 * 60 },
  ];

  const setPresetTime = (seconds: number) => {
    setCustomDuration(seconds);
    setSecondsLeft(seconds);
    setIsRunning(false);
    setShowTimePicker(false);
    setSessionStartTime(null);
    setShowLogButton(false);
  };

  const handleLogSession = (rating: number) => {
    console.log('🎯 [FloatingTimer] Dispatching pomodoroCompleted event:', { minutes: completedMinutes, rating });
    
    // Dispatch event for Focus Cards
    const event = new CustomEvent('pomodoroCompleted', {
      detail: { minutes: completedMinutes, rating }
    });
    window.dispatchEvent(event);
    
    console.log('✅ [FloatingTimer] Event dispatched successfully');
    
    // Reset timer
    setShowLogButton(false);
    setSecondsLeft(customDuration);
  };

  const handleSkipLog = () => {
    setShowLogButton(false);
    setSecondsLeft(customDuration);
  };

  const handleStart = () => {
    if (!isRunning) {
      setSessionStartTime(Date.now());
    }
    setIsRunning(!isRunning);
  };

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    localStorage.setItem('timerExpanded', JSON.stringify(newValue));
  };

  return (
    <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
      <div ref={nodeRef} className="fixed bottom-6 right-6 z-[9999]">
        <div
          className="drag-handle relative flex items-center gap-3 rounded-2xl text-sm text-white shadow-2xl cursor-move transition-all"
        style={{
          backdropFilter: 'blur(16px)',
          background:
            'radial-gradient(circle at top left, rgba(251, 146, 60, 0.22), transparent 55%), rgba(12,12,15,0.94)',
          border: '1px solid rgba(248, 250, 252, 0.12)',
          boxShadow:
            '0 18px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,250,252,0.04)',
          padding: isExpanded ? '12px 16px' : '8px 12px',
        }}
        onClick={toggleExpanded}
      >
        {/* Circular progress */}
        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
          <svg
            className="w-10 h-10 -rotate-90"
            viewBox="0 0 36 36"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="rgba(63,63,70,0.8)"
              strokeWidth="3.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="url(#timerGradient)"
              strokeWidth="3.5"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="timerGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#fde68a" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-medium text-gray-200">
              {isRunning ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Time + controls */}
        <div className="flex flex-col" style={{ minWidth: isExpanded ? '120px' : 'auto' }}>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-mono text-lg tracking-tight">
              {minutes}:{seconds}
            </span>
            {isExpanded && (
              <span className="text-[10px] uppercase text-gray-400">
                Focus
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="mt-2 flex items-center gap-1.5">
              {!showLogButton ? (
                <>
                  <button
                    className="px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-[11px] font-semibold text-black shadow-md hover:brightness-110 active:scale-[0.97] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStart();
                    }}
                  >
                    {isRunning ? 'Pause' : 'Start'}
                  </button>
                  <button
                    className="px-2.5 py-1 rounded-full bg-[#18181b] text-[11px] text-gray-200 border border-white/10 hover:bg-[#27272f] active:scale-[0.97] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSecondsLeft(customDuration);
                      setIsRunning(false);
                      setSessionStartTime(null);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    className="px-2 py-1 rounded-full bg-[#18181b] text-[11px] text-gray-200 border border-white/10 hover:bg-[#27272f] active:scale-[0.97] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTimePicker(!showTimePicker);
                    }}
                    title="Change duration"
                  >
                    :
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-[11px] font-semibold text-black shadow-md hover:brightness-110 active:scale-[0.97] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogSession(3);
                    }}
                    title="Log session (3 stars)"
                  >
                    ✓ Log
                  </button>
                  <button
                    className="px-2.5 py-1 rounded-full bg-[#18181b] text-[11px] text-gray-200 border border-white/10 hover:bg-[#27272f] active:scale-[0.97] transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkipLog();
                    }}
                  >
                    Skip
                  </button>
                </>
              )}
              <button
                className="ml-0.5 px-1.5 py-1 rounded-full text-[11px] text-gray-400 hover:text-gray-100 hover:bg-white/5 active:scale-[0.97] transition"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRunning(false);
                  onClose();
                }}
                aria-label="Close timer"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Time Picker Dropdown */}
        {showTimePicker && isExpanded && (
          <div
            className="absolute bottom-full right-0 mb-2 rounded-lg p-2 shadow-2xl"
            style={{
              backdropFilter: 'blur(16px)',
              background: 'rgba(12,12,15,0.95)',
              border: '1px solid rgba(248, 250, 252, 0.12)',
              boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {timePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setPresetTime(preset.seconds)}
                  className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
                    customDuration === preset.seconds
                      ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-black'
                      : 'bg-[#18181b] text-gray-200 hover:bg-[#27272f]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </Draggable>
  );
};

export default FloatingTimer;
