import { useEffect, useRef } from 'react';
import { X, Download, Copy, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng } from 'html-to-image';

interface Card {
  id: string;
  title: string;
  minutes: number;
  rating: number;
  tags: string[];
  note: string;
  background: string;
  createdAt: string;
}

interface CardViewerProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CardViewer = ({ card, isOpen, onClose }: CardViewerProps) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });
      
      const link = document.createElement('a');
      const date = new Date(card!.createdAt).toISOString().split('T')[0];
      link.download = `flow-focus-card-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download card:', error);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!cardRef.current) return;
    
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      // Show feedback
      alert('Card copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy card:', error);
      alert('Failed to copy card. Try downloading instead.');
    }
  };

  const handleShare = () => {
    const text = `${card!.minutes} min locked in • Focus ${card!.rating}/5 • Logged in Flow`;
    navigator.clipboard.writeText(text);
    alert('Share text copied to clipboard!');
  };

  if (!isOpen || !card) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.92)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-5xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Action Bar */}
          <div className="absolute -top-16 right-0 flex items-center gap-3 mb-4">
            <button
              onClick={handleShare}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all"
              title="Copy share text"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all"
              title="Copy to clipboard"
            >
              <Copy className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleDownload}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all"
              title="Download PNG"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all"
              title="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Card Preview */}
          <div
            ref={cardRef}
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              aspectRatio: '16/9',
              maxHeight: '80vh',
            }}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={card.background}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
              
              {/* Vignette Effect */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
                }}
              />
              
              {/* Subtle Grain/Noise */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                }}
              />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col justify-between p-8 md:p-12">
              {/* Flow Logo Watermark */}
              <div className="flex justify-between items-start">
                <img 
                  src="/FlowIcon-Main.png" 
                  alt="Flow" 
                  className="w-8 h-8 md:w-10 md:h-10 opacity-20"
                />
                <div className="text-right">
                  <div className="text-xs md:text-sm text-white/40 tracking-wide uppercase font-medium">
                    {new Date(card.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="space-y-6">
                <h1 className="text-4xl md:text-6xl font-semibold text-white leading-[1.1] tracking-[-0.04em]">
                  {card.title}
                </h1>

                {/* Stats */}
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 md:w-18 md:h-18 rounded-full flex items-center justify-center"
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <svg className="w-6 h-6 md:w-7 md:h-7 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-5xl md:text-7xl font-black text-white tabular-nums tracking-tight" style={{ letterSpacing: '-0.03em' }}>
                        {card.minutes}
                      </div>
                      <div className="text-xs md:text-sm text-white/40 font-medium tracking-wider uppercase mt-1">
                        minutes
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-6 h-6 md:w-8 md:h-8 transition-all ${
                          star <= card.rating
                            ? 'drop-shadow-[0_0_8px_rgba(218,165,32,0.3)]'
                            : ''
                        }`}
                        viewBox="0 0 24 24"
                        style={{
                          fill: star <= card.rating 
                            ? 'url(#starGradient)'
                            : 'rgba(255, 255, 255, 0.12)',
                        }}
                      >
                        <defs>
                          <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{ stopColor: '#DAA520', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: '#B8860B', stopOpacity: 1 }} />
                          </linearGradient>
                        </defs>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-4 py-2 rounded-full text-xs md:text-sm text-white/90 font-medium tracking-wide"
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          backdropFilter: 'blur(12px)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reflection */}
                {card.note && (
                  <div className="max-w-2xl">
                    <p className="text-sm md:text-base text-white/60 italic leading-relaxed tracking-wide">
                      "{card.note}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
