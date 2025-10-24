import { Moon, Sun, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="bg-[#111111] border-b border-[#2a2a2a] px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {userProfile?.username && (
            <span className="text-sm text-[#888888]">
              {userProfile.username}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
            title="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-[#888888]" />
            ) : (
              <Sun className="w-4 h-4 text-[#888888]" />
            )}
          </button>
          {user && (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4 text-[#888888]" />
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-[#888888]" />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
