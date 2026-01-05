import { useState, useEffect } from 'react';
import { X, Upload, Star, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardViewer } from './CardViewer';

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

interface CardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_BACKGROUNDS = [
  '/cards/Cool-Vinland-Saga-image.jpg',
  // Add more preset backgrounds here as needed
];

const QUICK_TAGS = ['Writing', 'Research', 'Reading', 'Coding', 'Planning', 'Review'];

export const CardsModal = ({ isOpen, onClose }: CardsModalProps) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  
  // Form state
  const [title, setTitle] = useState('Lock-in Session');
  const [minutes, setMinutes] = useState(0);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [selectedBackground, setSelectedBackground] = useState(PRESET_BACKGROUNDS[0]);
  const [customBackground, setCustomBackground] = useState<string | null>(null);

  // Load cards from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('flowCards');
    if (saved) {
      try {
        setCards(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load cards:', e);
      }
    }
  }, []);

  // Reload cards when modal opens to show newly created cards
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('flowCards');
      if (saved) {
        try {
          setCards(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to reload cards:', e);
        }
      }
      // Switch to History tab when opened from Pomodoro
      setActiveTab('history');
    }
  }, [isOpen]);

  // Listen for Pomodoro card creation to pre-populate form
  useEffect(() => {
    const handleCardFromPomodoro = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { minutes: mins, rating: rat } = customEvent.detail;
      
      console.log('📝 [CardsModal] Pre-populating form with:', { minutes: mins, rating: rat });
      
      // Pre-populate form fields
      setMinutes(mins);
      setRating(rat);
    };

    window.addEventListener('cardCreatedFromPomodoro', handleCardFromPomodoro);
    return () => window.removeEventListener('cardCreatedFromPomodoro', handleCardFromPomodoro);
  }, []);

  // Save cards to localStorage
  const saveCards = (newCards: Card[]) => {
    localStorage.setItem('flowCards', JSON.stringify(newCards));
    setCards(newCards);
  };

  const handleCreateCard = () => {
    if (minutes <= 0) {
      alert('Please enter time locked in');
      return;
    }
    if (rating === 0) {
      alert('Please select a focus rating');
      return;
    }

    const newCard: Card = {
      id: Date.now().toString(),
      title,
      minutes,
      rating,
      tags: selectedTags,
      note,
      background: customBackground || selectedBackground,
      createdAt: new Date().toISOString(),
    };

    saveCards([newCard, ...cards]);
    
    // Reset form
    setTitle('Lock-in Session');
    setMinutes(0);
    setRating(0);
    setSelectedTags([]);
    setNote('');
    setCustomBackground(null);
    
    // Switch to history tab
    setActiveTab('history');
  };


  const handleDeleteCard = (id: string) => {
    saveCards(cards.filter(c => c.id !== id));
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataURL = event.target?.result as string;
      setCustomBackground(dataURL);
      setSelectedBackground(dataURL);
    };
    reader.readAsDataURL(file);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
          style={{
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <h2 className="text-2xl font-semibold text-[#e5e5e5]">Focus Cards</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#252525] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#888888]" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-8 pt-6">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'create'
                  ? 'bg-[#A0522D] text-white'
                  : 'text-[#888888] hover:text-[#e5e5e5] hover:bg-[#252525]'
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-[#A0522D] text-white'
                  : 'text-[#888888] hover:text-[#e5e5e5] hover:bg-[#252525]'
              }`}
            >
              History ({cards.length})
            </button>
          </div>

          {/* Content */}
          <div 
            className="overflow-y-auto px-8 py-6" 
            style={{ 
              maxHeight: 'calc(90vh - 180px)'
            }}
          >
            <style>{`
              .overflow-y-auto::-webkit-scrollbar {
                width: 6px;
              }
              .overflow-y-auto::-webkit-scrollbar-track {
                background: transparent;
              }
              .overflow-y-auto::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 3px;
              }
              .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.25);
              }
            `}</style>
            {activeTab === 'create' ? (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                    Session Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#A0522D] transition-colors"
                    placeholder="Lock-in Session"
                  />
                </div>

                {/* Time & Rating */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                      <Clock className="w-4 h-4 inline mr-2" />
                      Time Locked In (minutes)
                    </label>
                    <input
                      type="number"
                      value={minutes || ''}
                      onChange={(e) => setMinutes(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#A0522D] transition-colors"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                      Focus Rating (1-5)
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className="p-2 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-7 h-7 ${
                              star <= rating
                                ? 'fill-[#A0522D] text-[#A0522D]'
                                : 'text-[#444444]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                    Quick Tags (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedTags.includes(tag)
                            ? 'bg-[#A0522D] text-white'
                            : 'bg-[#252525] text-[#888888] hover:text-[#e5e5e5]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                    Reflection (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#A0522D] transition-colors resize-none"
                    placeholder="How did this session go?"
                    rows={2}
                  />
                </div>

                {/* Background Selection */}
                <div>
                  <label className="block text-sm font-medium text-[#e5e5e5] mb-2">
                    Card Background
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_BACKGROUNDS.map((bg) => (
                      <button
                        key={bg}
                        onClick={() => {
                          setSelectedBackground(bg);
                          setCustomBackground(null);
                        }}
                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                          selectedBackground === bg && !customBackground
                            ? 'border-[#A0522D] scale-105'
                            : 'border-transparent hover:border-[#444444]'
                        }`}
                      >
                        <img src={bg} alt="Background" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    
                    {/* Custom Upload */}
                    <label className="relative aspect-video rounded-lg overflow-hidden border-2 border-dashed border-[#444444] hover:border-[#A0522D] transition-all cursor-pointer flex items-center justify-center bg-[#1a1a1a]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomImageUpload}
                        className="hidden"
                      />
                      {customBackground ? (
                        <img src={customBackground} alt="Custom" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-6 h-6 text-[#666666] mx-auto mb-2" />
                          <span className="text-xs text-[#666666]">Upload</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Create Button */}
                <button
                  onClick={handleCreateCard}
                  className="w-full py-4 bg-[#A0522D] hover:bg-[#8B4513] text-white font-semibold rounded-lg transition-colors"
                >
                  Create Card
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cards.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-[#444444] mx-auto mb-4" />
                    <p className="text-[#888888]">No cards yet. Create your first focus session!</p>
                  </div>
                ) : (
                  cards.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCard(card)}
                      className="relative rounded-lg overflow-hidden border border-[#2a2a2a] hover:border-[#A0522D] transition-all group cursor-pointer hover:scale-[1.02] hover:shadow-2xl"
                    >
                      {/* Background Image */}
                      <div className="absolute inset-0">
                        <img src={card.background} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />
                        
                        {/* Vignette Effect */}
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
                          }}
                        />
                        
                        {/* Subtle Grain */}
                        <div
                          className="absolute inset-0 opacity-[0.02]"
                          style={{
                            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                          }}
                        />
                      </div>

                      {/* Content */}
                      <div className="relative p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-semibold text-white mb-1 tracking-[-0.03em]">{card.title}</h3>
                            <p className="text-xs text-white/40 tracking-wide uppercase font-medium">
                              {new Date(card.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCard(card.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all"
                            style={{
                              background: 'rgba(220, 38, 38, 0.15)',
                              backdropFilter: 'blur(8px)'
                            }}
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>

                        <div className="flex items-center gap-6 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                backdropFilter: 'blur(8px)',
                                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <Clock className="w-4 h-4 text-white/60" />
                            </div>
                            <div>
                              <span className="text-2xl font-black text-white tabular-nums tracking-tight">{card.minutes}</span>
                              <span className="text-xs text-white/40 ml-1.5 tracking-wider uppercase">min</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= card.rating
                                    ? 'drop-shadow-[0_0_4px_rgba(218,165,32,0.2)]'
                                    : ''
                                }`}
                                viewBox="0 0 24 24"
                                style={{
                                  fill: star <= card.rating 
                                    ? 'url(#starGradientSmall)'
                                    : 'rgba(255, 255, 255, 0.12)',
                                }}
                              >
                                <defs>
                                  <linearGradient id="starGradientSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style={{ stopColor: '#DAA520', stopOpacity: 1 }} />
                                    <stop offset="100%" style={{ stopColor: '#B8860B', stopOpacity: 1 }} />
                                  </linearGradient>
                                </defs>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                        </div>

                        {card.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {card.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-3 py-1 rounded-full text-xs text-white/80 font-medium tracking-wide"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  backdropFilter: 'blur(8px)',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {card.note && (
                          <p className="text-xs text-white/50 italic tracking-wide leading-relaxed">{card.note}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Card Viewer */}
      <CardViewer
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />

    </AnimatePresence>
  );
};
