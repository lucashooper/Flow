import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
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
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      }}
    >
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Premium card with depth */}
      <div className="w-full max-w-md relative z-10">
        <div 
          className="bg-[#1a1a1a] rounded-2xl p-8 shadow-2xl"
          style={{
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1) inset',
          }}
        >
          {/* Flow Logo and Branding */}
          <div className="flex flex-col items-center mb-8">
            <img 
              src="/Flow-icon.webp" 
              alt="Flow" 
              className="w-16 h-16 mb-4"
            />
            <h1 className="text-3xl font-bold text-[#e5e5e5] mb-2">Sign in to Flow</h1>
            <p className="text-sm text-[#888888]">Welcome back to your notes</p>
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
          <Button 
            type="submit" 
            className="w-full mt-6 bg-[#D97706] hover:bg-[#B45309] text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl" 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 text-center text-[#888888]">
          Don't have an account?{' '}
          <Link to="/signup" className="text-[#D97706] hover:text-[#B45309] hover:underline transition-colors">
            Sign up
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
};
