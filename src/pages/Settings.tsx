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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'default');
  const [tabsEnabled, setTabsEnabled] = useState(() => {
    const saved = localStorage.getItem('tabsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

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

        {/* Theme Settings */}
        <Card className="mt-6">
          <h2 className="text-2xl font-semibold mb-6">Appearance</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <select
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  localStorage.setItem('theme', e.target.value);
                  window.location.reload();
                }}
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] focus:outline-none focus:border-[#A0522D]"
              >
                <option value="default">Default (Dark)</option>
                <option value="crimson">Crimson</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Editor Settings */}
        <Card className="mt-6">
          <h2 className="text-2xl font-semibold mb-6">Editor</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium">Note Tabs</label>
                <p className="text-sm text-gray-500 mt-1">
                  Show tabs for recently opened notes at the top of the editor
                </p>
              </div>
              <button
                onClick={() => {
                  const newValue = !tabsEnabled;
                  setTabsEnabled(newValue);
                  localStorage.setItem('tabsEnabled', JSON.stringify(newValue));
                  window.location.reload();
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tabsEnabled ? 'bg-[#A0522D]' : 'bg-[#2a2a2a]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tabsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
