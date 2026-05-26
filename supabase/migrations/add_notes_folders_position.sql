-- Add position columns for drag-and-drop ordering (local app uses these in IndexedDB)
-- Run in Supabase SQL Editor if you want folder/note order persisted to the cloud.

ALTER TABLE folders ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_folders_position ON folders(dashboard_id, position);
CREATE INDEX IF NOT EXISTS idx_notes_position ON notes(dashboard_id, position);
