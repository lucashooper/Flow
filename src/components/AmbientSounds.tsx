import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import Draggable from 'react-draggable';

interface AmbientSoundsProps {
  isVisible: boolean;
  onClose: () => void;
}

// Note: Audio files need to be added to /public/sounds/ directory
// You can download free ambient sounds from:
// - YouTube Audio Library: https://www.youtube.com/audiolibrary
// - Freesound: https://freesound.org/
const SOUNDS = [
  { id: 'rain', name: '🌧️ Rain', url: '/sounds/rain.mp3' },
  { id: 'cafe', name: '☕ Cafe', url: '/sounds/cafe.mp3' },
  { id: 'waves', name: '🌊 Ocean', url: '/sounds/waves.mp3' },
  { id: 'forest', name: '🌲 Forest', url: '/sounds/forest.mp3' },
  { id: 'fire', name: '🔥 Fireplace', url: '/sounds/fire.mp3' },
  { id: 'wind', name: '💨 Wind', url: '/sounds/wind.mp3' },
];

export const AmbientSounds = ({ isVisible, onClose }: AmbientSoundsProps) => {
  const nodeRef = useRef(null);
  const [activeSound, setActiveSound] = useState<string | null>(() => 
    localStorage.getItem('ambientSound') || null
  );
  const [volume, setVolume] = useState(() => 
    parseFloat(localStorage.getItem('ambientVolume') || '0.5')
  );
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('ambientExpanded');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeSound && isVisible) {
      const sound = SOUNDS.find(s => s.id === activeSound);
      if (sound && audioRef.current) {
        audioRef.current.src = sound.url;
        audioRef.current.loop = true;
        audioRef.current.volume = volume;
        audioRef.current.play().catch(err => {
          console.error('Audio play error:', err);
          console.log('💡 Tip: Add audio files to /public/sounds/ directory');
        });
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [activeSound, isVisible]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('ambientVolume', volume.toString());
  }, [volume]);

  const handleSoundSelect = (soundId: string) => {
    if (activeSound === soundId) {
      setActiveSound(null);
      localStorage.removeItem('ambientSound');
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setActiveSound(soundId);
      localStorage.setItem('ambientSound', soundId);
    }
  };

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    localStorage.setItem('ambientExpanded', JSON.stringify(newValue));
  };

  if (!isVisible) return null;

  return (
    <>
      <audio ref={audioRef} />
      <Draggable handle=".drag-handle" bounds="parent" nodeRef={nodeRef}>
        <div ref={nodeRef} className="fixed top-24 right-6 z-[9999]">
          <div
            className="drag-handle relative rounded-2xl text-sm shadow-2xl transition-all cursor-move"
            style={{
              backdropFilter: 'blur(16px)',
              background:
                'radial-gradient(circle at top left, rgba(139, 92, 246, 0.18), transparent 55%), rgba(12,12,15,0.94)',
              border: '1px solid rgba(248, 250, 252, 0.12)',
              boxShadow:
                '0 18px 45px rgba(0,0,0,0.85), 0 0 0 1px rgba(248,250,252,0.04)',
              width: isExpanded ? '280px' : 'auto',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={toggleExpanded}
              style={{ borderBottom: isExpanded ? '1px solid rgba(248, 250, 252, 0.08)' : 'none' }}
            >
              <div className="flex items-center gap-2">
                {activeSound ? (
                  <Volume2 className="w-4 h-4 text-purple-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
                <span className="font-semibold text-white">Ambient</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                ×
              </button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="p-3 space-y-3">
                {/* Sound Options */}
                <div className="grid grid-cols-2 gap-2">
                  {SOUNDS.map((sound) => (
                    <button
                      key={sound.id}
                      onClick={() => handleSoundSelect(sound.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeSound === sound.id
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {sound.name}
                    </button>
                  ))}
                </div>

                {/* Volume Control */}
                {activeSound && (
                  <div className="pt-2" style={{ borderTop: '1px solid rgba(248, 250, 252, 0.08)' }}>
                    <div className="flex items-center gap-2">
                      <VolumeX className="w-3 h-3 text-gray-400" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        style={{
                          accentColor: 'var(--accent)',
                        }}
                      />
                      <Volume2 className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Draggable>
    </>
  );
};
