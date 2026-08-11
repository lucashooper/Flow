# Migration Steps - Follow This Exactly

## What's Happening Right Now

**If you're seeing notes locally:** You're seeing data from **IndexedDB** (local browser storage), NOT Supabase yet.

**Why:** Flow is "offline-first" - it stores everything locally and syncs to Supabase in the background.

---

## Step-by-Step Migration

### Step 1: Set Up New Database Schema ✅ (Do This First)

1. **Go to your NEW Supabase project:**
   - https://app.supabase.com
   - Select project: `hqyctrdkyeumfbsdcqhy`

2. **Open SQL Editor:**
   - Click **SQL Editor** in left sidebar
   - Click **New query**

3. **Copy ALL the SQL from this file:**
   - Open: `c:\Users\lucas\OneDrive\Desktop\Flow\Flow\setup-new-database.sql`
   - Select all (Ctrl+A)
   - Copy (Ctrl+C)

4. **Paste into SQL Editor and run:**
   - Paste (Ctrl+V)
   - Click **Run** (or press F5)
   - Wait for "Success. No rows returned"

5. **Verify tables were created:**
   - Click **Table Editor** in left sidebar
   - You should see:
     - ✅ folders
     - ✅ notes
     - ✅ dashboards
     - ✅ user_profiles

**✅ When you see these tables, database is ready!**

---

### Step 2: Update Local App to Use New Database ✅ (Already Done)

I've updated your `.env` file to point to the new Supabase project.

**To apply changes:**

```powershell
# If dev server is running, restart it:
# Press Ctrl+C in terminal to stop
# Then run:
npm run dev
```

**Or if not running:**
```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"
npm run dev
```

Open http://localhost:5174

---

### Step 3: Sign Up with Your Admin Email

**Important:** You need to create a NEW account on the new Supabase project.

1. **Go to:** http://localhost:5174
2. **Click Sign Up** (not Sign In!)
3. **Use your admin email:**
   - Email: `edwardsjonny547@gmail.com`
   - Password: (choose any password, can be same as before)
4. **Check your email** for confirmation link
5. **Click confirmation link**
6. **Return to Flow and log in**

---

### Step 4: Your Data Will Sync Automatically! 🎉

**What happens after you log in:**

1. Flow loads notes from **local IndexedDB** (your existing data)
2. Flow sees you're logged into **new Supabase**
3. Flow automatically syncs all local notes → new Supabase
4. Watch the console - you'll see:
   ```
   🔄 Starting sync to server...
   ⬆️ Uploaded folder: [folder-name]
   ⬆️ Uploaded note: [note-title]
   ✅ Sync complete
   ```

**Result:** All your notes are now in the new Supabase project!

---

### Step 5: Verify Migration Worked

1. **In your Flow app (localhost:5174):**
   - Check all folders appear
   - Check all notes appear
   - Open a few notes - content should be there
   - Check console for any errors

2. **In Supabase dashboard:**
   - Go to **Table Editor**
   - Click **notes** table
   - You should see all your notes!
   - Click **folders** table
   - You should see all your folders!

3. **Test creating new content:**
   - Create a new note
   - Refresh Supabase table editor
   - New note should appear in database

**✅ If you see your notes in Supabase, migration succeeded!**

---

## FAQ

### Q: I'm seeing notes now - are they in the new database?

**A:** Probably not yet. You're seeing data from **IndexedDB** (local browser storage).

To sync to new database:
1. Make sure you ran the SQL (Step 1)
2. Make sure .env is updated (Step 2 - done automatically)
3. Restart dev server
4. Sign up with your admin email (Step 3)
5. Wait for auto-sync (Step 4)

### Q: Do I need to "COPY SQL" from old project?

**A:** NO! Here's why:

**Option 1 (Easier - What we're doing):**
- Your data is in IndexedDB (local)
- Sign up with same email on new project
- Flow auto-syncs from IndexedDB → new Supabase
- No manual SQL copying needed

**Option 2 (Harder - Only if Option 1 fails):**
- Manually copy SQL from old project
- Insert into new project
- More complex, not needed

**We're using Option 1 - much easier!**

### Q: Will this delete my old data?

**A:** NO! Old Supabase project stays unchanged.

- Old project: `oetxqcyktahczrqrxlds` (untouched)
- Local IndexedDB: Still has all your data
- New project: Will receive copy of data via sync

**Nothing is deleted. Ever.**

### Q: What if something goes wrong?

**Easy to revert:**

```powershell
# Stop dev server (Ctrl+C)

# Restore old Supabase in .env
$oldEnv = @"
VITE_SUPABASE_URL=https://oetxqcyktahczrqrxlds.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E
"@
$oldEnv | Out-File -FilePath .env -Encoding UTF8

# Restart dev server
npm run dev
```

**Back to normal in 30 seconds.**

### Q: Should I delete the old Supabase project?

**A:** NOT YET!

**Timeline:**
- Today: Test new project
- Week 1: Use both (keep old as backup)
- Week 2: Verify everything works on new project
- Week 3: Can delete old project if confident

**Keep old project for at least 2 weeks as safety net.**

---

## Current Status

✅ `.env` updated to new project  
✅ SQL schema file created  
⏳ **Next:** Run SQL in Supabase (Step 1)  
⏳ **Then:** Restart dev server (Step 2)  
⏳ **Then:** Sign up with admin email (Step 3)  
⏳ **Then:** Watch auto-sync happen (Step 4)  

---

## Console Output You'll See

**After signing up and logging in:**

```
✅ Supabase client initialized
   URL: https://hqyctrdkyeumfbsdcqhy.supabase.co

🔄 Starting sync to server...
📦 Loaded from IndexedDB: 88 notes, 34 folders

⬆️ Uploading folder: Projects
⬆️ Uploading folder: Work
⬆️ Uploading folder: Personal
...

⬆️ Uploading note: Meeting Notes
⬆️ Uploading note: Project Ideas  
⬆️ Uploading note: Todo List
...

✅ Sync complete
```

**If you see this, migration succeeded!**

---

## Summary

**You're currently seeing:** Local IndexedDB data  
**You need to do:**
1. Run SQL in new Supabase (creates tables)
2. Restart dev server (picks up new .env)
3. Sign up with admin email (creates user)
4. Watch auto-sync (copies data to new Supabase)

**Time:** 5-10 minutes total

**Risk:** Zero (old data untouched, can revert instantly)

Let's do Step 1 now - go run that SQL! 🚀
