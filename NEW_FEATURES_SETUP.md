# New Features Setup Guide 🎉

## Overview of New Features

Your Quill Notes app now includes:

1. ✅ **Password Visibility Toggle** - Eye icon to show/hide passwords
2. ✅ **Username System** - Create and change usernames
3. ✅ **Settings Page** - Change your username
4. ✅ **Custom App Icon** - Beautiful Flow quill icon
5. ✅ **Premium Email Templates** - Professional signup & password reset emails
6. ✅ **Enhanced Error Handling** - Better feedback for note creation

---

## 🔧 Required Setup Steps

### Step 1: Update Database Schema

The database schema has been updated to include username support. You **MUST** run the updated SQL script:

1. Go to your Supabase SQL Editor: https://supabase.com/dashboard/project/oetxqcyktahczrqrxlds/sql
2. Click **New Query**
3. Copy the **ENTIRE** contents of `supabase-setup.sql` (it now includes `user_profiles` table)
4. Paste and click **Run**

**What's new in the schema:**
- `user_profiles` table for storing usernames
- Row Level Security policies for user_profiles
- Proper foreign key relationships

### Step 2: Set Up Email Templates (Optional but Recommended)

For professional-looking emails, configure custom templates in Supabase:

#### Upload the Flow Icon to Supabase Storage:

1. Go to **Storage** in Supabase dashboard
2. Create a new bucket called `assets` (make it public)
3. Upload `Flow-icon.webp` from the `public` folder
4. Note the public URL (or use the templates as-is with the placeholder)

#### Configure Email Templates:

1. Go to **Authentication** → **Email Templates** in Supabase
2. **For "Confirm signup":**
   - Copy the HTML from `email-templates/signup-confirmation.html`
   - Paste into the template editor
   - Replace the image URL if you uploaded the icon to storage
   - Save

3. **For "Reset Password":**
   - Copy the HTML from `email-templates/password-reset.html`
   - Paste into the template editor
   - Replace the image URL if you uploaded the icon to storage
   - Save

---

## 🎯 New Features Guide

### 1. Password Visibility Toggle

**Location:** Login & Signup pages

**How it works:**
- Click the eye icon next to password fields to reveal/hide your password
- Uses `<Eye>` and `<EyeOff>` icons from Lucide React
- Works on both password and confirm password fields

### 2. Username System

**During Signup:**
1. New users must now enter a username (min 3 characters)
2. Usernames are stored in the `user_profiles` table
3. Each username must be unique across all users

**In the Navbar:**
- Your username is now displayed instead of your email
- Falls back to email if username isn't set

### 3. Settings Page

**Access:** Click the settings icon (⚙️) in the navbar

**Features:**
- Change your username (min 3 characters)
- View your email (cannot be changed)
- Real-time validation
- Success/error messages

**Location:** `/settings` route (protected)

### 4. Custom App Icon

**Where it appears:**
- Browser tab favicon
- PWA icon (if deployed)
- Navbar logo (clickable - returns to dashboard)
- Email templates

**Icon:** Beautiful copper-colored quill pen (`Flow-icon.webp`)

### 5. Premium Email Templates

**Features:**
- Modern gradient design (purple/blue gradient)
- Responsive layout
- Professional typography
- Security notices
- Branded with Flow icon

**Templates created:**
1. `signup-confirmation.html` - For email verification
2. `password-reset.html` - For password reset requests

---

## 🐛 Troubleshooting

### "Failed to create note" Error

**Cause:** Database tables haven't been set up

**Solution:**
1. Run the updated `supabase-setup.sql` script
2. Verify both `notes` and `user_profiles` tables exist
3. Check RLS policies are enabled

### Username Not Showing

**Cause:** User signed up before username system was added

**Solution:**
1. Go to Settings page
2. Set your username
3. Refresh the page

### Email Templates Not Updating

**Cause:** Supabase caches email templates

**Solution:**
1. Clear your browser cache
2. Wait a few minutes for Supabase to update
3. Try signing up with a new test account

### Can't Update Username

**Cause:** Username might already be taken or RLS policies not set up

**Solution:**
1. Try a different username
2. Verify `user_profiles` table and policies exist
3. Check browser console for detailed error

---

## 📊 Database Schema Summary

### user_profiles Table

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,              -- Links to auth.users(id)
  username TEXT UNIQUE NOT NULL,    -- User's chosen username
  email TEXT NOT NULL,              -- User's email (for reference)
  created_at TIMESTAMP,             -- Profile creation date
  updated_at TIMESTAMP              -- Last update date
);
```

**RLS Policies:**
- Users can view their own profile
- Users can update their own profile
- Users can insert their own profile

### notes Table (Unchanged)

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🎨 Customization Options

### Change Password Visibility Icon

Edit `src/components/PasswordInput.tsx`:
- Replace `<Eye>` and `<EyeOff>` imports
- Use different Lucide icons

### Modify Email Template Colors

Edit HTML files in `email-templates/`:
- Change gradient: `background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);`
- Update text colors in inline styles

### Customize Settings Page

Edit `src/pages/Settings.tsx`:
- Add more profile fields
- Include avatar upload
- Add email notification preferences

---

## ✅ Testing Checklist

Before deploying, test these features:

- [ ] Sign up with a new account (includes username)
- [ ] Toggle password visibility on login/signup
- [ ] Verify email confirmation (if enabled)
- [ ] Log in successfully
- [ ] Create a new note
- [ ] Edit and save notes
- [ ] Search for notes
- [ ] Go to Settings and change username
- [ ] Verify username appears in navbar
- [ ] Test dark mode toggle
- [ ] Sign out and sign back in

---

## 🚀 Next Steps

Your app now has:
✅ Full authentication with usernames
✅ Professional email templates
✅ Settings management
✅ Enhanced UX with password visibility
✅ Custom branding with Flow icon

**Ready to deploy?** 
- Build: `npm run build`
- Deploy to Vercel, Netlify, or your preferred platform
- Update environment variables on hosting platform
- Test all features in production

**Need more features?**
- Add profile pictures
- Implement note categories/tags
- Add note sharing
- Enable real-time collaboration
- Add export functionality (PDF, Markdown)

---

**Questions or Issues?**
Check the main README.md and SUPABASE_SETUP.md for more information.
