-- ============================================
-- Supabase Profile Pictures Storage Setup
-- ============================================

-- Step 1: Create the storage bucket for profile pictures
-- Run this in Supabase SQL Editor or Storage UI
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true);

-- Step 2: Set up Row Level Security (RLS) policies for the bucket

-- Policy 1: Allow users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Allow users to update their own profile pictures
CREATE POLICY "Users can update their own profile picture"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Allow users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow anyone to view profile pictures (public read)
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Step 3: Add profile_picture_url column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Step 4: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_picture_url
ON profiles(profile_picture_url);

-- ============================================
-- Usage Notes:
-- ============================================
-- 1. Profile pictures will be stored in format: profile-pictures/{user_id}/{filename}
-- 2. The bucket is public, so images are accessible via public URL
-- 3. Users can only manage their own pictures (enforced by RLS)
-- 4. The profile_picture_url column stores the public URL of the uploaded image
