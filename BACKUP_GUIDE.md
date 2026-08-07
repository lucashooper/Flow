# Complete Backup Guide

## Why the Browser Export Didn't Get Images

**The browser export only gets:**
- ✅ Note content (text, HTML)
- ✅ Folder names
- ✅ Image URLs (the links)
- ❌ NOT the actual image files

**Images are stored separately** in Supabase Storage, not in the database. The notes only contain URLs like:
```
https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/note-images/images/abc123.png
```

## Complete Backup (Database + Images)

### Method 1: Supabase CLI (Recommended)

**1. Install Supabase CLI** ✅ (you already did this)

**2. Link your project** ✅ (you already did this)

**3. Backup database:**
```bash
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Create backup directory
mkdir backups

# Dump database
supabase db dump -f backups/flow-db-backup.sql
```

This exports:
- ✅ All notes
- ✅ All folders  
- ✅ All users
- ✅ RLS policies
- ✅ Table schemas
- ❌ NOT images (they're in Storage, not database)

**4. Backup images:**

Run the Node.js script I created:
```bash
# Install dotenv if needed
npm install dotenv

# Download all images
node backup-images.js backups/images
```

This downloads all images to `backups/images/` folder.

---

### Method 2: Manual Web Dashboard

**Database:**
1. Go to Supabase Dashboard
2. Database → Backups
3. Click "Download backup" (if available on your plan)
4. If not available: Use Method 1 (CLI) above

**Images:**
- No bulk download in dashboard
- Must use CLI or script (Method 1)

---

## What Each Backup Contains

### Browser Console Export (JSON)
```javascript
{
  notes: [
    { id: "...", title: "...", content: "...", 
      // Image URLs are IN the content
      content: '<img src="https://...supabase.co/.../image.png">' 
    }
  ],
  folders: [...]
}
```
- ✅ Quick export
- ✅ Works offline
- ❌ Just URLs, not actual images

### Supabase CLI Database Dump (SQL)
```sql
INSERT INTO notes (id, title, content, ...) VALUES (...);
INSERT INTO folders (id, name, ...) VALUES (...);
-- All your data in SQL format
```
- ✅ Complete database
- ✅ Directly restorable
- ❌ Still no images (separate storage)

### Image Backup Script (Files)
```
backups/images/
  ├── abc123-1234567890.png
  ├── def456-1234567891.jpg
  ├── xyz789-1234567892.png
  └── manifest.json
```
- ✅ Actual image files
- ✅ Can re-upload anywhere
- ⚠️  Large download (~storage size)

---

## Complete Backup Commands

Run these commands in PowerShell:

```powershell
# Navigate to project
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Create backup directory with timestamp
$backupDir = "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Path $backupDir

# 1. Backup database
Write-Host "📊 Backing up database..." -ForegroundColor Green
supabase db dump -f "$backupDir\database.sql"

# 2. Backup images
Write-Host "📸 Downloading images..." -ForegroundColor Green
node backup-images.js "$backupDir\images"

# 3. Browser export (open /admin and click Export)

Write-Host "✅ Backup complete: $backupDir" -ForegroundColor Green
```

---

## Restore to New Supabase Project

**1. Create new Supabase project**

**2. Restore database:**
```bash
# Get connection string from new project settings
supabase db push --db-url "postgresql://postgres:PASSWORD@HOST:5432/postgres" --file backups/database.sql
```

**3. Create storage bucket:**
```sql
-- In new project SQL editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true);

-- Set up storage policies
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'note-images');

CREATE POLICY "Authenticated users upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-images' AND
    auth.role() = 'authenticated'
  );
```

**4. Re-upload images:**

Two options:

**Option A: Supabase CLI**
```bash
# Upload each image
cd backups/images
for file in *.png *.jpg; do
  supabase storage cp "$file" note-images/images/"$file"
done
```

**Option B: Web Dashboard**
- Go to Storage → note-images
- Create "images" folder
- Drag and drop all images from `backups/images/`

**5. Update .env and deploy**
```bash
# Update .env with new Supabase URL + anon key
VITE_SUPABASE_URL=https://new-project.supabase.co
VITE_SUPABASE_ANON_KEY=new-anon-key

# Build and deploy
npm run build
```

---

## Why You Don't See Admin Dashboard

The admin check is in the code (`user?.email === 'edwardsjonny547@gmail.com'`), so it should work. 

**Possible issues:**

1. **Not logged in as that email**
   - Check: Open console, type `localStorage.getItem('supabase.auth.token')`
   - Or: Go to Settings → Profile (shows your email)

2. **Old cached build**
   - Clear browser cache: `Ctrl+Shift+Delete` → Clear cache
   - Hard refresh: `Ctrl+F5`

3. **Not deployed yet**
   - Did you upload the new `dist/` folder to your host?
   - Current live site still has old code

**To verify email in console:**
```javascript
// In browser console on your app
const token = localStorage.getItem('supabase.auth.token');
const parsed = token ? JSON.parse(token) : null;
console.log('Current user:', parsed?.currentSession?.user?.email);
```

---

## Quick Backup Checklist

**Before any changes:**

- [ ] Run: `supabase db dump -f backups/database-backup.sql`
- [ ] Run: `node backup-images.js backups/images`
- [ ] Go to `/admin` → Export All Data (JSON)
- [ ] Screenshot your folder structure

**After backup:**
- [ ] Verify `database-backup.sql` exists and has content
- [ ] Verify `backups/images/` has your images
- [ ] Verify JSON file downloaded
- [ ] Store backups somewhere safe (external drive, cloud storage)

---

## Emergency Recovery

If everything breaks:

1. **Database**: Restore from `database-backup.sql`
2. **Images**: Re-upload from `backups/images/`  
3. **Notes**: Import JSON from `/admin` export

All three together = complete recovery.

---

## Storage Costs

**Current: 0.349 GB database + images in storage**

**Backup sizes:**
- Database SQL: ~10-50 MB (text)
- Images folder: ~300 MB (binary files)
- JSON export: ~20 MB (text with URLs)

**Total backup**: ~400 MB

Store on:
- External drive (free)
- Google Drive (15 GB free)
- Dropbox (2 GB free)
- OneDrive (5 GB free)
