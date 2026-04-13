-- Add parent_id and position columns to dashboards table for nested dashboards
ALTER TABLE dashboards 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES dashboards(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Create index for faster queries on parent_id
CREATE INDEX IF NOT EXISTS idx_dashboards_parent_id ON dashboards(parent_id);

-- Create index for faster queries on position
CREATE INDEX IF NOT EXISTS idx_dashboards_position ON dashboards(position);

-- Update existing dashboards to have position based on created_at
WITH ranked_dashboards AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS pos
  FROM dashboards
  WHERE position IS NULL
)
UPDATE dashboards
SET position = ranked_dashboards.pos
FROM ranked_dashboards
WHERE dashboards.id = ranked_dashboards.id;
