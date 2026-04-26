ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed_at
ON tasks (user_id, completed_at DESC);
