import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const WELCOME_FLAG = 'flow_welcome_shown';

interface WelcomeModalProps {
  userConfirmed: boolean;
}

export const WelcomeModal = ({ userConfirmed }: WelcomeModalProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if user is confirmed and hasn't seen welcome before
    const hasSeenWelcome = localStorage.getItem(WELCOME_FLAG);
    
    if (userConfirmed && !hasSeenWelcome) {
      // Small delay for smooth appearance
      setTimeout(() => setShow(true), 500);
    }
  }, [userConfirmed]);

  const handleClose = () => {
    localStorage.setItem(WELCOME_FLAG, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-md text-center p-10 rounded-2xl relative"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1) inset',
          animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
          style={{
            color: '#888888',
            backgroundColor: 'rgba(255, 255, 255, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#e5e5e5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = '#888888';
          }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Flow Logo with animation */}
        <div className="flex justify-center mb-6">
          <img 
            src="/Flow-icon.webp" 
            alt="Flow" 
            className="w-20 h-20 rounded-2xl"
            style={{
              boxShadow: '0 0 60px rgba(255, 122, 24, 0.4), 0 0 30px rgba(255, 179, 71, 0.2)',
              border: '1px solid rgba(255, 122, 24, 0.15)',
              animation: 'float 3s ease-in-out infinite'
            }}
          />
        </div>

        {/* Welcome Text */}
        <h2 className="text-4xl font-bold mb-3" style={{ color: '#e5e5e5' }}>
          Welcome to Flow
        </h2>
        
        <p className="text-lg mb-8" style={{ color: '#888888' }}>
          Your account is ready.
        </p>

        {/* Start Writing Button */}
        <button
          onClick={handleClose}
          className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(90deg, #ff7a18, #ffb347)',
            boxShadow: '0 10px 30px rgba(255, 122, 24, 0.3)'
          }}
        >
          Start Writing
        </button>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
};
