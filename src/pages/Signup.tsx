import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/Input';
import { PasswordInput } from '../components/PasswordInput';
import { supabase } from '../lib/supabase';

export const Signup = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Username is required'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await signUp(email, password, username);
      setSuccess(true);
      // Removed auto-redirect - user can manually go to login after verifying
    } catch (err: any) {
      setError(err?.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setResendSuccess(false);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email });
      if (error) throw error;
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err: any) {
      console.error('Resend email error:', err);
    } finally {
      setResendingEmail(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-6 overflow-hidden" style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="w-full max-w-md rounded-xl px-10 py-12 text-center relative z-10" style={{ backgroundColor: '#0f0f0f', border: '1px solid #1a1a1a', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(79, 195, 247, 0.1)', border: '1px solid rgba(79, 195, 247, 0.2)' }}>
            <CheckCircle className="h-8 w-8" style={{ color: '#4fc3f7' }} />
          </div>
          <h2 className="text-3xl font-light mb-4" style={{ color: '#e5e5e5' }}>Account Created!</h2>
          <p className="text-base mb-8 leading-relaxed" style={{ color: '#888888' }}>Check your inbox to verify your email and finish setting up Flow.</p>
          <button onClick={handleResendEmail} disabled={resendingEmail} className="w-full mb-4 py-3 rounded-lg font-medium transition-all hover:scale-[1.01]" style={{ background: resendingEmail ? '#1a1a1a' : 'rgba(79, 195, 247, 0.1)', border: '1px solid rgba(79, 195, 247, 0.2)', color: resendingEmail ? '#666666' : '#4fc3f7', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)' }}>
            {resendingEmail ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Sending...</span> : "Didn't receive it? Resend verification email"}
          </button>
          {resendSuccess && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>✓ Verification email sent!</div>}
          <p className="text-xs mt-6" style={{ color: '#666666' }}>After verifying, you can <Link to="/login" className="underline hover:text-[#4fc3f7] transition-colors" style={{ color: '#888888' }}>sign in here</Link>.</p>
        </div>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

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
            Create your Flow account
          </h1>
          <p className="text-sm" style={{ color: '#888888' }}>
            Start writing in seconds
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
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm" style={{ backdropFilter: 'blur(10px)' }}>{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="text" label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" required />
            <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            <PasswordInput label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
            <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 rounded-lg font-medium text-white transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #4fc3f7, #29b6f6)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 4px 12px rgba(79, 195, 247, 0.25)'
            }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          </form>
          <p className="mt-6 text-center text-sm" style={{ color: '#888888' }}>
            Already have an account?{' '}
            <Link 
              to="/login" 
              className="hover:underline transition-colors"
              style={{ color: '#4fc3f7' }}
            >
              Sign in
            </Link>
          </p>
        </div>
        <style>{`@keyframes cardFadeIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      </div>
    </div>
  );
};
