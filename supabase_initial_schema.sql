-- ============================================
-- INITIAL DATABASE SCHEMA FOR FLOW APP
-- ============================================
-- 
-- HOW TO RUN:
-- 1. Go to your Supabase project dashboard: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Click "New Query"
-- 5. Copy and paste this entire file
-- 6. Click "Run" or press Ctrl+Enter
--
-- This creates all necessary tables for the Flow note-taking app
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DASHBOARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📝',
    cover_image TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_active ON dashboards(user_id, is_active);

-- ============================================
-- FOLDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_dashboard_id ON folders(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

-- ============================================
-- NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'Untitled',
    content TEXT DEFAULT '',
    emoji TEXT,
    drawing_data TEXT,  -- Base64 encoded canvas drawing data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_dashboard_id ON notes(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Dashboards policies
CREATE POLICY "Users can view their own dashboards"
    ON dashboards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboards"
    ON dashboards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
    ON dashboards FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
    ON dashboards FOR DELETE
    USING (auth.uid() = user_id);

-- Folders policies
CREATE POLICY "Users can view their own folders"
    ON folders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
    ON folders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
    ON folders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
    ON folders FOR DELETE
    USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view their own notes"
    ON notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
    ON notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
    ON notes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
    ON notes FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STORAGE BUCKET FOR IMAGES
-- ============================================

-- Create storage bucket for note images
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'note-images');

CREATE POLICY "Users can delete their own images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📝 Tables created: dashboards, folders, notes';
    RAISE NOTICE '🔒 Row Level Security enabled';
    RAISE NOTICE '🖼️  Storage bucket created: note-images';
    RAISE NOTICE '🎨 Drawing data column included in notes table';
END $$;
