# Test Scripts

## Supabase Signup Test

### Purpose
Tests signup directly against Supabase to isolate whether the "Database error saving new user" issue is in:
- **Frontend code** (our React app)
- **Supabase configuration** (database triggers, tables, RLS)

### Setup

1. **Install dependencies:**
   ```bash
   npm install dotenv
   ```

2. **Create `.env` file** in project root (if it doesn't exist):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Run the Test

```bash
node scripts/testSignup.js
```

### Expected Output

#### ✅ If Signup Works:
```
=== Supabase Signup Test ===

Supabase URL: https://oetxqcyktahczrqrxlds.supabase.co
Has Anon Key: true

Test Credentials:
  Email: test+1701234567890@example.com
  Password: Test1234!
  Username: testuser1701234567890

Attempting signup...

✅ SIGNUP SUCCESSFUL!

User Data:
  ID: abc123-def456-...
  Email: test+1701234567890@example.com
  Confirmed: No (check email)
  Session: None (email confirmation required)

=== DIAGNOSIS ===
Signup works fine from this script!
The issue might be:
  1. Environment variables not loaded in frontend
  2. CORS issue in browser
  3. Different behavior in dev vs production
```

**Action:** Check your `.env` file is being loaded by Vite. Restart dev server.

---

#### ❌ If Signup Fails:
```
=== Supabase Signup Test ===

Supabase URL: https://oetxqcyktahczrqrxlds.supabase.co
Has Anon Key: true

Test Credentials:
  Email: test+1701234567890@example.com
  Password: Test1234!
  Username: testuser1701234567890

Attempting signup...

❌ SIGNUP FAILED

Error Details:
  Message: Database error saving new user
  Status: 500
  Name: AuthApiError
  Code: undefined

Full Error Object: {...}

=== DIAGNOSIS ===
This error is coming from Supabase, not our frontend code.

Common causes:
  1. Database trigger/function error on auth.users table
  2. Missing or misconfigured user_profiles table
  3. RLS policy blocking profile creation
  4. Constraint violation (e.g., NOT NULL column)

Next steps:
  1. Go to Supabase Dashboard → Logs → Database
  2. Look for errors around the signup timestamp
  3. Check if user_profiles table exists and has correct schema
  4. Verify RLS policies allow INSERT for authenticated users
```

**Action:** The problem is in your Supabase project. See `docs/supabase-signup-debug.md` for detailed troubleshooting steps.

---

### Troubleshooting

**Error: Cannot find module 'dotenv'**
```bash
npm install dotenv
```

**Error: Missing environment variables**
- Create `.env` file in project root
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Get values from Supabase Dashboard → Settings → API

**Error: ENOENT (file not found)**
- Make sure you're running from project root: `node scripts/testSignup.js`
- Not from inside scripts folder: `cd .. && node scripts/testSignup.js`

---

### What This Test Proves

| Test Result | Meaning | Next Action |
|------------|---------|-------------|
| ✅ Success | Supabase works, frontend has issue | Check `.env` loading, CORS, browser console |
| ❌ Fails with same error | Supabase database issue | Fix Supabase triggers/tables/RLS |
| ❌ Different error | Network/auth issue | Check Supabase status, API keys |

---

### See Also
- `docs/supabase-signup-debug.md` - Comprehensive debugging guide
- `supabase-setup.sql` - Database schema
- `src/contexts/AuthContext.tsx` - Signup implementation
