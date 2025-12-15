import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Palette, Type, Layers, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type SettingsSection = 'profile' | 'appearance' | 'editor' | 'features';

export const Settings = () => {
  const { user, userProfile, updateUsername, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
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

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploadingPicture(true);
    setError('');

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      // Update profile in database
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
      // Call the delete_user database function (needs to be created in Supabase)
      // This will cascade delete all related data and remove the auth user
      const { error: deleteError } = await supabase.rpc('delete_user_account');

      if (deleteError) {
        console.error('Error deleting account:', deleteError);
        throw deleteError;
      }

      // Sign out and redirect
      await signOut();
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to delete account. Please contact support.');
      console.error('Delete account error:', err);
    } finally {
      setDeletingAccount(false);
    }
  };

  const menuItems = [
    { id: 'profile' as SettingsSection, label: 'My Profile', icon: User },
    { id: 'appearance' as SettingsSection, label: 'Appearance', icon: Palette },
    { id: 'editor' as SettingsSection, label: 'Editor', icon: Type },
    { id: 'features' as SettingsSection, label: 'Features', icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-64 border-r border-[#2a2a2a] p-4">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeSection === item.id
                      ? 'bg-[#1a1a1a] text-[#e5e5e5]'
                      : 'text-[#888888] hover:bg-[#151515] hover:text-[#e5e5e5]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8">
            {/* My Profile Section */}
            {activeSection === 'profile' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">My Profile</h2>

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

                {/* Profile Picture Upload */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-4">Profile Picture</label>
                  <div className="flex items-center gap-6">
                    {/* Avatar Display */}
                    <div className="relative">
                      {profilePicture ? (
                        <img
                          src={profilePicture}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover border-2 border-[#2a2a2a]"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-[#1a1a1a] border-2 border-[#2a2a2a] flex items-center justify-center">
                          <User className="w-12 h-12 text-[#666666]" />
                        </div>
                      )}
                      {uploadingPicture && (
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {/* Upload Button */}
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
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] rounded-lg cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Upload Photo</span>
                      </label>
                      <p className="text-xs text-[#666666] mt-2">
                        JPG, PNG or GIF. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                      required
                      className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-[#A0522D] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2.5 bg-[#151515] border border-[#2a2a2a] rounded-lg text-[#666666] cursor-not-allowed"
                    />
                    <p className="text-sm text-[#666666] mt-2">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#A0522D] hover:bg-[#8B4513] disabled:bg-[#2a2a2a] disabled:text-[#666666] text-white font-medium py-2.5 rounded-lg transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                </form>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Appearance</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => {
                        const value = e.target.value;
                        setTheme(value);
                        localStorage.setItem('theme', value);
                        // Apply theme class to <html> immediately without full refresh
                        const root = document.documentElement;
                        // remove previous theme-* classes
                        Array.from(root.classList).forEach((cls) => {
                          if (cls.startsWith('theme-')) root.classList.remove(cls);
                        });
                        root.classList.add(`theme-${value}`);
                      }}
                      className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] focus:outline-none focus:border-[#A0522D] transition-colors"
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

            {/* Editor Section */}
            {activeSection === 'editor' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Editor</h2>
                <p className="text-[#888888] mb-6">Customize your text editing experience.</p>
                {/* Placeholder for future editor settings */}
                <div className="text-[#666666] text-sm">
                  More editor customization options coming soon...
                </div>
              </div>
            )}

            {/* Features Section */}
            {activeSection === 'features' && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Features</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-4 border-b border-[#2a2a2a]">
                    <div>
                      <label className="block text-sm font-medium">Note Tabs</label>
                      <p className="text-sm text-[#888888] mt-1">
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

                  {/* Logout Button */}
                  <div className="pt-8 mt-8 border-t border-[#2a2a2a]">
                    <button
                      onClick={async () => {
                        try {
                          await signOut();
                          navigate('/login');
                        } catch (error) {
                          console.error('Logout error:', error);
                        }
                      }}
                      className="w-full bg-red-900/20 hover:bg-red-900/30 border border-red-900/50 text-red-400 font-medium py-2.5 rounded-lg transition-colors"
                    >
                      Logout
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="pt-8 mt-8 border-t border-[#2a2a2a]">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      Danger Zone
                    </h3>
                    <p className="text-sm text-[#888888] mb-4">
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
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
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
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-red-600/20">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-[#e5e5e5]">Delete Account</h2>
            </div>

            <p className="text-[#888888] mb-6">
              This action cannot be undone. This will permanently delete your account and all your notes.
            </p>

            {error && (
              <div className="bg-red-900/20 border border-red-900/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-[#e5e5e5]">
                Type <span className="font-bold text-red-400">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e5e5e5] placeholder-[#666666] focus:outline-none focus:border-red-600 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setError('');
                }}
                className="flex-1 px-4 py-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-[#2a2a2a] text-[#e5e5e5] font-medium rounded-lg transition-colors"
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
