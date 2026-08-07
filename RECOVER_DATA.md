# Data Recovery Guide

Your notes are still in your browser's IndexedDB. Follow these steps to recover them.

## Step 1: Export Data from Browser

Open your production site, press **F12** to open DevTools, go to **Console**, and paste this script:

```javascript
// Export all data from IndexedDB
(async function exportData() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('FlowDB');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = db.transaction(['notes', 'folders'], 'readonly');
  
  const notes = await new Promise((resolve) => {
    const request = transaction.objectStore('notes').getAll();
    request.onsuccess = () => resolve(request.result);
  });
  
  const folders = await new Promise((resolve) => {
    const request = transaction.objectStore('folders').getAll();
    request.onsuccess = () => resolve(request.result);
  });

  const exportData = {
    notes,
    folders,
    exported_at: new Date().toISOString()
  };

  console.log('📦 EXPORTED DATA:', exportData);
  console.log(`\n📊 Summary:\n- ${notes.length} notes\n- ${folders.length} folders`);
  
  // Find "The Lava Opportunity" or similar
  const lavaNote = notes.find(n => 
    n.title?.toLowerCase().includes('lava') || 
    n.title?.toLowerCase().includes('opportunity')
  );
  if (lavaNote) {
    console.log('\n🌋 Found "Lava" note:', lavaNote);
  }

  // Find David meeting folder
  const davidFolder = folders.find(f => 
    f.name?.toLowerCase().includes('david') && 
    f.name?.toLowerCase().includes('meeting')
  );
  if (davidFolder) {
    console.log('\n📁 Found David meeting folder:', davidFolder);
    const davidNotes = notes.filter(n => n.folder_id === davidFolder.id);
    console.log(`  → Contains ${davidNotes.length} notes:`, davidNotes.map(n => n.title));
  }

  // Download as JSON
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flow-data-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('\n✅ Download started! Save this file.');
  
  return exportData;
})();
```

This will:
- Show you all your local data in the console
- Find "The Lava Opportunity" note if it exists
- Find the David meeting folder and its notes
- Download a complete JSON backup

## Step 2: Check Supabase Database

Go to your Supabase dashboard → SQL Editor and run:

```sql
-- Check if folders table has required columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'folders' 
  AND table_schema = 'public';

-- Check if your David meeting folder exists
SELECT id, name, user_id, created_at 
FROM folders 
WHERE name ILIKE '%david%meeting%' 
  OR name ILIKE '%david%';

-- Check if The Lava note exists
SELECT id, title, folder_id, user_id, created_at 
FROM notes 
WHERE title ILIKE '%lava%' 
  OR title ILIKE '%opportunity%';

-- Check RLS policies on notes table
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notes';

-- Check RLS policies on folders table
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'folders';
```

## Step 3: Fix Missing Columns

If `icon_url` or `is_starred` columns are missing from folders table:

```sql
-- Add missing columns to folders table
ALTER TABLE folders 
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;
```

## Step 4: Fix RLS Policies

If RLS policies are blocking inserts, run:

```sql
-- Enable RLS if not already enabled
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create/update policies for folders
DROP POLICY IF EXISTS "Users can do everything with own folders" ON folders;
CREATE POLICY "Users can do everything with own folders"
  ON folders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create/update policies for notes
DROP POLICY IF EXISTS "Users can do everything with own notes" ON notes;
CREATE POLICY "Users can do everything with own notes"
  ON notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## Step 5: Manually Restore Data (if needed)

If sync still fails, you can manually insert the data using the exported JSON:

```sql
-- Insert a folder (replace with actual values from your export)
INSERT INTO folders (id, name, emoji, icon_url, is_starred, user_id, parent_id, dashboard_id, created_at, updated_at, position)
VALUES (
  'your-folder-id',
  'David meeting',
  '📁',
  NULL,
  false,
  'your-user-id',
  NULL,
  NULL,
  NOW(),
  NOW(),
  0
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Insert a note (replace with actual values)
INSERT INTO notes (id, title, content, user_id, folder_id, dashboard_id, created_at, updated_at, emoji, drawing_data, is_starred, position)
VALUES (
  'your-note-id',
  'The Lava Opportunity',
  '<p>Your note content here</p>',
  'your-user-id',
  'your-folder-id',
  NULL,
  NOW(),
  NOW(),
  NULL,
  NULL,
  false,
  0
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();
```

## Step 6: Clear Outbox and Resync

After fixing database issues, clear the stuck sync queue in browser console:

```javascript
// Clear stuck outbox items
(async function clearOutbox() {
  const db = await new Promise((resolve) => {
    const request = indexedDB.open('FlowDB');
    request.onsuccess = () => resolve(request.result);
  });
  
  const transaction = db.transaction(['outbox'], 'readwrite');
  const cleared = await new Promise((resolve) => {
    const request = transaction.objectStore('outbox').clear();
    request.onsuccess = () => resolve(true);
  });
  
  console.log('✅ Outbox cleared. Refresh the page to resync.');
})();
```

Then refresh the page. The app will re-sync your local data to Supabase.

## Prevention

To prevent this in the future:
1. Always run migrations on production before deploying new code
2. Test RLS policies after changes
3. Keep regular backups of your Supabase database

## Need Help?

If you're still stuck:
1. Share the console output from Step 1
2. Share the SQL results from Step 2
3. I can help write the exact SQL to restore your specific data
