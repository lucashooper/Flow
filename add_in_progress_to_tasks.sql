-- Add in_progress column to tasks table
-- This allows tracking tasks that are currently being worked on
-- Tasks marked as in_progress will be dimmed to reduce visual clutter

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS in_progress BOOLEAN DEFAULT FALSE;

-- Update existing tasks to have in_progress = false
UPDATE tasks
SET in_progress = FALSE
WHERE in_progress IS NULL;
