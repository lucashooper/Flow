# Simple Backup Without Docker

The Supabase CLI needs Docker Desktop to be running. Here are alternatives:

## Option 1: Backup via Supabase Dashboard (Easiest)

### Database Backup
1. Go to https://app.supabase.com
2. Select your project: `oetxqcyktahczrqrxlds`
3. Click **SQL Editor** in left sidebar
4. Run this query:
   ```sql
   -- Get all notes
   SELECT * FROM notes;
   ```
5. Click **Download CSV** button
6. Repeat for folders:
   ```sql
   -- Get all folders
   SELECT * FROM folders;
   ```
7. Download CSV

**Result:** CSV files with all your data (not as good as SQL dump, but works)

### Images Backup
1. In same Supabase dashboard
2. Click **Storage** in left sidebar
3. Click **note-images** bucket
4. Click **images** folder
5. **Problem:** No bulk download button
6. **Solution:** Use the backup script (see Option 2)

---

## Option 2: Use Our Backup Script (Best for Images)

This downloads images without needing Docker:

```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Make sure .env has your Supabase credentials
# VITE_SUPABASE_URL=https://oetxqcyktahczrqrxlds.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Download all images
node backup-images.js "c:\Users\lucas\Downloads\flow-backup-2026-08-07\images"
```

**Time:** 5-15 minutes depending on image count  
**Result:** All images downloaded to local folder

---

## Option 3: Install Docker Desktop (For Full SQL Backup)

If you want the full SQL dump:

1. **Download Docker Desktop:**
   https://www.docker.com/products/docker-desktop

2. **Install and start Docker Desktop**

3. **Wait for it to fully start** (whale icon in system tray should be steady, not animated)

4. **Then run:**
   ```powershell
   cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"
   supabase db dump -f "c:\Users\lucas\Downloads\flow-backup-2026-08-07\database.sql"
   ```

**Pros:** Complete SQL backup with all table structures, policies, functions  
**Cons:** Requires 1.5 GB download for Docker Desktop

---

## Option 4: Manual SQL Export (No Docker Needed)

1. Go to https://app.supabase.com
2. Select your project
3. Click **SQL Editor**
4. Create new query and run:

```sql
-- Export notes table
COPY (SELECT * FROM notes) TO STDOUT WITH CSV HEADER;
```

5. Copy the output
6. Save to `notes.csv`

7. Repeat for folders:
```sql
COPY (SELECT * FROM folders) TO STDOUT WITH CSV HEADER;
```

**Note:** This gives you CSV, not SQL. SQL is better for restore, but CSV works in a pinch.

---

## Option 5: Use Your Existing JSON Backup (Already Have)

You already have `flow-indexeddb-backup-1786112234195.json` which contains:
- ✅ All note content
- ✅ All folder data
- ✅ Image URLs

**To use this for restore:**
1. Create new Supabase project
2. Open admin panel in Flow (once we fix it)
3. Use "Import Data" feature (if we add it)
4. Or manually insert via SQL

---

## Recommended: Quick Backup Right Now

**Without Docker, do this:**

```powershell
# 1. You already have JSON backup ✅
# Location: c:\Users\lucas\Downloads\flow-indexeddb-backup-1786112234195.json

# 2. Download images (IMPORTANT - run this now)
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"
node backup-images.js "c:\Users\lucas\Downloads\flow-backup-2026-08-07\images"

# 3. Export from Supabase dashboard
# Go to SQL Editor and run:
# SELECT * FROM notes;
# Download CSV
# SELECT * FROM folders;  
# Download CSV
```

**Result:**
- ✅ JSON backup (already have)
- ✅ Images backup (from script)
- ✅ CSV exports (from dashboard)

**Good enough for migration test without installing Docker.**

---

## What Each Backup Gives You

| Method | Notes | Folders | Images | SQL Structure | RLS Policies |
|--------|-------|---------|--------|---------------|--------------|
| Docker SQL dump | ✅ | ✅ | ❌ | ✅ | ✅ |
| JSON backup | ✅ | ✅ | ❌ | ❌ | ❌ |
| CSV export | ✅ | ✅ | ❌ | ❌ | ❌ |
| Image script | ❌ | ❌ | ✅ | ❌ | ❌ |

**Complete backup = JSON/CSV + Image script**

Good enough for:
- ✅ Restoring all your notes
- ✅ Restoring all your folders
- ✅ Restoring all your images
- ❌ NOT preserving SQL functions/triggers (you probably don't have any)
- ❌ NOT preserving RLS policies (we can recreate these)

---

## Run This Now

```powershell
# Navigate to project
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Check .env has Supabase credentials
Get-Content .env | Select-String "VITE_SUPABASE"

# Should show:
# VITE_SUPABASE_URL=https://oetxqcyktahczrqrxlds.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# If yes, run image backup:
node backup-images.js "c:\Users\lucas\Downloads\flow-backup-2026-08-07\images"

# Wait 5-15 minutes
# You'll see:
# 🔄 Fetching image list from Supabase...
# 📸 Found XX images
# ⬇️  Downloading: image1.png (1/XX)
# ...
# ✅ Download complete!
```

---

## After Backup

You'll have:
```
c:\Users\lucas\Downloads\
├── flow-indexeddb-backup-1786112234195.json  (notes + folders data)
└── flow-backup-2026-08-07\
    └── images\
        ├── abc123.png
        ├── def456.jpg
        ├── ...
        └── manifest.json
```

**Copy this to:**
- External drive
- Google Drive
- OneDrive

**Then you're safe to test migration.**
