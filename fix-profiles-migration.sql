-- ============================================
-- Fix Profile Migration Issue
-- ============================================
-- Run this in Supabase SQL Editor to fix the profile display issue

-- Step 1: Add profile_picture_url column to user_profiles if it doesn't exist
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Step 2: Check if old profiles table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles'
  ) THEN
    -- Migrate data from profiles to user_profiles
    INSERT INTO user_profiles (id, username, email, created_at, updated_at, profile_picture_url)
    SELECT 
      id, 
      username, 
      email, 
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW()),
      profile_picture_url
    FROM profiles
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      profile_picture_url = EXCLUDED.profile_picture_url,
      updated_at = EXCLUDED.updated_at;
    
    RAISE NOTICE 'Migrated profiles to user_profiles';
  ELSE
    RAISE NOTICE 'No profiles table found - skipping migration';
  END IF;
END $$;

-- Step 3: Verify the data
SELECT id, username, email, profile_picture_url 
FROM user_profiles 
ORDER BY created_at DESC;
