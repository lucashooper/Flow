import { useEffect, useState } from 'react';

interface FloatingTimerProps {
  isVisible: boolean;
  onClose: () => void;
}

// Simple 25:00 countdown timer with premium glassmorphic styling
export const FloatingTimer = ({ isVisible, onClose }: FloatingTimerProps) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (secondsLeft === 0) {
      setIsRunning(false);
    }
  }, [secondsLeft]);

  if (!isVisible) return null;

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  const progress = 1 - secondsLeft / (25 * 60);
  const strokeDasharray = 100;
  const strokeDashoffset = strokeDasharray * (1 - progress);

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <div
        className="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-2xl"
        style={{
          backdropFilter: 'blur(16px)',
          background:
            'radial-gradient(circle at top left, rgba(251, 146, 60, 0.22), transparent 55%), rgba(12,12,15,0.94)',
          border: '1px solid rgba(248, 250, 252, 0.12)',
          boxShadow:
            '0 18px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,250,252,0.04)',
        }}
      >
        {/* Circular progress */}
        <div className="relative w-10 h-10 flex items-center justify-center">
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
        <div className="flex flex-col min-w-[120px]">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-mono text-lg tracking-tight">
              {minutes}:{seconds}
            </span>
            <span className="text-[10px] uppercase text-gray-400">
              Focus
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <button
              className="px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-[11px] font-semibold text-black shadow-md hover:brightness-110 active:scale-[0.97] transition"
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              className="px-2.5 py-1 rounded-full bg-[#18181b] text-[11px] text-gray-200 border border-white/10 hover:bg-[#27272f] active:scale-[0.97] transition"
              onClick={() => {
                setSecondsLeft(25 * 60);
                setIsRunning(false);
              }}
            >
              Reset
            </button>
            <button
              className="ml-0.5 px-1.5 py-1 rounded-full text-[11px] text-gray-400 hover:text-gray-100 hover:bg-white/5 active:scale-[0.97] transition"
              onClick={() => {
                setIsRunning(false);
                onClose();
              }}
              aria-label="Close timer"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingTimer;
