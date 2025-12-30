-- ============================================
-- Migrate profiles to user_profiles table
-- ============================================
-- This migrates data from old 'profiles' table to 'user_profiles'
-- Run this in Supabase SQL Editor

-- Check if profiles table exists and has data
SELECT COUNT(*) as old_profiles_count FROM profiles;

-- Check if user_profiles table exists and has data
SELECT COUNT(*) as new_profiles_count FROM user_profiles;

-- Migrate data from profiles to user_profiles (if profiles table exists)
INSERT INTO user_profiles (id, username, email, created_at, updated_at, profile_picture_url)
SELECT 
  id, 
  username, 
  email, 
  created_at, 
  updated_at,
  profile_picture_url
FROM profiles
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  profile_picture_url = EXCLUDED.profile_picture_url,
  updated_at = EXCLUDED.updated_at;

-- Verify migration
SELECT COUNT(*) as migrated_count FROM user_profiles;

-- Optional: Drop old profiles table after verifying migration
-- DROP TABLE IF EXISTS profiles;
