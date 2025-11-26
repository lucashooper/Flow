# Troubleshooting Guide

## Issue 1: SQL Policy Error ✅ FIXED

**Error:**
```
ERROR: 42710: policy "Users can upload their own profile picture" for table "objects" already exists
```

**Solution:**
Use the new `supabase-updates-fixed.sql` file instead. It includes `DROP POLICY IF EXISTS` statements to handle existing policies.

---

## Issue 2: Star Function 400 Error ✅ FIXED

**Error:**
```
Failed to load resource: the server responded with a status of 400
❌ Database error: Object
❌ Error updating note: Object
```

**Root Cause:**
The `is_starred` column doesn't exist in your `notes` table yet.

**Solution:**
1. Run the `supabase-updates-fixed.sql` file in Supabase SQL Editor
2. This will:
   - Add the `is_starred` column
   - Set default value to `false` for all existing notes
   - Create the necessary index
   - Set up storage bucket and policies

---

## Steps to Fix Everything

### 1. Run the Fixed SQL Script

**In Supabase Dashboard:**
1. Go to SQL Editor
2. Copy the entire contents of `supabase-updates-fixed.sql`
3. Paste and click "Run"
4. You should see: "Success. No rows returned"

### 2. Verify the Changes

**Check if columns exist:**
```sql
-- Check notes table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'notes' AND column_name = 'is_starred';

-- Check profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'profile_picture_url';
```

**Expected results:**
- `is_starred` should be `boolean`, nullable: NO, default: false
- `profile_picture_url` should be `text`, nullable: YES

### 3. Test the Star Function

1. Refresh your app (Ctrl+Shift+R / Cmd+Shift+R)
2. Right-click any note
3. Click "Star"
4. The note should:
   - Show a yellow star icon next to its title
   - Move to the top of the notes list
   - The context menu should now show "Unstar"

### 4. Test Profile Pictures

1. Go to Settings → My Profile
2. Click "Upload Picture"
3. Select an image (max 5MB)
4. Click "Save"
5. Refresh the page
6. Your profile picture should still be there

---

## Code Changes Made

### Defensive Programming
All code now handles `undefined` values for `is_starred`:

**Before:**
```typescript
if (note.is_starred) // Could fail if undefined
```

**After:**
```typescript
if (note.is_starred ?? false) // Treats undefined as false
```

### Files Updated:
1. ✅ `Sidebar.tsx` - Defensive sorting
2. ✅ `NoteItem.tsx` - Defensive star toggle and display
3. ✅ `supabase-updates-fixed.sql` - Handles existing policies

---

## If Star Function Still Doesn't Work

### Check Browser Console
Look for specific error messages:

**If you see:**
```
column "is_starred" does not exist
```
→ The SQL script didn't run successfully. Try running it again.

**If you see:**
```
null value in column "is_starred" violates not-null constraint
```
→ Run this SQL:
```sql
UPDATE notes SET is_starred = false WHERE is_starred IS NULL;
```

### Check Network Tab
1. Open DevTools → Network tab
2. Right-click a note to star it
3. Look for the failed request to `/rest/v1/notes`
4. Click on it and check the "Response" tab for the exact error

---

## Quick Test SQL

Run this to manually test the column:
```sql
-- Try updating a note's star status
UPDATE notes 
SET is_starred = true 
WHERE id = (SELECT id FROM notes LIMIT 1);

-- Check if it worked
SELECT id, title, is_starred FROM notes LIMIT 5;
```

If this works in SQL but not in the app, the issue is with the frontend code. If it fails in SQL, the column doesn't exist yet.

---

## Success Checklist

- [ ] SQL script runs without errors
- [ ] `is_starred` column exists in `notes` table
- [ ] `profile_picture_url` column exists in `profiles` table
- [ ] Right-click menu shows "Star" option
- [ ] Clicking "Star" doesn't show 400 error
- [ ] Starred notes show yellow star icon
- [ ] Starred notes appear at top of list
- [ ] Profile picture uploads work
- [ ] Profile picture persists after refresh
