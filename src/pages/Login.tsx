import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/Input';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to sign in. Please check your credentials.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden select-none"
      style={{ 
        background: 'linear-gradient(135deg, #0a1628 0%, #0d1b2a 50%, #1b2838 100%)',
        cursor: 'default' 
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
      
      {/* Clean card without box */}
      <div className="w-full max-w-md relative z-10 animate-cardFadeIn">
        {/* Flow Logo - larger, no box */}
        <div className="flex flex-col items-center mb-12 select-none" style={{ cursor: 'default' }}>
          <img 
            src="/FlowIcon-Main.png" 
            alt="Flow" 
            className="w-32 h-32 mb-6 select-none"
            style={{
              filter: 'drop-shadow(0 8px 32px rgba(79, 195, 247, 0.3))',
              cursor: 'default',
              userSelect: 'none'
            }}
            draggable={false}
          />
          <h1 className="text-4xl font-light mb-3" style={{ color: '#e3f2fd', letterSpacing: '-0.02em' }}>
            Sign in to Flow
          </h1>
          <p className="text-base" style={{ color: '#90a4ae' }}>
            Welcome back to your notes
          </p>
        </div>

        <div 
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            backgroundColor: 'rgba(13, 27, 42, 0.6)',
            border: '1px solid rgba(79, 195, 247, 0.15)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 1px rgba(79, 195, 247, 0.2) inset',
          }}
        >

          {error && (
            <div 
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm"
              style={{
                backdropFilter: 'blur(10px)',
              }}
            >
              {error}
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(90deg, #4fc3f7, #29b6f6)',
              boxShadow: '0 10px 30px rgba(79, 195, 247, 0.3)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

          <p className="mt-6 text-center" style={{ color: '#90a4ae' }}>
            Don't have an account?{' '}
            <Link 
              to="/signup" 
              className="hover:underline transition-colors"
              style={{ color: '#4fc3f7' }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes cardFadeIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-cardFadeIn {
          animation: cardFadeIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};
