import { useEffect, useState } from 'react';
import { Coffee, X } from 'lucide-react';

interface BreakReminderProps {
  enabled: boolean;
  intervalMinutes?: number;
}

export const BreakReminder = ({ enabled, intervalMinutes = 50 }: BreakReminderProps) => {
  const [showReminder, setShowReminder] = useState(false);
  const [lastBreakTime, setLastBreakTime] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const minutesSinceBreak = (now - lastBreakTime) / (1000 * 60);

      if (minutesSinceBreak >= intervalMinutes) {
        setShowReminder(true);
        
        // Browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Time for a break! ☕', {
            body: `You've been working for ${intervalMinutes} minutes. Take a short break to stay fresh.`,
            icon: '/FlowIcon-Main.png',
            tag: 'break-reminder',
          });
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [enabled, intervalMinutes, lastBreakTime]);

  const handleTakeBreak = () => {
    setShowReminder(false);
    setLastBreakTime(Date.now());
  };

  const handleDismiss = () => {
    setShowReminder(false);
    setLastBreakTime(Date.now());
  };

  // Request notification permission on mount
  useEffect(() => {
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [enabled]);

  if (!showReminder) return null;

  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000]">
      <div
        className="relative rounded-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300"
        style={{
          backdropFilter: 'blur(16px)',
          background:
            'radial-gradient(circle at top left, rgba(251, 146, 60, 0.22), transparent 55%), rgba(12,12,15,0.96)',
          border: '1px solid rgba(248, 250, 252, 0.12)',
          boxShadow:
            '0 25px 50px rgba(0,0,0,0.9), 0 0 0 1px rgba(248,250,252,0.04)',
          minWidth: '320px',
        }}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
            <Coffee className="w-8 h-8 text-white" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-2">Time for a break!</h3>
            <p className="text-sm text-gray-300">
              You've been working for {intervalMinutes} minutes. Taking short breaks helps maintain focus and productivity.
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleTakeBreak}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-400 text-sm font-semibold text-black hover:brightness-110 transition-all"
            >
              Take a 5 min break
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 rounded-lg bg-white/5 text-sm text-gray-300 hover:bg-white/10 border border-white/10 transition-all"
            >
              Later
            </button>
          </div>

          <p className="text-xs text-gray-500">
            💡 Tip: Stand up, stretch, or grab some water
          </p>
        </div>
      </div>
    </div>
  );
};
