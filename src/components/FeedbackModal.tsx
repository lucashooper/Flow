import { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const { user } = useAuth();
  const [type, setType] = useState<'feature' | 'bug' | 'other'>('feature');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id,
          email: user?.email,
          type,
          message: message.trim(),
        });

      if (submitError) throw submitError;

      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-8 relative"
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--bg-elev)',
            color: 'var(--muted)',
          }}
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text)' }}>
          Send Feedback
        </h2>
        <p className="mb-6" style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Help us improve Flow by sharing your ideas or reporting issues
        </p>

        {success ? (
          <div
            className="p-6 rounded-lg text-center"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <div className="text-4xl mb-3">✓</div>
            <p className="text-lg font-medium" style={{ color: '#22c55e' }}>
              Feedback sent!
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Thank you for helping us improve Flow
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Feedback Type
              </label>
              <div className="flex gap-2">
                {(['feature', 'bug', 'other'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: type === t ? 'var(--accent)' : 'var(--bg-elev)',
                      color: type === t ? '#fff' : 'var(--muted)',
                      border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                  >
                    {t === 'feature' ? '💡 Feature' : t === 'bug' ? '🐛 Bug' : '💬 Other'}
                  </button>
                ))}
              </div>
            </div>

            {/* Message textarea */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                required
                rows={6}
                className="w-full px-4 py-3 rounded-lg focus:outline-none transition-colors resize-none"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: loading || !message.trim() ? 'var(--bg-elev)' : 'var(--accent)',
                color: loading || !message.trim() ? 'var(--muted)' : '#fff',
                cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Feedback
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
