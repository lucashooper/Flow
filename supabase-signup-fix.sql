-- ============================================
-- Supabase Signup Fix Script
-- ============================================
-- This script diagnoses and fixes the "Database error saving new user" issue
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/oetxqcyktahczrqrxlds/sql

-- ============================================
-- STEP 1: Check for triggers on auth.users
-- ============================================
-- This will show any triggers that run when a user signs up
SELECT 
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- Expected output: Shows triggers like "on_auth_user_created" or similar
-- If you see a trigger, it's likely the cause of the error

-- ============================================
-- STEP 2: Check if user_profiles table exists
-- ============================================
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
) AS user_profiles_exists;

-- Expected: true
-- If false, the table is missing (see STEP 5 to create it)

-- ============================================
-- STEP 3: Check user_profiles table structure
-- ============================================
-- Only run if table exists
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Expected columns:
--   id (uuid, NOT NULL)
--   username (text, NOT NULL)
--   email (text, NOT NULL)
--   created_at (timestamp, NOT NULL)
--   updated_at (timestamp, NOT NULL)

-- ============================================
-- STEP 4: Check RLS policies on user_profiles
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'user_profiles';

-- Expected: At least one INSERT policy that allows auth.uid() = id

-- ============================================
-- STEP 5: FIX - Disable problematic trigger (TEMPORARY)
-- ============================================
-- If you found a trigger in STEP 1, disable it temporarily to allow signups
-- Replace 'trigger_name_here' with the actual trigger name from STEP 1

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- After running this, try signing up again
-- If it works, the trigger was the problem

-- ============================================
-- STEP 6: FIX - Create user_profiles table (if missing)
-- ============================================
-- Only run if STEP 2 showed the table doesn't exist

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- ============================================
-- STEP 7: FIX - Temporarily disable RLS (for testing)
-- ============================================
-- If table exists but signup still fails, RLS might be blocking
-- This is a TEMPORARY fix to test if RLS is the issue

-- ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Try signup again
-- If it works, RLS was blocking - re-enable and fix policies:
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 8: Create a working trigger (RECOMMENDED)
-- ============================================
-- This creates a proper trigger that handles profile creation
-- Run this AFTER fixing the table/RLS issues

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.email
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Username already exists, generate a unique one
    INSERT INTO public.user_profiles (id, username, email)
    VALUES (
      NEW.id,
      'user_' || substr(NEW.id::text, 1, 8),
      NEW.email
    );
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create user profile: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 9: Test the fix
-- ============================================
-- After running the fixes above, test by creating a user manually

-- DO $$
-- DECLARE
--   test_user_id UUID;
-- BEGIN
--   -- This simulates what happens during signup
--   test_user_id := gen_random_uuid();
  
--   INSERT INTO auth.users (
--     id,
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     raw_user_meta_data
--   ) VALUES (
--     test_user_id,
--     'test@example.com',
--     crypt('password123', gen_salt('bf')),
--     NOW(),
--     '{"username": "testuser"}'::jsonb
--   );
  
--   RAISE NOTICE 'Test user created: %', test_user_id;
-- END $$;

-- If this succeeds without error, your signup should work!

-- ============================================
-- CLEANUP: Remove test user
-- ============================================
-- DELETE FROM auth.users WHERE email = 'test@example.com';

-- ============================================
-- SUMMARY OF FIXES
-- ============================================
-- 1. Check what's failing (STEP 1-4)
-- 2. Disable broken trigger temporarily (STEP 5)
-- 3. Create missing table if needed (STEP 6)
-- 4. Fix RLS if blocking (STEP 7)
-- 5. Create proper trigger (STEP 8)
-- 6. Test it works (STEP 9)

-- After running these fixes, try signing up from your app again!
