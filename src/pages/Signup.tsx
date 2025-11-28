import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: '#0d0d0d' }}>
        <div className="w-full max-w-md text-center p-10 rounded-2xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)' }}>
          <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255, 122, 24, 0.2), rgba(255, 179, 71, 0.2))', border: '2px solid rgba(255, 122, 24, 0.3)' }}>
            <Mail className="w-8 h-8" style={{ color: '#ff7a18' }} />
          </div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: '#e5e5e5' }}>Account Created!</h2>
          <p className="text-base mb-6" style={{ color: '#888888' }}>Check your inbox to verify your email.</p>
          <button onClick={handleResendEmail} disabled={resendingEmail} className="w-full mb-4 py-3 rounded-xl font-medium" style={{ background: resendingEmail ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 122, 24, 0.1)', border: '1px solid rgba(255, 122, 24, 0.3)', color: resendingEmail ? '#888888' : '#ff7a18' }}>
            {resendingEmail ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Sending...</span> : 'Resend Verification Email'}
          </button>
          {resendSuccess && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>✓ Verification email sent!</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#0d0d0d' }}>
      <div className="w-full max-w-md">
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="text" label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <PasswordInput label="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Sign Up'}</button>
        </form>
        <p className="mt-6 text-center"><Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
};
