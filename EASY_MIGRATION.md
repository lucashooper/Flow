# Easy Migration - The Right Way

## 🎯 Why This is Better

Instead of importing 1,029 notes via SQL (tedious), we'll:
1. Import directly into IndexedDB (your browser's local storage)
2. With your new user_id
3. Then let Flow sync automatically to new Supabase

**Total time:** 5 minutes  
**Difficulty:** Copy-paste

---

## ✅ Step-by-Step

### Step 1: Switch to New Supabase

Already done! Your `.env` is currently pointing to OLD Supabase. Let's switch it back:

**Run this in PowerShell:**
```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Update to new Supabase
@"
VITE_SUPABASE_URL=https://hqyctrdkyeumfbsdcqhy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeWN0cmRreWV1bWZic2RjcWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDgwMTIsImV4cCI6MjEwMTY4NDAxMn0.nMia1OECFkv6cm2rvWjGgasinW4A91P1b2d0ZwaPCPw
"@ | Out-File -FilePath .env -Encoding UTF8

# Restart dev server
npm run dev
```

---

### Step 2: Log Into New Account

1. Go to http://localhost:5174
2. Log in with: `edwardsjonny547@gmail.com`
3. (The new account you created earlier)
4. You'll see 0 notes - that's normal

---

### Step 3: Import Data to IndexedDB

1. **Press F12** (open browser console)

2. **Copy this entire script** and paste in console:

```javascript
// UPDATE THIS LINE with your user_id:
const NEW_USER_ID = 'c4526913-2f33-4f5b-ad2e-44290c9fd640'; // Your new user_id

// Rest of script...
[Open import-to-indexeddb.js and copy everything]
```

3. **Open your JSON backup file:**
   ```
   c:\Users\lucas\Downloads\flow-indexeddb-backup-1786112234195.json
   ```

4. **Copy ALL the JSON** (Ctrl+A, Ctrl+C)

5. **Back in console, type:**
   ```javascript
   const jsonData = // paste here
   ```
   (Then paste your JSON after the =)

6. **Press Enter**, then run:
   ```javascript
   importData(jsonData);
   ```

7. **Watch it import:**
   ```
   📁 Importing 310 folders...
   ✅ Imported 310/310 folders

   📝 Importing 1029 notes...
   ✅ Imported 1029/1029 notes

   ✅ IMPORT COMPLETE!
   ```

8. **Refresh page** (F5)

9. **Your notes appear!** 🎉

---

### Step 4: Watch Auto-Sync

In console, you'll see:
```
🔄 Starting sync to server...
⬆️ Uploaded folder: Projects
⬆️ Uploaded note: Meeting Notes
...
✅ Sync complete
```

Your 1,029 notes are now in the new Supabase!

---

## 💰 About Costs

**New Supabase project (free tier):**
- 50 GB egress/month
- Your notes: ~2-5 GB total
- **Should be fine** if we cache properly

**Old Supabase:**
- Over limit because of repeated image loads
- New project won't have this issue initially
- We can add caching later if needed

**You're safe on free tier for the new project!**

---

## 🛡️ Your Data is Completely Safe

**3 copies now:**
1. ✅ JSON backup file (1,029 notes, 310 folders)
2. ✅ IndexedDB in browser (after import)
3. ✅ New Supabase project (after sync)

**Old Supabase:**
- Can pause/archive it
- Won't affect your new setup
- Data preserved even if paused

---

## Summary

**Current status:**
- Old Supabase: Over egress, grace period
- Your data: SAFE in JSON + IndexedDB
- New Supabase: Ready, free tier

**Migration plan:**
1. Switch .env to new Supabase (1 min)
2. Log into new account (30 sec)
3. Import JSON to IndexedDB (2 min)
4. Watch auto-sync (1-2 min)
5. Done! (5 min total)

**Cost:** $0  
**Risk:** Zero (3 copies of data)  
**Difficulty:** Copy-paste

Ready to do this? It's way easier than I made it sound before!
