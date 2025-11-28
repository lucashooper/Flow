# Supabase Signup Debugging Guide

## Problem
Signup fails with error: **"Database error saving new user"** (HTTP 500)

This error comes from Supabase's auth system, indicating a server-side database issue.

---

## Quick Diagnosis

### Run the Test Script
```bash
# Install dependencies if needed
npm install dotenv

# Run the isolated test
node scripts/testSignup.js
```

**If the test script ALSO fails with the same error:**
→ The problem is in your Supabase project configuration, not the frontend code.

**If the test script succeeds:**
→ The problem might be environment variables or browser-specific issues.

---

## Common Causes & Fixes

### 1. **Database Trigger Error**
**Symptom:** Signup fails immediately with 500 error

**Cause:** A database trigger or function on `auth.users` is failing

**How to check:**
1. Go to **Supabase Dashboard** → **Database** → **Functions**
2. Look for functions that run on `auth.users` INSERT
3. Common culprits:
   - `handle_new_user()` function
   - Triggers that create profile records
   - Functions with syntax errors or missing tables

**Fix:**
```sql
-- Check if there's a trigger on auth.users
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND trigger_schema = 'auth';

-- Disable problematic trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

---

### 2. **Missing user_profiles Table**
**Symptom:** Error mentions "relation does not exist" in Supabase logs

**Cause:** The `user_profiles` table doesn't exist

**How to check:**
1. Go to **Supabase Dashboard** → **Table Editor**
2. Look for `user_profiles` table

**Fix:**
Run the schema from `supabase-setup.sql`:
```sql
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

---

### 3. **Row Level Security (RLS) Blocking**
**Symptom:** User is created but profile insertion fails

**Cause:** RLS policies prevent the trigger/function from inserting into `user_profiles`

**How to check:**
1. Go to **Supabase Dashboard** → **Authentication** → **Policies**
2. Check `user_profiles` table policies

**Fix:**
Ensure the INSERT policy allows new users to create their profile:
```sql
CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

Or temporarily disable RLS for testing:
```sql
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- Try signup again
-- Re-enable after testing:
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

---

### 4. **Constraint Violation**
**Symptom:** Error mentions "violates not-null constraint" or "unique constraint"

**Cause:** 
- Missing required fields
- Duplicate username/email
- Invalid default values

**How to check:**
Go to **Supabase Dashboard** → **Logs** → **Database** and look for:
```
ERROR: null value in column "..." violates not-null constraint
ERROR: duplicate key value violates unique constraint "..."
```

**Fix:**
```sql
-- Check table constraints
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass;

-- Make columns nullable if needed
ALTER TABLE user_profiles ALTER COLUMN email DROP NOT NULL;
```

---

### 5. **Email Confirmation Required**
**Symptom:** Signup "succeeds" but no user appears in dashboard

**Cause:** Email confirmation is enabled but emails aren't being sent

**How to check:**
1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Check "Enable email confirmations"

**Fix:**
- **For development:** Disable email confirmations
- **For production:** Configure email templates and SMTP

---

## Debugging Steps

### Step 1: Check Supabase Logs
1. Go to **Supabase Dashboard** → **Logs** → **Database**
2. Filter by time of signup attempt
3. Look for ERROR messages

### Step 2: Check Auth Users Table
```sql
-- See if user was created despite error
SELECT id, email, created_at, confirmed_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

### Step 3: Check user_profiles Table
```sql
-- See if profile was created
SELECT * FROM user_profiles 
ORDER BY created_at DESC 
LIMIT 5;
```

### Step 4: Test Trigger Manually
```sql
-- Manually insert a test profile
INSERT INTO user_profiles (id, username, email)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'testuser', 
  'test@example.com'
);
-- If this fails, you'll see the exact error
```

---

## Frontend Code Checklist

✅ **Environment Variables**
```bash
# Check .env file exists with:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

✅ **Supabase Client**
```ts
// src/lib/supabase.ts should have:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}
```

✅ **Signup Call**
```ts
// Should NOT pass invalid metadata
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      username: username  // ✅ Simple string
      // ❌ Don't pass: objects, arrays, functions, undefined
    }
  }
});
```

---

## Still Stuck?

1. **Export Supabase logs:**
   - Dashboard → Logs → Database → Export as JSON
   
2. **Check Supabase status:**
   - https://status.supabase.com

3. **Ask in Supabase Discord:**
   - Share the error from logs
   - Mention you're getting 500 on auth.signUp
   - Include relevant SQL schema

---

## Summary

**If `scripts/testSignup.js` fails:**
→ Fix your Supabase database configuration (triggers, tables, RLS)

**If `scripts/testSignup.js` succeeds:**
→ Check frontend environment variables and CORS settings

**Most likely cause:**
→ Database trigger on `auth.users` is trying to insert into `user_profiles` but failing due to RLS or missing table
