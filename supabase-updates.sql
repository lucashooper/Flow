-- ============================================
-- Flow App Database Updates
-- ============================================

-- 1. Add profile_picture_url to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 2. Add is_starred column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- 3. Create index for starred notes (for faster queries)
CREATE INDEX IF NOT EXISTS idx_notes_starred
ON notes(user_id, is_starred, updated_at DESC);

-- 4. Create the profile-pictures storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS Policies for profile-pictures bucket

-- Allow users to upload their own profile picture
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own profile picture
CREATE POLICY "Users can update their own profile picture"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile picture
CREATE POLICY "Users can delete their own profile picture"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to view profile pictures (public read)
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- ============================================
-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- ============================================
