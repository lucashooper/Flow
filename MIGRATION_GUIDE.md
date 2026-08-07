# Safe Migration Guide to New Supabase Project

## Your Questions Answered

### 1. Where is my data actually stored?

**Current Architecture: Offline-First**

```
Primary: IndexedDB (Browser) ← Your data lives here
  ↓ syncs when online
Secondary: Supabase (Cloud) ← Backup copy
```

**Why?** The app works offline. When you create/edit notes:
1. Saved to IndexedDB immediately (instant)
2. Queued for sync to Supabase (background)
3. Supabase gets updated when online

**Your data is safe** because:
- 1008 notes are in your browser's IndexedDB
- Most are also in Supabase (synced)
- If Supabase goes down, you still have everything locally

---

### 2. Export: JSON vs SQL Backup

**Current Export (Admin Dashboard)**:
- ✅ Downloads JSON with all notes + folders
- ✅ Complete metadata (IDs, timestamps, content)
- ❌ NOT directly uploadable to Supabase (needs SQL conversion)

**For True Backup, Use Both**:

#### Option A: Supabase Dashboard Backup (Best)
```bash
# In Supabase Dashboard → Database → Backups
# Download a full database backup (.sql.gz file)
# Includes everything: notes, folders, users, RLS policies
```

#### Option B: SQL Export Script
Run this in Supabase SQL Editor to get importable SQL:

```sql
-- Export all folders
COPY (
  SELECT * FROM folders WHERE user_id = auth.uid()
) TO '/tmp/folders_backup.csv' WITH CSV HEADER;

-- Export all notes
COPY (
  SELECT * FROM notes WHERE user_id = auth.uid()
) TO '/tmp/notes_backup.csv' WITH CSV HEADER;
```

Then download the CSV files.

#### Option C: Admin Dashboard + Manual SQL Generation
1. Export JSON from `/admin`
2. Use the emergency HTML tool I created earlier
3. It generates SQL INSERT statements
4. Run that SQL in new project

---

### 3. Safe Migration Test Plan

**Yes! You can test without losing anything.**

#### Step-by-Step Testing:

**1. Backup Everything First**
```bash
# In Supabase Dashboard
Project → Settings → Database → Download backup

# In Flow app
/admin → Export All Data (JSON)

# Browser Console (backup IndexedDB)
# Run the export script from earlier
```

**2. Create New Supabase Project**
- Go to supabase.com
- Create new project (call it "flow-test")
- Run migrations to create tables:

```sql
-- Create folders table
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  emoji TEXT,
  icon_url TEXT,
  is_starred BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users NOT NULL,
  parent_id UUID REFERENCES folders,
  dashboard_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  position INTEGER DEFAULT 0
);

-- Create notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users NOT NULL,
  folder_id UUID REFERENCES folders,
  dashboard_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  emoji TEXT,
  drawing_data JSONB,
  is_starred BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users manage own folders" ON folders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own notes" ON notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true);

CREATE POLICY "Users upload own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public image access" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images');
```

**3. Test with Separate .env File**

Create `.env.test` in your project:
```
VITE_SUPABASE_URL=https://your-new-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-new-anon-key
```

Then test locally:
```bash
# Backup current .env
cp .env .env.backup

# Copy test config
cp .env.test .env

# Run dev server
npm run dev

# Open in DIFFERENT browser (Firefox if you use Chrome)
# or use Incognito/Private window
```

**Why different browser?**
- Your main browser still has IndexedDB with all 1008 notes
- Test browser starts fresh, syncs to new Supabase
- Original data untouched

**4. Migrate Data to Test Project**

Option 1: Let sync handle it
- Clear browser cache in test browser
- Log in with same credentials
- IndexedDB empty, will pull from new Supabase (empty)
- Manually copy a few notes to test

Option 2: Bulk import
- Use SQL from JSON export
- Run INSERT statements in new project
- Test browser will pull them down

**5. Verify Test Works**
- Create a note in test environment
- Refresh page (should persist)
- Check Supabase dashboard (note should be there)
- Check images upload correctly

**6. Decide: Keep or Rollback**

If test works:
```bash
# Update production .env
cp .env.test .env

# Deploy with new config
npm run build
# Upload dist/ to hosting
```

If test fails:
```bash
# Rollback to original
cp .env.backup .env

# Nothing lost!
```

---

### 4. Production Migration Steps

**When you're ready to actually migrate:**

**A. Before Migration**
1. ✅ Export from `/admin` dashboard
2. ✅ Download Supabase database backup
3. ✅ Screenshot your folder structure
4. ✅ Note which dashboards you use

**B. Create New Project**
1. Create new Supabase project (Pro plan $25/mo for 200GB egress)
2. Run migration SQL (tables, RLS, storage)
3. Create user account (same email)

**C. Migrate Images**

Images are the big cost. Two options:

**Option 1: Leave images in old Supabase** (easiest)
- Images already have full URLs in notes
- Old project free tier = 5 GB egress
- Just for images that don't change = less egress
- New project handles new images only

**Option 2: Copy images to new project**
```bash
# Download all images
# Use Supabase CLI or write a script

# Re-upload to new project
# Update URLs in notes
```

**D. Migrate Data**

```bash
# Export from old Supabase (SQL Editor)
COPY (SELECT * FROM folders WHERE user_id = 'your-user-id')
TO STDOUT WITH CSV HEADER;

# Save output, then in new project:
COPY folders FROM '/path/to/folders.csv' CSV HEADER;

# Repeat for notes
```

**E. Switch Production**
1. Update `.env` with new Supabase URL + key
2. Clear localStorage in your main browser:
   ```javascript
   localStorage.clear();
   indexedDB.deleteDatabase('FlowDB');
   ```
3. Refresh page
4. Log in
5. Data syncs down from new Supabase

**F. Verify**
- Check note count
- Open folders
- Verify images load
- Create new note (tests upload)

---

### 5. Zero-Downtime Migration

**Advanced: Keep both running**

1. Update app to support dual sync:
   ```typescript
   // Write to both old + new Supabase
   // Read from new, fallback to old
   ```

2. Gradual migration:
   - Day 1: App writes to both, reads from old
   - Day 3: App writes to both, reads from new
   - Day 7: App only uses new (turn off old)

This requires code changes but zero data loss risk.

---

## Recommendation

**For your situation:**

1. **Today**: Go to `/admin`, export JSON backup (safety net)
2. **This week**: Upgrade current Supabase to Pro ($25/mo)
   - Solves egress problem immediately
   - No migration needed
   - 200 GB egress = plenty of headroom
3. **Later** (if cost is issue): Test migration to Cloudflare R2 for images

**Why not migrate?**
- Migration is complex
- Risk of data loss
- $25/mo is reasonable for your usage
- Cheaper than your time debugging migration issues

**Your 1008 notes are safe because:**
- ✅ In IndexedDB (primary storage)
- ✅ In Supabase (synced backup)
- ✅ Exportable as JSON anytime

Migration is an option, but **upgrading Supabase Pro is simpler and safer**.
