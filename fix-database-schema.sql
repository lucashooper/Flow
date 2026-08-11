-- ====================================
-- CORRECTED Flow Notes Database Schema
-- This fixes the missing dashboard_id column
-- ====================================

-- First, check if tables exist
DO $$ 
BEGIN
  RAISE NOTICE 'Checking existing tables...';
END $$;

-- Drop and recreate folders table with correct schema
DROP TABLE IF EXISTS public.folders CASCADE;

CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  dashboard_id UUID,  -- THIS WAS MISSING!
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  icon_url TEXT,
  is_starred BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0
);

-- Drop and recreate notes table (in case it was created without dashboard_id)
DROP TABLE IF EXISTS public.notes CASCADE;

CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  dashboard_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  emoji TEXT,
  drawing_data JSONB,
  is_starred BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0
);

-- Create dashboards table
DROP TABLE IF EXISTS public.dashboards CASCADE;

CREATE TABLE public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  layout JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_profiles table
DROP TABLE IF EXISTS public.user_profiles CASCADE;

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  pin_hash TEXT
);

-- Create indexes
CREATE INDEX idx_folders_user_id ON public.folders(user_id);
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX idx_folders_dashboard_id ON public.folders(dashboard_id);  -- NEW INDEX
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_folder_id ON public.notes(folder_id);
CREATE INDEX idx_notes_dashboard_id ON public.notes(dashboard_id);  -- NEW INDEX
CREATE INDEX idx_dashboards_user_id ON public.dashboards(user_id);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Users can view own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notes
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboards
CREATE POLICY "Users can view own dashboards" ON public.dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboards" ON public.dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards" ON public.dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards" ON public.dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-images',
  'note-images',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Public read access for note-images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload to note-images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Public read access for note-images" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images');

CREATE POLICY "Authenticated users can upload to note-images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'note-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'note-images');

CREATE POLICY "Users can delete own images" ON storage.objects
  FOR DELETE USING (bucket_id = 'note-images');

-- Verify tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
