import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PinLockScreenProps {
  pinHash: string;
  onUnlock: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const PinLockScreen = ({ pinHash, onUnlock }: PinLockScreenProps) => {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const PIN_LENGTH = 4;

  const verifyPin = useCallback(async (currentPin: string) => {
    const hash = await hashPin(currentPin);
    if (hash === pinHash) {
      onUnlock();
    } else {
      setError('Incorrect PIN');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin('');
        setError('');
      }, 600);
    }
  }, [pinHash, onUnlock]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      verifyPin(pin);
    }
  }, [pin, verifyPin]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9' && pin.length < PIN_LENGTH) {
        setPin(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleNumberPress = (num: number) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num.toString());
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleForgotPin = async () => {
    if (!user?.email || sendingReset) return;
    setSendingReset(true);
    
    try {
      // Remove the PIN from the user's profile so they can access their account
      const { error } = await supabase
        .from('user_profiles')
        .update({ pin_hash: null, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      
      if (error) throw error;

      // Send a password reset email as verification
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/dashboard`,
      });

      setForgotSent(true);
    } catch (err) {
      console.error('Failed to send reset:', err);
      setError('Failed to send reset email. Try again.');
    } finally {
      setSendingReset(false);
    }
  };

  const numpadKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <img
          src="/FlowIcon-Main.png"
          alt="Flow"
          className="w-20 h-20 object-contain"
        />
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl font-bold text-[#e5e5e5] mb-1">Welcome back</h1>
        <p className="text-sm text-[#888888]">Enter your PIN to unlock</p>
      </motion.div>

      {/* PIN Dots */}
      <motion.div
        animate={shake ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-10"
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <motion.div
            key={i}
            animate={{
              scale: pin.length === i ? [1, 1.2, 1] : 1,
              backgroundColor: i < pin.length ? '#e5e5e5' : 'transparent',
            }}
            transition={{ duration: 0.15 }}
            className="w-4 h-4 rounded-full border-2"
            style={{
              borderColor: error && shake ? '#ef4444' : i < pin.length ? '#e5e5e5' : '#555555',
            }}
          />
        ))}
      </motion.div>

      {/* Numpad */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4 mb-6"
      >
        {numpadKeys.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberPress(num)}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium text-[#e5e5e5] transition-all duration-150 active:scale-95"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            {num}
          </button>
        ))}

        {/* Bottom row: empty, 0, delete */}
        <div /> {/* Empty space */}
        <button
          onClick={() => handleNumberPress(0)}
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-medium text-[#e5e5e5] transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-20 h-20 rounded-full flex items-center justify-center text-[#888888] transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          }}
        >
          <Delete className="w-6 h-6" />
        </button>
      </motion.div>

      {/* Forgot PIN */}
      <AnimatePresence mode="wait">
        {forgotSent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-green-400"
          >
            <Mail className="w-4 h-4" />
            PIN removed. Check your email to verify.
          </motion.div>
        ) : (
          <motion.button
            key="forgot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleForgotPin}
            disabled={sendingReset}
            className="text-sm text-[#666666] hover:text-[#888888] transition-colors"
          >
            {sendingReset ? 'Sending...' : 'Forgot PIN?'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
