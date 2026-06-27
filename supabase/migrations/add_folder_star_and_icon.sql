-- Folder starring and custom icon support
ALTER TABLE folders ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS icon_url TEXT;

CREATE INDEX IF NOT EXISTS idx_folders_starred ON folders(dashboard_id, is_starred);
