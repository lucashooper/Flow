import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useTimerStore } from '../stores/timerStore';
import type { Task } from '../types';

interface PomodoroTimerProps {
  tasks?: Task[];
  position?: 'inline' | 'floating';
}

export const PomodoroTimer = ({ tasks = [], position = 'floating' }: PomodoroTimerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTaskMenu, setShowTaskMenu] = useState(false);
  
  const { 
    isRunning, 
    secondsLeft, 
    mode, 
    attachedTaskId,
    start, 
    pause, 
    reset,
    tick,
    attachTask 
  } = useTimerStore();

  // Timer tick effect
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      tick();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isRunning, tick]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    const totalSeconds = mode === 'work' ? 25 * 60 : mode === 'break' ? 5 * 60 : 15 * 60;
    return ((totalSeconds - secondsLeft) / totalSeconds) * 100;
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'work': return 'Focus';
      case 'break': return 'Break';
      case 'longBreak': return 'Long Break';
    }
  };

  const attachedTask = tasks.find(t => t.id === attachedTaskId);

  const containerClass = position === 'floating'
    ? 'fixed bottom-6 right-6 z-40'
    : 'w-full';

  // Collapsed view
  if (!isExpanded) {
    return (
      <motion.div
        className={containerClass}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={() => setIsExpanded(true)}
          className="relative flex items-center gap-3 px-4 py-3 rounded-full cursor-pointer select-none"
          style={{
            background: 'rgba(18, 18, 18, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 122, 24, 0.2)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Pulsing ring when running */}
          {isRunning && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                border: '2px solid rgba(255, 122, 24, 0.5)',
              }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
          
          <Clock className="w-4 h-4 text-[#ff7a18]" />
          <span className="text-[#e5e5e5] text-sm font-medium">
            {formatTime(secondsLeft)}
          </span>
          {attachedTask && (
            <span className="text-[#888888] text-xs max-w-[120px] truncate">
              {attachedTask.title}
            </span>
          )}
        </motion.button>
      </motion.div>
    );
  }

  // Expanded view
  return (
    <motion.div
      className={containerClass}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div
        className="rounded-2xl p-6 min-w-[320px]"
        style={{
          background: 'rgba(18, 18, 18, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 122, 24, 0.15)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#ff7a18]" />
            <h3 className="text-[#e5e5e5] font-semibold">{getModeLabel()}</h3>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ cursor: 'pointer' }}
          >
            <ChevronDown className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Circular Progress */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="#ff7a18"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={2 * Math.PI * 88 * (1 - getProgress() / 100)}
              initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - getProgress() / 100) }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </svg>
          
          {/* Time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold text-[#e5e5e5]">
              {formatTime(secondsLeft)}
            </span>
            {attachedTask && (
              <span className="text-xs text-[#888888] mt-2 max-w-[140px] text-center truncate">
                {attachedTask.title}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <motion.button
            onClick={isRunning ? pause : start}
            className="p-3 rounded-full"
            style={{
              background: '#ff7a18',
              cursor: 'pointer',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRunning ? (
              <Pause className="w-5 h-5 text-white" fill="white" />
            ) : (
              <Play className="w-5 h-5 text-white" fill="white" />
            )}
          </motion.button>
          
          <motion.button
            onClick={reset}
            className="p-3 rounded-full"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              cursor: 'pointer',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-5 h-5 text-[#888888]" />
          </motion.button>
        </div>

        {/* Task Attachment */}
        {tasks.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowTaskMenu(!showTaskMenu)}
              className="w-full px-4 py-2 rounded-lg text-sm text-left flex items-center justify-between"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
              }}
            >
              <span className="text-[#888888] truncate">
                {attachedTask ? attachedTask.title : 'Attach to task...'}
              </span>
              <ChevronUp className={`w-4 h-4 text-[#888888] transition-transform ${showTaskMenu ? '' : 'rotate-180'}`} />
            </button>

            <AnimatePresence>
              {showTaskMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full left-0 right-0 mb-2 rounded-lg py-1 max-h-[200px] overflow-y-auto z-50"
                  style={{
                    background: 'rgba(18, 18, 18, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <button
                    onClick={() => {
                      attachTask(null);
                      setShowTaskMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#888888] hover:bg-white/5 transition-colors"
                    style={{ cursor: 'pointer' }}
                  >
                    None
                  </button>
                  {tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => {
                        attachTask(task.id);
                        setShowTaskMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-[#e5e5e5] hover:bg-white/5 transition-colors flex items-center gap-2"
                      style={{ cursor: 'pointer' }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ 
                          backgroundColor: task.priority === 1 ? '#ef4444' : task.priority === 2 ? '#ff7a18' : '#22c55e' 
                        }} 
                      />
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};
