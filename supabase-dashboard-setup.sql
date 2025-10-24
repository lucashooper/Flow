-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📝',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add dashboard_id to existing tables
ALTER TABLE notes ADD COLUMN IF NOT EXISTS dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notes_dashboard_id ON notes(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_folders_dashboard_id ON folders(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);

-- Enable RLS for dashboards
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- RLS policies for dashboards
CREATE POLICY "Users can view their own dashboards" ON dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards" ON dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards" ON dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards" ON dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- Update existing notes and folders RLS policies to include dashboard filtering
DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can create their own notes" ON notes;
CREATE POLICY "Users can create their own notes" ON notes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

-- Similar updates for folders
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
CREATE POLICY "Users can view their own folders" ON folders
  FOR SELECT USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
CREATE POLICY "Users can create their own folders" ON folders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
CREATE POLICY "Users can update their own folders" ON folders
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id in (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;
CREATE POLICY "Users can delete their own folders" ON folders
  FOR DELETE USING (
    auth.uid() = user_id AND 
    (dashboard_id IS NULL OR dashboard_id IN (
      SELECT id FROM dashboards WHERE user_id = auth.uid()
    ))
  );

-- Function to create default dashboard for new users
CREATE OR REPLACE FUNCTION create_default_dashboard()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dashboards (user_id, name, emoji, is_active)
  VALUES (NEW.id, 'My Notes', '📝', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default dashboard when user signs up
DROP TRIGGER IF EXISTS create_default_dashboard_trigger ON auth.users;
CREATE TRIGGER create_default_dashboard_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_dashboard();

-- Create default dashboard for existing users who don't have one
INSERT INTO dashboards (user_id, name, emoji, is_active)
SELECT 
  u.id,
  'My Notes',
  '📝',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM dashboards d WHERE d.user_id = u.id
);
