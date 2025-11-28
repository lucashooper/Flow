import { useNavigate } from 'react-router-dom';
import { FileText, Lock, Zap, Focus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      {/* Blurred orange orb background */}
      <div 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-40 blur-[120px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #ff7a18 0%, #ffb347 50%, transparent 70%)'
        }}
      />

      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-5xl w-full text-center relative z-10 animate-fadeIn">
        {/* Hero Section */}
        <div className="mb-16">
          {/* Flow Logo */}
          <div className="flex justify-center mb-8">
            <div
              className="p-2 rounded-3xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 122, 24, 0.1), rgba(255, 179, 71, 0.1))',
                border: '2px solid rgba(255, 122, 24, 0.3)',
                boxShadow: '0 0 60px rgba(255, 122, 24, 0.4), 0 0 100px rgba(255, 179, 71, 0.2), inset 0 0 20px rgba(255, 122, 24, 0.1)'
              }}
            >
              <img 
                src="/Flow-icon.webp" 
                alt="Flow" 
                className="w-20 h-20 rounded-2xl"
              />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-7xl font-bold mb-6" style={{ color: '#e5e5e5' }}>
            Flow Notes
          </h1>
          
          {/* Subtitle */}
          <p className="text-2xl mb-12" style={{ color: '#a0a0a0' }}>
            A premium space for thinking, writing & deep focus.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center mb-20">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(90deg, #ff7a18, #ffb347)',
                boxShadow: '0 10px 40px rgba(255, 122, 24, 0.3)'
              }}
            >
              Get Started
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e5e5e5',
                backdropFilter: 'blur(10px)'
              }}
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: '#ff7a18' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Markdown Support
            </h3>
            <p style={{ color: '#888888', fontSize: '0.9rem' }}>
              Full markdown formatting
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: '#ffb347' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Private & Secure
            </h3>
            <p style={{ color: '#888888', fontSize: '0.9rem' }}>
              Your notes are encrypted
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: '#ff7a18' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Fast & Lightweight
            </h3>
            <p style={{ color: '#888888', fontSize: '0.9rem' }}>
              Lightning-fast performance
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Focus className="w-12 h-12 mx-auto mb-4" style={{ color: '#ffb347' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Distraction-Free
            </h3>
            <p style={{ color: '#888888', fontSize: '0.9rem' }}>
              Deep focus mode
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
};
