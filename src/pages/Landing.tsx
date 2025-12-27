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
      style={{ 
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1b2a 50%, #1b2838 100%)'
      }}
    >
      {/* Flowing water effect with depth */}
      <div 
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(79, 195, 247, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(79, 195, 247, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(79, 195, 247, 0.08) 0%, transparent 60%)
          `
        }}
      />

      {/* Subtle grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Wave pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q 25 30, 50 50 T 100 50' stroke='%234fc3f7' fill='none' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 100px'
        }}
      />

      <div className="max-w-5xl w-full text-center relative z-10 animate-fadeIn">
        {/* Hero Section */}
        <div className="mb-16">
          {/* Flow Logo - no box, larger */}
          <div className="flex justify-center mb-10">
            <img 
              src="/FlowIcon-Main.png" 
              alt="Flow" 
              className="w-32 h-32"
              style={{
                filter: 'drop-shadow(0 12px 40px rgba(79, 195, 247, 0.4))',
              }}
            />
          </div>
          
          {/* Title - lighter font weight */}
          <h1 className="text-7xl font-light mb-6" style={{ color: '#e3f2fd', letterSpacing: '-0.03em' }}>
            Flow Notes
          </h1>
          
          {/* Subtitle */}
          <p className="text-2xl mb-12" style={{ color: '#90a4ae' }}>
            A premium space for thinking, writing & deep focus.
          </p>

          {/* CTA Buttons - blue theme */}
          <div className="flex gap-4 justify-center mb-20">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(90deg, #4fc3f7, #29b6f6)',
                boxShadow: '0 10px 40px rgba(79, 195, 247, 0.3)'
              }}
            >
              Get Started
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'rgba(79, 195, 247, 0.1)',
                border: '1px solid rgba(79, 195, 247, 0.2)',
                color: '#e3f2fd',
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
              backgroundColor: 'rgba(79, 195, 247, 0.08)',
              border: '1px solid rgba(79, 195, 247, 0.15)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: '#4fc3f7' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e3f2fd' }}>
              Markdown Support
            </h3>
            <p style={{ color: '#90a4ae', fontSize: '0.9rem' }}>
              Full markdown formatting
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(79, 195, 247, 0.08)',
              border: '1px solid rgba(79, 195, 247, 0.15)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: '#29b6f6' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e3f2fd' }}>
              Private & Secure
            </h3>
            <p style={{ color: '#90a4ae', fontSize: '0.9rem' }}>
              Your notes are encrypted
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(79, 195, 247, 0.08)',
              border: '1px solid rgba(79, 195, 247, 0.15)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Zap className="w-12 h-12 mx-auto mb-4" style={{ color: '#4fc3f7' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e3f2fd' }}>
              Fast & Lightweight
            </h3>
            <p style={{ color: '#90a4ae', fontSize: '0.9rem' }}>
              Lightning-fast performance
            </p>
          </div>
          
          <div 
            className="p-8 rounded-2xl transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'rgba(79, 195, 247, 0.08)',
              border: '1px solid rgba(79, 195, 247, 0.15)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <Focus className="w-12 h-12 mx-auto mb-4" style={{ color: '#29b6f6' }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#e3f2fd' }}>
              Distraction-Free
            </h3>
            <p style={{ color: '#90a4ae', fontSize: '0.9rem' }}>
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
