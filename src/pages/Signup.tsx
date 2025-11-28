import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

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
      setTimeout(() => navigate('/login'), 5000);
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
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)' }}>
        <div className="w-full max-w-sm rounded-2xl px-8 py-10 text-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1) inset', animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255, 122, 24, 0.2), rgba(255, 179, 71, 0.2))', border: '2px solid rgba(255, 122, 24, 0.4)', boxShadow: '0 0 30px rgba(255, 122, 24, 0.3)' }}>
            <CheckCircle className="h-8 w-8" style={{ color: '#ff7a18' }} />
          </div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: '#e5e5e5' }}>Account Created!</h2>
          <p className="text-base mb-6" style={{ color: '#888888' }}>Check your inbox to verify your email and finish setting up Flow.</p>
          <button onClick={handleResendEmail} disabled={resendingEmail} className="w-full mb-4 py-3 rounded-xl font-medium transition-all hover:scale-[1.02]" style={{ background: resendingEmail ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 122, 24, 0.1)', border: '1px solid rgba(255, 122, 24, 0.3)', color: resendingEmail ? '#888888' : '#ff7a18' }}>
            {resendingEmail ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Sending...</span> : "Didn't receive it? Resend verification email"}
          </button>
          {resendSuccess && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>✓ Verification email sent!</div>}
          <p className="text-xs mt-4" style={{ color: '#666666' }}>You can close this window after verifying.</p>
        </div>
        <style>{`@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }`}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: '#0d0d0d' }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-30 blur-[100px] pointer-events-none" style={{ background: 'radial-gradient(circle, #ff7a18 0%, #ffb347 50%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      <div className="w-full max-w-md relative z-10" style={{ animation: 'cardFadeIn 0.6s ease-out' }}>
        <div className="rounded-2xl p-10 shadow-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.1) inset' }}>
          <div className="flex flex-col items-center mb-8">
            <img src="/Flow-icon.webp" alt="Flow" className="w-20 h-20 rounded-3xl mb-6" style={{ boxShadow: '0 0 60px rgba(255, 122, 24, 0.3), 0 0 30px rgba(255, 179, 71, 0.2), 0 4px 20px rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 122, 24, 0.15)' }} />
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#e5e5e5' }}>Create your Flow account</h1>
            <p className="text-sm" style={{ color: '#888888' }}>Write, think and focus in one calm space</p>
          </div>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm" style={{ backdropFilter: 'blur(10px)' }}>{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="text" label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" required />
            <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            <PasswordInput label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
            <button type="submit" disabled={loading} className="w-full mt-6 py-4 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(90deg, #ff7a18, #ffb347)', boxShadow: '0 10px 30px rgba(255, 122, 24, 0.3)' }}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
          <p className="mt-6 text-center" style={{ color: '#888888' }}>Already have an account? <Link to="/login" className="hover:underline transition-colors" style={{ color: '#ff7a18' }}>Sign in</Link></p>
        </div>
      </div>
      <style>{`@keyframes cardFadeIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </div>
  );
};
