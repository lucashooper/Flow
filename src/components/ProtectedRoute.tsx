import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PinLockScreen } from './PinLockScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, userProfile, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(() => {
    // Check if already unlocked in this session
    return sessionStorage.getItem('pin_unlocked') === 'true';
  });

  const handleUnlock = useCallback(() => {
    sessionStorage.setItem('pin_unlocked', 'true');
    setUnlocked(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show PIN lock screen if user has a PIN set and hasn't unlocked yet
  if (userProfile?.pin_hash && !unlocked) {
    return <PinLockScreen pinHash={userProfile.pin_hash} onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
};
