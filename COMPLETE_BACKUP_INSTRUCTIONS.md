# Complete Backup & Migration Guide

## Your Current Backup Status

### ✅ What You Have Backed Up
- **JSON file**: `flow-indexeddb-backup-1786112234195.json`
  - Contains: Note titles, content, folder names
  - Contains: Image URLs (like `https://oetxqcyktahczrqrxlds.supabase.co/storage/...`)
  - Size: Probably 1-5 MB

### ❌ What You're MISSING
- **Actual image files** (the .png, .jpg files themselves)
- Your notes have URLs pointing to images, but not the images

**Think of it like this:**
- Your JSON backup is like a document with hyperlinks
- But the actual images those links point to are still in Supabase Storage
- If you delete your Supabase project, those links break and images disappear

---

## How to Backup Images from Supabase

Images are stored separately in **Supabase Storage**, not the database.

### Method 1: Automated Script (Recommended)

**Step 1: Run the backup script**
```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Make sure you have the .env file with Supabase credentials
# Should contain VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Run the image backup
node backup-images.js "c:\Users\lucas\Downloads\flow-images-backup"
```

This will:
- Download ALL images from Supabase Storage
- Save them to `c:\Users\lucas\Downloads\flow-images-backup\`
- Create a manifest.json with metadata
- Take 5-15 minutes depending on how many images

**Output you'll see:**
```
🔄 Fetching image list from Supabase...
📸 Found 45 images
⬇️  Downloading: abc123-1234567890.png (1/45)
⬇️  Downloading: def456-1234567891.jpg (2/45)
...
✅ Download complete!
   Downloaded: 45
   Errors: 0
   Location: c:\Users\lucas\Downloads\flow-images-backup
```

### Method 2: Manual Download via Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project: `oetxqcyktahczrqrxlds`
3. Click **Storage** in left sidebar
4. Click **note-images** bucket
5. Click **images** folder
6. **Problem:** Supabase dashboard doesn't have bulk download
7. **Verdict:** Use Method 1 (script) instead

### Method 3: Supabase CLI

```bash
# Not recommended - no bulk download command
# CLI can list files but can't download all at once
supabase storage ls note-images
```

---

## Complete Backup Checklist

Before migrating or creating new Supabase project:

- [ ] **Database backup** (via Supabase CLI):
  ```powershell
  supabase db dump -f "c:\Users\lucas\Downloads\flow-db-backup.sql"
  ```
  - Takes ~30 seconds
  - Creates SQL file with all notes, folders, users, policies

- [ ] **Image backup** (via Node script):
  ```powershell
  node backup-images.js "c:\Users\lucas\Downloads\flow-images-backup"
  ```
  - Takes 5-15 minutes
  - Downloads all actual image files

- [ ] **JSON backup** (already done):
  - ✅ You have: `flow-indexeddb-backup-1786112234195.json`
  - This is a safety net, but database SQL is better for restore

---

## Safe Migration Test Plan

### Phase 1: Create Test Project (Safe, No Risk)

1. **Create new Supabase project**
   - Go to https://app.supabase.com
   - Click "New Project"
   - Name: `flow-test` or similar
   - Keep current project running

2. **Restore database to test project**
   ```bash
   supabase db push --db-url "postgresql://postgres:[NEW_PASSWORD]@[NEW_HOST]:5432/postgres" --file "c:\Users\lucas\Downloads\flow-db-backup.sql"
   ```

3. **Create storage bucket in test project**
   - Go to Storage in new project
   - Create bucket: `note-images` (public)
   - Upload images from `flow-images-backup\` folder

4. **Test the app with new project**
   - Update `.env.local` (NOT `.env`):
     ```
     VITE_SUPABASE_URL=https://NEW-PROJECT-ID.supabase.co
     VITE_SUPABASE_ANON_KEY=NEW-ANON-KEY
     ```
   - Run locally: `npm run dev`
   - Open http://localhost:5174
   - Verify:
     - ✅ Can log in
     - ✅ See all notes
     - ✅ See all folders
     - ✅ Images load correctly
     - ✅ Can create/edit notes
     - ✅ Admin dashboard appears

5. **If everything works:**
   - Update production `.env` with new project
   - Deploy to Netlify
   - **Keep old project running for 1 week** as backup

### Phase 2: Switch Production (After Testing)

Only do this after Phase 1 succeeds:

1. Update `.env` (production file)
2. Commit and push to GitHub
3. Netlify will auto-deploy
4. Test production site
5. Keep old Supabase project for 1 week before deleting

---

## Image Backup Deep Dive

### Where Are Your Images?

**In Supabase Storage:**
- Project: `oetxqcyktahczrqrxlds`
- Bucket: `note-images`
- Folder: `images/`
- Files: `abc123-1234567890.png`, etc.

**URLs in your notes:**
```
https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/note-images/images/abc123.png
```

### What the Backup Script Does

```javascript
// For each image in Supabase Storage:
1. List all files in note-images bucket
2. For each file:
   - Download from: https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/note-images/FILE
   - Save to: c:\Users\lucas\Downloads\flow-images-backup\FILE
