import { useState, useEffect } from 'react';
import { X, User, Palette, Type, Layers, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type SettingsSection = 'profile' | 'appearance' | 'editor' | 'features';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { user, userProfile, updateUsername, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'default');
  const [tabsEnabled, setTabsEnabled] = useState(() => {
    const saved = localStorage.getItem('tabsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

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

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_picture_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

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
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => {
                        const value = e.target.value;
                        console.log('🎨 [Settings] Theme change requested:', value);
                        setTheme(value);
                        localStorage.setItem('theme', value);
                        console.log('💾 [Settings] Theme saved to localStorage:', value);
                        
                        const root = document.documentElement;
                        console.log('📋 [Settings] Current root classes:', Array.from(root.classList));
                        console.log('🏷️ [Settings] Root element tag:', root.tagName);
                        
                        Array.from(root.classList).forEach((cls) => {
                          if (cls.startsWith('theme-')) {
                            console.log('🗑️ [Settings] Removing class:', cls);
                            root.classList.remove(cls);
                          }
                        });
                        
                        const newClass = `theme-${value}`;
                        root.classList.add(newClass);
                        console.log('✅ [Settings] Added class:', newClass);
                        console.log('📋 [Settings] New root classes:', Array.from(root.classList));
                        
                        // Check if CSS rule exists
                        const testSelector = `html.${newClass}`;
                        console.log('🔍 [Settings] Looking for selector:', testSelector);
                        
                        // Force style recalculation
                        setTimeout(() => {
                          const computedBg = getComputedStyle(root).getPropertyValue('--bg-editor');
                          const computedPanel = getComputedStyle(root).getPropertyValue('--bg-panel');
                          const computedText = getComputedStyle(root).getPropertyValue('--text');
                          console.log('🎨 [Settings] Computed --bg-editor:', computedBg.trim());
                          console.log('🎨 [Settings] Computed --bg-panel:', computedPanel.trim());
                          console.log('🎨 [Settings] Computed --text:', computedText.trim());
                          
                          // Check actual background color of body
                          const bodyBg = getComputedStyle(document.body).backgroundColor;
                          console.log('🎨 [Settings] Body background:', bodyBg);
                        }, 100);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg focus:outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--bg-elev)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      <option value="default">Default (Dark)</option>
                      <option value="crimson">Crimson</option>
                      <option value="modern-gray">Modern Gray</option>
                      <option value="coffee">Coffee</option>
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

                  <div className="pt-8 mt-8 border-t" style={{ borderColor: 'var(--divider)' }}>
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
                  </div>

                  <div className="pt-8 mt-8 border-t" style={{ borderColor: 'var(--divider)' }}>
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
    </div>
  );
};
