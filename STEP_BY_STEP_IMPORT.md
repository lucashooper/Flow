# Step-by-Step Import (5 Minutes)

## ✅ Prerequisites

- [x] Dev server running (`npm run dev`)
- [x] Logged into NEW account: `edwardsjonny547@gmail.com`
- [x] On: http://localhost:5174
- [x] Currently see 0 notes (that's expected)

---

## 📝 Step 1: Open Browser Console

1. Press `F12` (or right-click → Inspect)
2. Click **Console** tab
3. Clear it if needed (click trash icon or Ctrl+L)

---

## 📋 Step 2: Load Import Script

1. **Open this file in Notepad:**
   ```
   c:\Users\lucas\OneDrive\Desktop\Flow\Flow\IMPORT_SCRIPT.js
   ```

2. **Select ALL** (Ctrl+A)

3. **Copy** (Ctrl+C)

4. **Go back to browser console**

5. **Paste** (Ctrl+V) and press **Enter**

You should see:
```
╔════════════════════════════════════════╗
║   Flow Notes JSON Import               ║
╚════════════════════════════════════════╝

✅ Script loaded!

▶️  Run this command to start:
   importFromJSON()
```

---

## ⚙️ Step 3: Start Import

In the console, type:
```javascript
importFromJSON()
```

Press **Enter**.

You'll see instructions. Now we need your JSON data.

---

## 📁 Step 4: Load Your JSON Backup

1. **Open in Notepad:**
   ```
   c:\Users\lucas\Downloads\flow-indexeddb-backup-1786112234195.json
   ```

2. **Select ALL** (Ctrl+A)

3. **Copy** (Ctrl+C)

4. **Go back to browser console**

5. **Type this** (don't press Enter yet):
   ```javascript
   window.jsonData = 
   ```

6. **After the `=`, paste your JSON** (Ctrl+V)

7. **Now press Enter**

Your console should show the JSON object.

---

## 🚀 Step 5: Run the Import

In console, type:
```javascript
window.runImport()
```

Press **Enter**.

You'll see:
```
📊 Analyzing backup data...
   Notes: 1029
   Folders: 310

🔓 Opening IndexedDB...
✅ IndexedDB opened

📁 Importing 310 folders...
   Progress: 50/310...
   Progress: 100/310...
   ...
✅ Folders: 310/310 imported

📝 Importing 1029 notes...
   Progress: 100/1029...
   Progress: 200/1029...
   ...
✅ Notes: 1029/1029 imported

╔════════════════════════════════════════╗
║   ✅ IMPORT COMPLETE!                  ║
╚════════════════════════════════════════╝

📁 Imported: 310 folders
📝 Imported: 1029 notes

🔄 Next steps:
   1. Refresh this page (F5 or Ctrl+R)
```

---

## 🎉 Step 6: See Your Notes!

1. **Refresh the page** (F5 or Ctrl+R)

2. **Your notes appear in the sidebar!**

3. **Watch the console** - you'll see:
   ```
   🔄 Starting sync to server...
   📦 Loaded from IndexedDB: 1029 notes, 310 folders
   ⬆️ Uploaded folder: Projects
   ⬆️ Uploaded note: Meeting Notes
   ...
   ✅ Sync complete
   ```

4. **Your notes are now in NEW Supabase!**

---

## ✅ Verify It Worked

**In Flow:**
- Left sidebar shows all your folders
- Notes appear when you click them
- No errors in console

**In Supabase:**
1. Go to https://app.supabase.com
2. Select project: `hqyctrdkyeumfbsdcqhy`
3. Click **Table Editor**
4. Click **notes** table
5. You should see 1,029 rows!
6. Click **folders** table
7. You should see 310 rows!

---

## 🎯 What Just Happened

1. ✅ Loaded your JSON backup
2. ✅ Imported to IndexedDB with NEW user_id
3. ✅ Flow auto-synced to NEW Supabase
4. ✅ All 1,029 notes migrated
5. ✅ Still on free tier ($0)

---

## ⚠️ Troubleshooting

### "window.jsonData is undefined"

**Fix:** You need to set the JSON first:
```javascript
window.jsonData = {
  // paste your JSON here
}
```

### "Transaction error"

**Fix:** Make sure you're logged in as `edwardsjonny547@gmail.com` first.

### "No notes appear after refresh"

**Fix:** 
1. Check console for errors
2. Verify you're on the new Supabase (check URL in console)
3. Try logging out and back in

### Import seems stuck

**Fix:** It's processing 1,029 notes - give it 2-3 minutes. Watch the progress counter.

---

## 📊 Timeline

- **Step 1-2:** Load script (30 seconds)
- **Step 3-4:** Load JSON (1 minute)
- **Step 5:** Import runs (2-3 minutes)
- **Step 6:** Refresh and sync (1 minute)

**Total:** ~5 minutes

---

## 🎉 Success!

Once you see your notes:
- ✅ Migration complete
- ✅ Data safe in new Supabase
- ✅ Free tier (no $20 needed)
- ✅ Old Supabase can be paused/deleted
- ✅ Admin dashboard will work (after deploy)

You did it! 🚀