3. Create manifest.json with:
   - File names
   - Sizes
   - Upload dates
   - Download status
```

### After Downloading

You'll have:
```
c:\Users\lucas\Downloads\flow-images-backup\
├── abc123-1234567890.png
├── def456-1234567891.jpg
├── xyz789-1234567892.png
├── ...
└── manifest.json
```

### Restoring Images to New Project

**Option A: Via Dashboard (Slow but Easy)**
1. Go to new project → Storage → note-images
2. Create `images` folder
3. Drag and drop all files from backup folder
4. Supabase preserves filenames, so URLs will work

**Option B: Via CLI (Fast but Complex)**
```bash
# For each image
supabase storage cp "local-file.png" note-images/images/file.png
```

---

## Why Images Aren't in Database

**Database stores:**
- Note titles
- Note content (HTML with `<img>` tags)
- Folder names
- User info

**The content looks like:**
```html
<p>Check out this image:</p>
<img src="https://oetxqcyktahczrqrxlds.supabase.co/storage/.../abc123.png">
<p>More text here...</p>
```

**The actual `abc123.png` file lives in Storage, not the database.**

This is standard practice:
- Database = text, metadata, references
- Storage = binary files (images, videos, PDFs)

---

## Cost Analysis: Current vs New Supabase

### Current Project (Free Plan)
- Database: ~0.349 GB
- Egress: 200+ GB/month (high!)
- Storage: ~300 MB of images
- Problem: Egress will exceed free tier

### New Project Strategy
1. **Option A: Free Plan + Optimization**
   - Use Cloudflare CDN in front
   - Cache images in browser
   - Should reduce egress to <50 GB/month

2. **Option B: Paid Plan ($25/month)**
   - 250 GB egress included
   - More database space
   - Better support

3. **Option C: External Image Host**
   - Move images to Cloudinary/ImageKit (free tier)
   - Keep notes in Supabase
   - Rewrite image URLs

---

## Run Backups NOW

Before doing anything else:

```powershell
# Navigate to project
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# 1. Backup database (30 seconds)
supabase db dump -f "c:\Users\lucas\Downloads\flow-db-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"

# 2. Backup images (5-15 minutes)
node backup-images.js "c:\Users\lucas\Downloads\flow-images-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

This creates:
- `flow-db-backup-20260807-153000.sql`
- `flow-images-backup-20260807-153000\` (folder with all images)

**Store these in 2 places:**
- External drive
- Cloud storage (Google Drive, Dropbox, etc.)

---

## Summary

**You asked:**
> "Have we already backed it up properly with this JSON file?"

**Answer:** No, the JSON is incomplete. It has:
- ✅ Note content (text, HTML)
- ✅ Image URLs
- ❌ NOT the actual image files

**To complete backup:**
```powershell
# Run this now:
node backup-images.js "c:\Users\lucas\Downloads\flow-images-backup"
```

**Then you'll have:**
1. ✅ Database SQL (via `supabase db dump`)
2. ✅ Images folder (via `backup-images.js`)
3. ✅ JSON safety net (already have)

**All three together = complete recoverable backup.**
