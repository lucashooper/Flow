-- Add position and list fields to tasks table

-- Add position column for drag-and-drop ordering
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Add list/project column (defaults to 'Inbox')
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list VARCHAR(255) DEFAULT 'Inbox';

-- Create index on position for faster ordering
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(user_id, position);

-- Create index on list for filtering
CREATE INDEX IF NOT EXISTS idx_tasks_list ON tasks(user_id, list);

-- Update existing tasks to have sequential positions
WITH numbered_tasks AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
  FROM tasks
  WHERE position = 0
)
UPDATE tasks
SET position = numbered_tasks.row_num
FROM numbered_tasks
WHERE tasks.id = numbered_tasks.id;
