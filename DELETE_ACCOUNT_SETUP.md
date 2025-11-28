# Delete Account Feature - Setup Instructions

## 🚨 IMPORTANT: Run This SQL First!

The delete account feature will **NOT work** until you run the SQL function in Supabase.

---

## Step-by-Step Setup

### 1. Open Supabase Dashboard
- Go to your Supabase project: https://supabase.com/dashboard
- Select your Flow project

### 2. Navigate to SQL Editor
- Click **SQL Editor** in the left sidebar
- Click **New Query**

### 3. Copy and Run the SQL Script
- Open the file: `supabase-delete-user-function.sql`
- Copy ALL the contents
- Paste into the SQL Editor
- Click **Run** (or press Ctrl/Cmd + Enter)

### 4. Verify Success
You should see a success message like:
```
Success. No rows returned
```

---

## What This SQL Does

The SQL script creates a function called `delete_user_account()` that:

1. **Gets the current user's ID** from `auth.uid()`
2. **Deletes all user data:**
   - Notes
   - Folders
   - Dashboards
   - User profile
3. **Deletes the auth user** from `auth.users` table (the critical part!)

---

## Why This Is Needed

Supabase's client library doesn't allow deleting auth users directly for security reasons. You need a database function with `SECURITY DEFINER` to do this.

Without this function:
- ❌ User data gets deleted
- ❌ User profile gets deleted
- ❌ **But the user can still log in!** (auth user still exists)

With this function:
- ✅ User data gets deleted
- ✅ User profile gets deleted
- ✅ **User is completely removed** (cannot log in again)

---

## Testing the Delete Account Feature

After running the SQL:

1. **Sign up** for a test account
2. **Verify email** and log in
3. Go to **Settings** → scroll to **Danger Zone**
4. Click **Delete Account**
5. Type `DELETE` in the confirmation modal
6. Click **Delete Account** button
7. You should be:
   - Signed out
   - Redirected to landing page
8. **Try to log in again** with the same credentials
   - ❌ Should fail with "Invalid login credentials"
   - ✅ This confirms the account was truly deleted!

---

## Troubleshooting

### Error: "function delete_user_account() does not exist"
- You haven't run the SQL script yet
- Run the script in Supabase SQL Editor

### Error: "permission denied for table auth.users"
- The function needs `SECURITY DEFINER` (already included in the script)
- Make sure you ran the entire script, not just part of it

### Error: "Not authenticated"
- User is not logged in
- This is expected - the function requires authentication

---

## Security Notes

- ✅ **Secure:** Only the authenticated user can delete their own account
- ✅ **No admin access needed:** Users can self-delete
- ✅ **Cascade delete:** All related data is removed
- ✅ **Irreversible:** Once deleted, the account cannot be recovered

---

## Summary

1. Run `supabase-delete-user-function.sql` in Supabase SQL Editor
2. Test by creating and deleting a test account
3. Verify the user cannot log in again
4. ✅ Delete account feature is now fully functional!
