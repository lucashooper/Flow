-- Add cover_image column to dashboards table
-- Run this in Supabase SQL Editor

ALTER TABLE dashboards 
ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- Add comment for documentation
COMMENT ON COLUMN dashboards.cover_image IS 'URL to dashboard cover image stored in Supabase Storage';
