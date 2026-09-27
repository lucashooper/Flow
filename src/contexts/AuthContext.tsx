import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  getCachedAuthUser,
  getOfflineUserFromIndexedDB,
  isOfflineMode as readOfflineMode,
  isSupabaseUnavailableError,
  setOfflineMode,
} from '../lib/offlineAuth';
import type { AuthContextType, User, UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineModeState] = useState(readOfflineMode());

  const activateOfflineSession = (cachedUser: User) => {
    setUser(cachedUser);
    setOfflineMode(true);
    setOfflineModeState(true);
    console.warn('📴 Flow offline mode — using notes saved on this device');
  };

  const fetchUserProfile = async (userId: string) => {
    if (!navigator.onLine || readOfflineMode()) {
      console.log('📴 Offline - skipping user profile fetch');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setUserProfile(data);
    } catch (error) {
      // Only log error if online (avoid spam when offline)
      if (navigator.onLine) {
        console.error('Error fetching user profile:', error);
      }
    }
  };

  useEffect(() => {
    const cachedUser = getCachedAuthUser();

    // Linear-style: hydrate from local session cache immediately so the shell renders fast.
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userData = { id: session.user.id, email: session.user.email || '' };
        setUser(userData);
        if (navigator.onLine && !readOfflineMode()) {
          void fetchUserProfile(session.user.id);
        }
      } else if (cachedUser) {
        activateOfflineSession(cachedUser);
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Auth session unavailable:', error);
      if (cachedUser) {
        activateOfflineSession(cachedUser);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (readOfflineMode()) return;

      if (session?.user) {
        const userData = { id: session.user.id, email: session.user.email || '' };
        setUser(userData);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    console.log('=== [Signup] Starting signup process ===');
    console.log('[Signup] Email:', email);
    console.log('[Signup] Username:', username);
    console.log('[Signup] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('[Signup] Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    // Validate inputs before calling Supabase
    if (!email || !password || !username) {
      const error = new Error('Missing required fields');
      console.error('[Signup] Validation error:', { email: !!email, password: !!password, username: !!username });
      throw error;
    }
    
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          username: username
        },
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });
    
    if (error) {
      console.error('=== [Signup] Auth signup FAILED ===');
      console.error('[Signup] Full error object:', error);
      console.error('[Signup] Error message:', error?.message);
      console.error('[Signup] Error status:', error?.status);
      console.error('[Signup] Error name:', error?.name);
      console.error('[Signup] Error code:', (error as any)?.code);
      console.error('[Signup] Error details:', (error as any)?.details);
      console.error('[Signup] Error hint:', (error as any)?.hint);
      console.error('[Signup] Error stack:', error?.stack);
      throw error;
    }
    
    console.log('=== [Signup] Auth user created successfully ===');
    console.log('[Signup] User ID:', data.user?.id);
    console.log('[Signup] User email:', data.user?.email);
    console.log('[Signup] User confirmed:', data.user?.confirmed_at);
    console.log('[Signup] Session:', !!data.session);
    
    // Create user profile in user_profiles table
    if (data.user) {
      console.log('[Signup] Attempting to create user profile in user_profiles table...');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert([{ 
          id: data.user.id, 
          username: username,
          email: email 
        }]);
      
      if (profileError) {
        console.error('=== [Signup] Profile creation FAILED ===');
        console.error('[Signup] Profile error code:', profileError.code);
        console.error('[Signup] Profile error message:', profileError.message);
        console.error('[Signup] Profile error details:', profileError.details);
        console.error('[Signup] Profile error hint:', profileError.hint);
        // Don't throw - user is created, profile can be added later
      } else {
        console.log('=== [Signup] Profile created successfully ===');
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setOfflineMode(false);
      setOfflineModeState(false);
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        const cached = getCachedAuthUser();
        if (cached && cached.email.toLowerCase() === email.toLowerCase()) {
          activateOfflineSession(cached);
          return;
        }
        const fromDb = await getOfflineUserFromIndexedDB(email);
        if (fromDb) {
          activateOfflineSession(fromDb);
          return;
        }
      }
      throw error;
    }
  };

  const signInOffline = async (email?: string) => {
    const cached = getCachedAuthUser();
    if (cached && (!email || cached.email.toLowerCase() === email.toLowerCase())) {
      activateOfflineSession(cached);
      return true;
    }

    const fromDb = await getOfflineUserFromIndexedDB(email);
    if (fromDb) {
      activateOfflineSession(fromDb);
      return true;
    }

    return false;
  };

  const signOut = async () => {
    const wasOffline = readOfflineMode();
    setOfflineMode(false);
    setOfflineModeState(false);

    if (wasOffline) {
      setUser(null);
      setUserProfile(null);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      if (isSupabaseUnavailableError(error)) {
        setUser(null);
        setUserProfile(null);
        return;
      }
      throw error;
    }
    setUserProfile(null);
  };

  const updateUsername = async (username: string) => {
    if (!user) throw new Error('No user logged in');
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        username: username,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (error) throw error;
    await fetchUserProfile(user.id);
  };

  const updateProfilePicture = async (profilePictureUrl: string) => {
    if (!user) throw new Error('No user logged in');
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        profile_picture_url: profilePictureUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (error) throw error;
    await fetchUserProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isOfflineMode: offlineMode, signUp, signIn, signInOffline, signOut, updateUsername, updateProfilePicture }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
