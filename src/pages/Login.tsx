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
        backgroundColor: '#0a0a0a',
        cursor: 'default' 
      }}
    >
      
      {/* Clean card */}
      <div className="w-full max-w-md relative z-10 animate-cardFadeIn">
        {/* Flow Logo */}
        <div className="flex flex-col items-center mb-10 select-none" style={{ cursor: 'default' }}>
          <img 
            src="/FlowIcon-Main.png" 
            alt="Flow" 
            className="w-16 h-16 mb-6 select-none"
            style={{
              filter: 'drop-shadow(0 4px 12px rgba(79, 195, 247, 0.3))',
              cursor: 'default',
              userSelect: 'none'
            }}
            draggable={false}
          />
          <h1 className="text-3xl font-light mb-2" style={{ color: '#e5e5e5', letterSpacing: '-0.02em' }}>
            Sign in to Flow
          </h1>
          <p className="text-sm" style={{ color: '#888888' }}>
            Welcome back to your notes
          </p>
        </div>

        <div 
          className="rounded-xl p-8"
          style={{
            backgroundColor: '#0f0f0f',
            border: '1px solid #1a1a1a',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
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
            className="w-full mt-6 py-3 rounded-lg font-medium text-white transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px rgba(79, 195, 247, 0.25)'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#888888' }}>
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
