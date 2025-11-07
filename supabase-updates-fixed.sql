-- ============================================
-- Flow App Database Updates (Fixed)
-- ============================================

-- 1. Add profile_picture_url to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 2. Add is_starred column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;

-- 2b. Set default value for existing notes (in case they're NULL)
UPDATE notes SET is_starred = false WHERE is_starred IS NULL;

-- 3. Create index for starred notes (for faster queries)
CREATE INDEX IF NOT EXISTS idx_notes_starred
ON notes(user_id, is_starred, updated_at DESC);

-- 4. Create the profile-pictures storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS Policies (DROP first if they exist, then recreate)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;

-- Recreate policies
CREATE POLICY "Users can upload their own profile picture"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile picture"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile picture"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view profile pictures"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- ============================================
-- DONE! The is_starred column should now exist.
-- ============================================
