# Safe Migration to New Supabase - Complete Guide

## Important Discovery: No Images in Current Supabase! 📸

**Finding:** Your current Supabase project has NO storage buckets.

This means:
- ✅ **Good news:** No images to backup/migrate from Supabase
- ⚠️ **Question:** Where are your images actually stored?
  - In IndexedDB locally?
  - Base64 encoded in note content?
  - External service (Imgur, Cloudinary)?
  - Never uploaded?

**Check where images are:**
1. Open a note with images in Flow
2. Right-click an image → Inspect
3. Look at the `src` attribute
4. Does it start with:
   - `data:image` = Base64 embedded (stored in note content)
   - `blob:` = Local IndexedDB
   - `https://` = External URL

**Result:** Since Supabase Storage is empty, migration is SIMPLER! Just migrate database.

---

## Your New Supabase Project

```
Project ID: hqyctrdkyeumfbsdcqhy
URL: https://hqyctrdkyeumfbsdcqhy.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

✅ **SAFE to test locally - won't affect production**

---

## Step-by-Step Safe Testing

### Phase 1: Test Locally (100% Safe)

**Step 1: Create test environment file**

```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Create .env.test (NOT .env - don't touch production!)
@"
VITE_SUPABASE_URL=https://hqyctrdkyeumfbsdcqhy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeWN0cmRreWV1bWZic2RjcWh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDgwMTIsImV4cCI6MjEwMTY4NDAxMn0.nMia1OECFkv6cm2rvWjGgasinW4A91P1b2d0ZwaPCPw
"@ | Out-File -FilePath ".env.test" -Encoding UTF8
```

**Step 2: Set up new Supabase project schema**

1. Go to https://app.supabase.com
2. Select project: `hqyctrdkyeumfbsdcqhy`
3. Click **SQL Editor**
4. Copy and paste this SQL to create tables:

```sql
-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  icon_url TEXT,
  is_starred BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  dashboard_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emoji TEXT,
  drawing_data JSONB,
  is_starred BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0
);

-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pin_hash TEXT
);

-- Enable Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Users can view own folders" ON folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own folders" ON folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON folders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notes
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dashboards
CREATE POLICY "Users can view own dashboards" ON dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboards" ON dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards" ON dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards" ON dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

5. Click **Run** (F5)
6. Should see: "Success. No rows returned"

**Step 3: Test with new project locally**

```powershell
# Copy production .env to backup
Copy-Item .env .env.backup

# Use test environment
Copy-Item .env.test .env

# Start dev server
npm run dev
```

**Step 4: Open http://localhost:5174**

1. **Sign up** with a NEW test account (don't use your production email yet)
   - Email: `test@example.com` or similar
   - Password: anything

2. **Create test data:**
   - Create a folder
   - Create a note
   - Add some content
   - Check sync works

3. **Verify everything works:**
   - [ ] Can create notes
   - [ ] Can create folders
   - [ ] Notes save to IndexedDB
   - [ ] Notes sync to Supabase
   - [ ] No console errors
   - [ ] Admin Dashboard appears (if logged in as `edwardsjonny547@gmail.com`)

**Step 5: Check Supabase dashboard**

1. Go to https://app.supabase.com
2. Select new project: `hqyctrdkyeumfbsdcqhy`
3. Click **Table Editor**
4. Check `notes` table has your test note
5. Check `folders` table has your test folder

**Step 6: Restore production .env**

```powershell
# Stop dev server (Ctrl+C)

# Restore production environment
Copy-Item .env.backup .env

# Delete test file
Remove-Item .env.test
Remove-Item .env.backup
```

✅ **Result:** You've tested the new Supabase safely without touching production!

---

### Phase 2: Migrate Your Real Data (After Testing)

**Option A: Sign up with your admin email**

If test worked, you can sign up with your real email on the new project:

1. Use `.env.test` again
2. `npm run dev`
3. Sign up with `edwardsjonny547@gmail.com`
4. Your IndexedDB data will sync automatically!

**Why this works:**
- Your notes are primarily in IndexedDB (local browser storage)
- When you log in with new Supabase, they'll sync from IndexedDB → new project
- No manual data migration needed!

**Option B: Import JSON backup**

If you want to preserve server-side data:

1. In new project SQL Editor:
2. Convert JSON to SQL INSERT statements
3. Or use the admin dashboard (once we fix it) to import

**Option C: Keep both projects**

- Old project: `oetxqcyktahczrqrxlds` (keep as backup)
- New project: `hqyctrdkyeumfbsdcqhy` (active use)
- Switch between them by changing .env
- Keep old project for 30 days before deleting

---

## Admin Dashboard Fix

Your console debug showed:
```
✅ Logged in as: edwardsjonny547@gmail.com
✅ Code deployed correctly
❌ But not rendering
```

**Root cause:** React state issue. The `user` object might not have `email` populated when component renders.

**I've added debug logging.** After next deploy, you'll see in console:
```
[Settings] User changed: edwardsjonny547@gmail.com
[Settings] isAdmin: true
```

**To deploy the fix:**

```powershell
cd "c:\Users\lucas\OneDrive\Desktop\Flow\Flow"

# Commit the admin debug fix
git add src/pages/Settings.tsx
git commit -m "Add admin dashboard debug logging"
git push

# Or manually deploy on Netlify dashboard
# Deploys → Trigger deploy → Deploy site
```

**If still doesn't show after deploy:**

The issue might be that `user` from `useAuth()` is `null` initially, then populates later, but the component doesn't re-render.

**Nuclear option - Force check on every render:**
In Settings.tsx, change line 224 from:
```typescript
const isAdmin = user?.email === 'edwardsjonny547@gmail.com';
```
To:
```typescript
const [isAdmin, setIsAdmin] = useState(false);

useEffect(() => {
  setIsAdmin(user?.email === 'edwardsjonny547@gmail.com');
}, [user?.email]);
```

This forces a re-render when `user` changes.

---

## Security Notes

✅ **Safe to share publicly:**
- Anon key (anon role only, RLS protected)
- Public key
- Project URL

❌ **NEVER share:**
- Service role key (you shared it - regenerate it now!)
- Database password
- JWT secret

**Regenerate service role key:**
1. Go to project settings
2. API section
3. Click regenerate next to service role key
4. Use the NEW key

---

## Summary

**Current situation:**
- ❌ No images in Supabase Storage (they're local or embedded)
- ✅ JSON backup has all your notes
- ✅ New Supabase project created
- ⚠️ Admin dashboard has React state issue

**Safe next steps:**
1. Test new Supabase locally (Phase 1 above)
2. Fix admin dashboard with useEffect state
3. If test succeeds, use new project
4. Keep old project as backup for 30 days

**No risk to production** because:
- Testing uses `.env.test` (different file)
- Production `.env` stays unchanged
- Local dev server ≠ production deployment
- Can switch back anytime

Ready to test? Start with Phase 1 Step 1!
