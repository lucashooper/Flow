-- ============================================
-- DELETE USER ACCOUNT FUNCTION
-- ============================================
-- This function allows users to delete their own account
-- It will cascade delete all related data and remove the auth user
-- Run this in your Supabase SQL Editor

-- Create the function to delete a user account
CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user's ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user's notes (will cascade to related tables if foreign keys are set up)
  DELETE FROM notes WHERE user_id = current_user_id;
  
  -- Delete user's folders
  DELETE FROM folders WHERE user_id = current_user_id;
  
  -- Delete user's dashboards
  DELETE FROM dashboards WHERE user_id = current_user_id;
  
  -- Delete user profile
  DELETE FROM user_profiles WHERE id = current_user_id;
  
  -- Delete the auth user (this is the critical part)
  DELETE FROM auth.users WHERE id = current_user_id;
  
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_account() IS 'Allows authenticated users to delete their own account and all related data';
