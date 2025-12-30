-- ============================================
-- Fix Signup RLS Policy Issue
-- ============================================
-- Run this in Supabase SQL Editor
-- The problem: auth.uid() is NULL during signup until email is confirmed
-- Solution: Allow INSERT for authenticated users OR during signup

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;

-- Create a new policy that allows INSERT during signup
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR  -- Normal case: user is authenticated
    auth.role() = 'authenticated'  -- During signup: user exists but not confirmed yet
  );

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
AND cmd = 'INSERT';
