# Complete Migration to New Supabase - Final Steps

## ✅ Why Migrate to New Supabase

You're right! Here's why you SHOULD migrate:

- ✅ **Avoid egress charges** - Fresh start on new project
- ✅ **Your data is safe** - 1,029 notes backed up in JSON
- ✅ **Start fresh** - No legacy issues
- ✅ **Free tier** - Won't hit limits immediately
- ✅ **New notes go to new project** - Clean separation

---

## 🚀 Complete the Migration (5 Minutes)

### Step 1: Restart on New Supabase

```powershell
# Stop dev server (Ctrl+C)
npm run dev
```

You're now pointed to NEW Supabase: `hqyctrdkyeumfbsdcqhy`

### Step 2: Initialize IndexedDB

1. Go to http://localhost:5174
2. Log in as `edwardsjonny547@gmail.com` (new account)
3. Click **"+" button** to create a note
4. Type "test" and press Enter
5. **This initializes IndexedDB**

### Step 3: Import Your Data

1. **Press F12** (console)
2. **Open:** `READY_TO_PASTE.js`
3. **Copy ALL** (Ctrl+A, Ctrl+C)
4. **Paste in console** (Ctrl+V)
5. **Press Enter**
6. **Wait for:** "✅ IMPORT COMPLETE!"
7. **Refresh:** F5

### Step 4: Verify

You should see all 1,029 notes in the sidebar! They'll auto-sync to NEW Supabase.

---

## 🚀 Update Production to New Supabase

Once local works, update Netlify:

1. Go to https://app.netlify.com
2. Select your Flow site
3. Click **Site configuration** → **Environment variables**
4. Update:
   ```
   VITE_SUPABASE_URL=https://hqyctrdkyeumfbsdcqhy.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeWN0cmRreWV1bWZic2RjcWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDgwMTIsImV4cCI6MjEwMTY4NDAxMn0.nMia1OECFkv6cm2rvWjGgasinW4A91P1b2d0ZwaPCPw
   ```
5. Click **Save**
6. Click **Trigger deploy**
7. Wait for deploy to finish

---

## ✅ After Migration

**New notes:** Will save to NEW Supabase (fresh, no egress issues)  
**Old notes:** Can delete old Supabase project after 1 week  
**Free tier:** Safe for months with proper caching  
**Admin dashboard:** Will work after deploy completes  

---

## 🎯 Summary

1. ✅ Switched .env to NEW Supabase
2. ⏳ Restart dev server
3. ⏳ Create test note (initializes IndexedDB)
4. ⏳ Import 1,029 notes via console script
5. ⏳ Update Netlify env vars
6. ⏳ Deploy

**You're right to migrate!** This solves the egress issue and gives you a fresh start.
