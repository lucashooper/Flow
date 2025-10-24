import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Navbar } from '../components/Navbar';
import { Card } from '../components/Card';

export const Settings = () => {
  const { user, userProfile, updateUsername } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username);
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      await updateUsername(username.trim());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update username');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <h2 className="text-2xl font-semibold mb-6">Profile Settings</h2>

          {success && (
            <div className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 p-3 rounded-lg mb-4">
              Username updated successfully!
            </div>
          )}

          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              required
            />

            <div className="pt-2">
              <Input
                type="email"
                label="Email"
                value={user?.email || ''}
                disabled
                className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
              />
              <p className="text-sm text-gray-500 mt-2">
                Email cannot be changed. Contact support if you need to update your email.
              </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <Save className="w-5 h-5 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
