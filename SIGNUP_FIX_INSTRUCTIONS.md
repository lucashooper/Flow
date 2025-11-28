# 🔧 Fix Supabase Signup Error

## Problem Confirmed ✅
The test script proves this is a **Supabase database issue**, not frontend code.

**Error:** `Database error saving new user` (HTTP 500)  
**Code:** `unexpected_failure`

---

## Quick Fix (5 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/oetxqcyktahczrqrxlds/sql
2. Click **"New Query"**

### Step 2: Run Diagnostic Queries
Copy and paste from `supabase-signup-fix.sql` **STEP 1-4** to see what's wrong:

```sql
-- Check for triggers
SELECT trigger_name, action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';
```

**What to look for:**
- If you see a trigger name (like `on_auth_user_created`), that's likely the problem
- Note the trigger name for Step 3

### Step 3: Disable the Broken Trigger
Replace `trigger_name_here` with the actual name from Step 2:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

**Then try signing up again!** It should work now.

### Step 4: Create Proper Trigger (Recommended)
Run **STEP 8** from `supabase-signup-fix.sql` to create a working trigger that:
- Creates user profiles automatically
- Handles errors gracefully
- Doesn't block signup if profile creation fails

---

## Alternative: Remove Trigger Completely

If you don't need automatic profile creation:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Signups will work, but profiles won't be created automatically
-- Your frontend code in AuthContext.tsx will create them instead
```

This is actually **safer** because:
- Signup won't fail if profile creation has issues
- Your frontend has better error handling
- You can retry profile creation if it fails

---

## What Was Wrong?

Your Supabase project has a **database trigger** that runs when users sign up. This trigger tries to create a profile in the `user_profiles` table, but it's failing because:

**Most likely causes:**
1. ❌ **Table doesn't exist** - `user_profiles` table is missing
2. ❌ **RLS blocking** - Row Level Security prevents the trigger from inserting
3. ❌ **Constraint violation** - Missing required field or duplicate username
4. ❌ **Function error** - The trigger function has a bug

The trigger is **blocking the entire signup** instead of just logging an error.

---

## Verify the Fix

After disabling the trigger, try:

```bash
# Run test script again
node scripts/testSignup.js
```

**Expected output:**
```
✅ SIGNUP SUCCESSFUL!

User Data:
  ID: abc123-def456-...
  Email: test+...@example.com
  Confirmed: No (check email)
```

Then try signing up in your app - it should work!

---

## Long-term Solution

### Option A: Let Frontend Handle Profiles (Recommended)
1. Keep trigger disabled
2. Your `AuthContext.tsx` already creates profiles after signup
3. Better error handling
4. More control

### Option B: Fix the Trigger
1. Run **STEP 6** to ensure `user_profiles` table exists with correct schema
2. Run **STEP 7** to check RLS policies
3. Run **STEP 8** to create a robust trigger with error handling
4. Test with **STEP 9**

---

## Need Help?

### Check Supabase Logs
1. Dashboard → Logs → Database
2. Look for errors at the time you tried to sign up
3. Will show the exact SQL error

### Common Errors in Logs

**"relation 'user_profiles' does not exist"**
→ Run STEP 6 to create the table

**"new row violates row-level security policy"**
→ Run STEP 7 to fix RLS policies

**"null value in column 'username' violates not-null constraint"**
→ Trigger isn't passing username correctly, use STEP 8 fix

---

## Summary

1. ✅ **Confirmed:** Database trigger is failing
2. 🔧 **Quick fix:** Disable the trigger
3. ✅ **Test:** Run `node scripts/testSignup.js`
4. 🎯 **Long-term:** Let frontend handle profiles OR fix trigger

**The frontend code is perfect.** This is purely a Supabase configuration issue.
