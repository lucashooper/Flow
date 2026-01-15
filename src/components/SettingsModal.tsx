import { useState, useEffect } from 'react';
import { X, User, Palette, Type, Layers, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FeedbackModal } from './FeedbackModal';

type SettingsSection = 'profile' | 'appearance' | 'editor' | 'plugins' | 'features';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, userProfile, updateUsername, updateProfilePicture, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'default');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || 'orange');
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'dark');
  const [tabsEnabled, setTabsEnabled] = useState(() => {
    const saved = localStorage.getItem('tabsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [focusModeEnabled, setFocusModeEnabled] = useState(() => {
    const saved = localStorage.getItem('focusModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [pomodoroEnabled, setPomodoroEnabled] = useState(() => {
    const saved = localStorage.getItem('pomodoroEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [wordCountEnabled, setWordCountEnabled] = useState(() => {
    const saved = localStorage.getItem('wordCountEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [drawingModeEnabled, setDrawingModeEnabled] = useState(() => {
    const saved = localStorage.getItem('drawingModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [cardsEnabled, setCardsEnabled] = useState(() => {
    const saved = localStorage.getItem('cardsEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [syncIndicatorEnabled, setSyncIndicatorEnabled] = useState(() => {
    const saved = localStorage.getItem('syncIndicatorEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [ambientSoundsEnabled, setAmbientSoundsEnabled] = useState(() => {
    const saved = localStorage.getItem('ambientSoundsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [focusStatsEnabled, setFocusStatsEnabled] = useState(() => {
    const saved = localStorage.getItem('focusStatsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [breakRemindersEnabled, setBreakRemindersEnabled] = useState(() => {
    const saved = localStorage.getItem('breakRemindersEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setUsername(userProfile.username);
      setProfilePicture(userProfile.profile_picture_url || null);
    }
  }, [userProfile]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Update profile using AuthContext function (updates correct table and refreshes state)
      await updateProfilePicture(data.publicUrl);

      setProfilePicture(data.publicUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture');
      console.error(err);
    } finally {
      setUploadingPicture(false);
    }
  };

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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setDeletingAccount(true);
    setError('');

    try {
      const { error: deleteError } = await supabase.rpc('delete_user_account');

      if (deleteError) {
        console.error('Error deleting account:', deleteError);
        throw deleteError;
      }

      await signOut();
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to delete account. Please contact support.');
      console.error('Delete account error:', err);
    } finally {
      setDeletingAccount(false);
    }
  };

  const menuItems = [
    { id: 'appearance' as SettingsSection, label: 'Appearance', icon: Palette },
    { id: 'profile' as SettingsSection, label: 'Profile', icon: User },
    { id: 'editor' as SettingsSection, label: 'Editor', icon: Type },
    { id: 'plugins' as SettingsSection, label: 'Plugins', icon: Layers },
    { id: 'features' as SettingsSection, label: 'Features', icon: Layers },
  ];

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl h-[85vh] flex rounded-2xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--divider)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col" style={{ borderColor: 'var(--divider)', backgroundColor: 'var(--bg-panel)' }}>
          <div className="p-6 border-b" style={{ borderColor: 'var(--divider)' }}>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Settings</h2>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
                  style={{
                    backgroundColor: activeSection === item.id ? 'var(--bg-elev)' : 'transparent',
                    color: activeSection === item.id ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <button
            onClick={onClose}
            className="m-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: 'var(--bg-elev)',
              color: 'var(--muted)',
            }}
          >
            Close
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-8">
            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Appearance</h2>
                
                <div className="space-y-6">
                  {/* Theme Mode Selector */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Theme Mode</label>
                    <select
                      value={themeMode}
                      onChange={(e) => {
                        const value = e.target.value;
                        setThemeMode(value);
                        localStorage.setItem('themeMode', value);
                        // TODO: Implement light mode and system adaptation
                        if (value === 'light') {
                          alert('Light mode coming soon!');
                        } else if (value === 'system') {
                          alert('System adaptation coming soon!');
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors mb-6"
                      style={{
                        backgroundColor: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">Adapt to System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Color Theme</label>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Changes background colors, panels, and overall theme</p>
                    <select
                      value={theme}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTheme(value);
                        localStorage.setItem('theme', value);
                        
                        const root = document.documentElement;
                        
                        // Remove theme classes
                        Array.from(root.classList).forEach((cls) => {
                          if (cls.startsWith('theme-')) {
                            root.classList.remove(cls);
                          }
                        });
                        
                        root.classList.add(`theme-${value}`);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="default">Default Dark</option>
                      <option value="crimson">Crimson Dark</option>
                      <option value="coffee">Coffee Dark</option>
                      <option value="ocean">Ocean Dark</option>
                      <option value="modern-gray">Modern Gray</option>
                      <option value="purple">Purple Dark</option>
                      <option value="green">Green Dark</option>
                      <option value="pink">Pink Dark</option>
                      <option value="amber">Amber Dark</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Accent Color</label>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>Changes folder icons, buttons, and highlight colors</p>
                    <select
                      value={accentColor}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAccentColor(value);
                        localStorage.setItem('accentColor', value);
                        
                        const root = document.documentElement;
                        
                        // Remove accent classes
                        Array.from(root.classList).forEach((cls) => {
                          if (cls.startsWith('accent-')) {
                            root.classList.remove(cls);
                          }
                        });
                        
                        root.classList.add(`accent-${value}`);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="orange">🟠 Orange</option>
                      <option value="purple">🟣 Purple</option>
                      <option value="green">🟢 Green</option>
                      <option value="pink">🩷 Pink</option>
                      <option value="blue">🔵 Blue</option>
                      <option value="red">🔴 Red</option>
                      <option value="amber">🟡 Amber</option>
                      <option value="teal">🩵 Teal</option>
                      <option value="indigo">🔮 Indigo</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>My Profile</h2>

                {success && (
                  <div className="bg-green-900/20 border border-green-900/50 text-green-400 p-3 rounded-lg mb-4">
                    Profile updated successfully!
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                <div className="mb-8">
                  <label className="block text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>Profile Picture</label>
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {profilePicture ? (
                        <img
                          src={profilePicture}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover"
                          style={{ border: '2px solid var(--border)' }}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elev)', border: '2px solid var(--border)' }}>
                          <User className="w-12 h-12" style={{ color: 'var(--muted)' }} />
                        </div>
                      )}
                      {uploadingPicture && (
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        type="file"
                        id="profile-picture-upload"
                        accept="image/*"
                        onChange={handleProfilePictureUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="profile-picture-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                        style={{
                          backgroundColor: 'var(--bg-elev)',
                          border: '1px solid var(--border)',
                          color: 'var(--text)',
                        }}
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Upload Photo</span>
                      </label>
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                        JPG, PNG or GIF. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                      required
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2.5 rounded-lg cursor-not-allowed"
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                      }}
                    />
                    <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full font-medium py-2.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: loading ? 'var(--bg-elev)' : 'var(--accent)',
                      color: loading ? 'var(--muted)' : '#fff',
                    }}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </form>

                {/* Account Actions */}
                <div className="mt-8 pt-8 border-t space-y-4" style={{ borderColor: 'var(--divider)' }}>
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        window.location.href = '/login';
                      } catch (error) {
                        console.error('Logout error:', error);
                      }
                    }}
                    className="w-full bg-red-900/20 hover:bg-red-900/30 border border-red-900/50 text-red-400 font-medium py-2.5 rounded-lg transition-colors"
                  >
                    Logout
                  </button>

                  <div className="pt-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Danger Zone
                    </h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Once you delete your account, there is no going back. All your notes and data will be permanently deleted.
                    </p>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Editor Section */}
            {activeSection === 'editor' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Editor</h2>
                <p className="mb-6" style={{ color: 'var(--muted)' }}>Customize your text editing experience.</p>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  More editor customization options coming soon...
                </div>
              </div>
            )}

            {/* Plugins Section */}
            {activeSection === 'plugins' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Plugins</h2>
                <p className="mb-6" style={{ color: 'var(--muted)' }}>
                  Extend Flow's functionality with plugins. More plugin options coming soon.
                </p>

                <div className="space-y-6">
                  {/* Core Plugins Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Core Plugins</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Essential plugins built and maintained by the Flow team. Toggle them on/off to customize your toolbar.
                    </p>
                    
                    <div className="space-y-3">
                      {/* Focus Mode Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Focus Mode</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Minimize distractions by dimming the sidebar and inactive tabs
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !focusModeEnabled;
                            setFocusModeEnabled(newValue);
                            localStorage.setItem('focusModeEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: focusModeEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: focusModeEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Pomodoro Timer Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Pomodoro Timer</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Built-in timer for the Pomodoro Technique productivity method
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !pomodoroEnabled;
                            setPomodoroEnabled(newValue);
                            localStorage.setItem('pomodoroEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: pomodoroEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: pomodoroEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Word Count Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Word Count</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Display word and character count for your notes
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !wordCountEnabled;
                            setWordCountEnabled(newValue);
                            localStorage.setItem('wordCountEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: wordCountEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: wordCountEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Drawing Mode Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Drawing Mode</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Sketch and draw directly in your notes with canvas tools
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !drawingModeEnabled;
                            setDrawingModeEnabled(newValue);
                            localStorage.setItem('drawingModeEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: drawingModeEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: drawingModeEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Cards Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Cards</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Track focus sessions with shareable stat cards
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !cardsEnabled;
                            setCardsEnabled(newValue);
                            localStorage.setItem('cardsEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: cardsEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: cardsEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Sync Indicator Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Sync Indicator</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Show connection status and sync progress in the toolbar
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !syncIndicatorEnabled;
                            setSyncIndicatorEnabled(newValue);
                            localStorage.setItem('syncIndicatorEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: syncIndicatorEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: syncIndicatorEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Ambient Sounds Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Ambient Sounds</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Play ambient sounds like rain, cafe, or ocean waves while working
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !ambientSoundsEnabled;
                            setAmbientSoundsEnabled(newValue);
                            localStorage.setItem('ambientSoundsEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: ambientSoundsEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: ambientSoundsEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Focus Stats Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Focus Stats</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Track daily focus time, completed tasks, and productivity metrics
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !focusStatsEnabled;
                            setFocusStatsEnabled(newValue);
                            localStorage.setItem('focusStatsEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: focusStatsEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: focusStatsEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>

                      {/* Break Reminders Plugin */}
                      <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Break Reminders</h4>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            Get gentle reminders to take breaks after long focus sessions (every 50 min)
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !breakRemindersEnabled;
                            setBreakRemindersEnabled(newValue);
                            localStorage.setItem('breakRemindersEnabled', JSON.stringify(newValue));
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ backgroundColor: breakRemindersEnabled ? 'var(--accent)' : 'var(--bg-elev)' }}
                        >
                          <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: breakRemindersEnabled ? 'translateX(24px)' : 'translateX(4px)' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Community Plugins Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>Community Plugins</h3>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                      Plugins created by the Flow community. Browse and install community-made extensions.
                    </p>
                    <div className="p-6 rounded-lg text-center" style={{ backgroundColor: 'var(--bg-elev)', borderColor: 'var(--border)', border: '1px solid' }}>
                      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                        Community plugin marketplace coming soon
                      </p>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: '#fff',
                        }}
                        onClick={() => setShowFeedbackModal(true)}
                      >
                        Request a Plugin
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Features Section */}
            {activeSection === 'features' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text)' }}>Features</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b" style={{ borderColor: 'var(--divider)' }}>
                    <div>
                      <label className="block text-sm font-medium" style={{ color: 'var(--text)' }}>Note Tabs</label>
                      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
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
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                      style={{
                        backgroundColor: tabsEnabled ? 'var(--accent)' : 'var(--bg-elev)',
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                        style={{
                          transform: tabsEnabled ? 'translateX(24px)' : 'translateX(4px)',
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Close button */}
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
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="absolute inset-0 z-10 flex items-center justify-center p-6"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            setError('');
          }}
        >
          <div 
            className="w-full max-w-md p-8 rounded-2xl"
            style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--divider)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-600/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Delete Account</h2>
            </div>

            <p className="mb-6" style={{ color: 'var(--muted)' }}>
              This action cannot be undone. This will permanently delete your account and all your notes.
            </p>

            {error && (
              <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Type <span className="font-bold text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-900/30 disabled:text-red-800 text-white font-medium rounded-lg transition-colors"
              >
                {deletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </div>
  );
};
