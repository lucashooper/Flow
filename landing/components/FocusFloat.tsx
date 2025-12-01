import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimerStore } from '../../src/stores/timerStore';
import { PomodoroTimer } from '../../src/components/PomodoroTimer';

interface FocusFloatProps {
  // Allow overriding enablement from settings if we ever need it
  forcedEnabled?: boolean;
  tasks?: any[]; // optional task list when used inside app
}

export const FocusFloat = ({ forcedEnabled, tasks = [] }: FocusFloatProps) => {
  const { floatingEnabled, isRunning, secondsLeft } = useTimerStore();
  const [isHovering, setIsHovering] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const effectiveEnabled = forcedEnabled ?? floatingEnabled;

  const formatMinutes = (seconds: number) => Math.max(0, Math.floor(seconds / 60));

  // If not enabled and no active modal / running timer, render nothing
  if (!effectiveEnabled && !showTimer && !isRunning) {
    return null;
  }

  const handleClick = () => {
    setShowTimer(true);
  };

  const handleCloseTimer = () => {
    setShowTimer(false);
  };

  return (
    <>
      {/* Bottom-right floating trigger */}
      <AnimatePresence>
        {effectiveEnabled && (
          <motion.div
            key="focus-float-trigger"
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{
              opacity: { duration: 0.16, ease: 'easeInOut' },
              scale: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
            }}
            className="fixed bottom-6 right-6 z-[9999]"
          >
            <button
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              onClick={handleClick}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full select-none"
              style={{
                backdropFilter: 'blur(12px)',
                background: 'rgba(18, 18, 18, 0.9)',
                border: '1px solid rgba(255, 122, 24, 0.35)',
                boxShadow: '0 12px 35px rgba(0, 0, 0, 0.75)',
                cursor: 'pointer',
              }}
            >
              {/* Small circular badge with remaining minutes */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                style={{
                  background: isRunning
                    ? 'linear-gradient(135deg, #f97316, #fb923c)'
                    : 'rgba(38, 38, 38, 0.9)',
                  boxShadow: isRunning
                    ? '0 0 18px rgba(251, 146, 60, 0.65)'
                    : '0 0 10px rgba(0, 0, 0, 0.6)',
                }}
              >
                {isRunning ? formatMinutes(secondsLeft) : '⏱'}
              </div>

              {/* Optional label */}
              <span className="text-xs text-[#e5e5e5]">
                {isRunning ? 'Focus' : 'Start focus'}
              </span>

              {/* Tooltip above when idle */}
              <AnimatePresence>
                {isHovering && !isRunning && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16, ease: 'easeInOut' }}
                    className="absolute bottom-full mb-2 right-0 px-3 py-1.5 rounded-lg text-[11px] text-white/90 whitespace-nowrap"
                    style={{
                      backdropFilter: 'blur(10px)',
                      background: 'rgba(15,15,25,0.9)',
                      border: '1px solid rgba(255,255,255,0.14)',
                    }}
                  >
                    Open focus timer
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timer modal */}
      <AnimatePresence>
        {showTimer && (
          <PomodoroTimer
            isOpen={showTimer}
            onClose={handleCloseTimer}
            tasks={tasks as any}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default FocusFloat;
