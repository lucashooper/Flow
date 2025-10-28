-- ============================================
-- MIGRATION: Add drawing_data to notes table
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
-- This adds a column to store base64 encoded canvas drawing data for each note
-- ============================================

-- Check if table exists first
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notes') THEN
        -- Add drawing_data column if it doesn't exist
        ALTER TABLE notes 
        ADD COLUMN IF NOT EXISTS drawing_data TEXT;
        
        -- Add comment to explain the column
        COMMENT ON COLUMN notes.drawing_data IS 'Base64 encoded canvas drawing data overlay for the note';
        
        RAISE NOTICE 'Successfully added drawing_data column to notes table';
    ELSE
        RAISE EXCEPTION 'Table "notes" does not exist. Please create the notes table first.';
    END IF;
END $$;
