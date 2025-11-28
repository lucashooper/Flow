import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/Input';
import { PasswordInput } from '../components/PasswordInput';
import { useAuth } from '../contexts/AuthContext';

export const Signup = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, username);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ backgroundColor: '#0d0d0d' }}
      >
        <div 
          className="w-full max-w-md text-center p-10 rounded-2xl"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-semibold mb-4" style={{ color: '#e5e5e5' }}>
            Account Created!
          </h2>
          <p style={{ color: '#888888' }}>
            Please check your email to verify your account. Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      {/* Blurred orange orb background */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-30 blur-[100px] pointer-events-none"
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

      <div className="w-full max-w-md relative z-10 animate-cardFadeIn">
        <div 
          className="rounded-2xl p-10 shadow-2xl"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1) inset',
          }}
        >
          {/* Flow Logo and Branding */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="p-2 rounded-3xl mb-6"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 122, 24, 0.1), rgba(255, 179, 71, 0.1))',
                border: '2px solid rgba(255, 122, 24, 0.3)',
                boxShadow: '0 0 60px rgba(255, 122, 24, 0.4), 0 0 100px rgba(255, 179, 71, 0.2), inset 0 0 20px rgba(255, 122, 24, 0.1)'
              }}
            >
              <img 
                src="/Flow-icon.webp" 
                alt="Flow" 
                className="w-16 h-16 rounded-2xl"
              />
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#e5e5e5' }}>
              Create Account
            </h1>
            <p className="text-sm" style={{ color: '#888888' }}>
              Join Flow Notes today
            </p>
          </div>

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
            type="text"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="johndoe"
            required
          />
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
          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(90deg, #ff7a18, #ffb347)',
              boxShadow: '0 10px 30px rgba(255, 122, 24, 0.3)'
            }}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

          <p className="mt-6 text-center" style={{ color: '#888888' }}>
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="hover:underline transition-colors"
              style={{ color: '#ff7a18' }}
            >
              Sign in
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
