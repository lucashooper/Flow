import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface PomodoroCompletionToastProps {
  minutes: number;
  onCreateCard: (rating: number) => void;
  onDismiss: () => void;
}

export const PomodoroCompletionToast = ({ minutes, onCreateCard, onDismiss }: PomodoroCompletionToastProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  // Auto-dismiss after 30 seconds if no interaction
  useEffect(() => {
    const timeout = setTimeout(onDismiss, 30000);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  const handleQuickLog = () => {
    if (rating === 0) {
      // If no rating selected, default to 3 stars
      onCreateCard(3);
    } else {
      onCreateCard(rating);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[150] w-[380px]"
      >
        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{
            background: 'rgba(26, 26, 26, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(160, 82, 45, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Focus Session Complete! 🎉</h3>
              <p className="text-sm text-white/60">
                {minutes} minutes locked in
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Quick Rating */}
          <div className="mb-4">
            <p className="text-xs text-white/50 mb-2 uppercase tracking-wide">How was your focus?</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-transform hover:scale-110"
                >
                  <svg
                    className="w-8 h-8 transition-all"
                    viewBox="0 0 24 24"
                    style={{
                      fill: star <= (hoveredStar || rating)
                        ? 'url(#starGradientToast)'
                        : 'rgba(255, 255, 255, 0.15)',
                      filter: star <= (hoveredStar || rating)
                        ? 'drop-shadow(0 0 8px rgba(218,165,32,0.3))'
                        : 'none',
                    }}
                  >
                    <defs>
                      <linearGradient id="starGradientToast" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#DAA520', stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: '#B8860B', stopOpacity: 1 }} />
                      </linearGradient>
                    </defs>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleQuickLog}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #A0522D 0%, #8B4513 100%)',
                boxShadow: '0 4px 16px rgba(160, 82, 45, 0.3)',
              }}
            >
              Log Session
            </button>
          </div>

          <p className="text-xs text-white/40 mt-3 text-center">
            Quick log or customize in Focus Cards
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
