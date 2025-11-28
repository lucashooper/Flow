# Production Setup - Email Redirect Fix

## Problem
Email confirmation links currently redirect to `localhost` instead of your production domain `https://flow-notes.netlify.app/`

## Solution: Update Supabase Site URL

### Step 1: Update Site URL in Supabase

1. Go to **Supabase Dashboard**
2. Select your Flow project
3. Go to **Authentication** → **URL Configuration**
4. Find **Site URL** field
5. Change from: `http://localhost:5173`
6. Change to: `https://flow-notes.netlify.app`
7. Click **Save**

### Step 2: Add Redirect URLs

In the same **URL Configuration** section:

1. Find **Redirect URLs** section
2. Add these URLs (one per line):
   ```
   https://flow-notes.netlify.app/**
   https://flow-notes.netlify.app/dashboard
   http://localhost:5173/**
   ```
3. Click **Save**

**Why add localhost?** So you can still test locally during development.

---

## What This Does

When users click "Verify Email Address" in the email:
- ❌ Before: Redirects to `http://localhost:5173`
- ✅ After: Redirects to `https://flow-notes.netlify.app`

The `{{ .ConfirmationURL }}` variable in your email template automatically uses the Site URL you set in Supabase.

---

## Testing

After updating:

1. **Sign up with a test email** on your production site
2. **Check the verification email**
3. **Click "Verify Email Address"**
4. **Should redirect to:** `https://flow-notes.netlify.app` ✅

---

## Additional Production Settings

### 1. Email Rate Limiting
- Go to **Authentication** → **Rate Limits**
- Set appropriate limits for production
- Recommended: 10 emails per hour per user

### 2. Email Templates
- Make sure all email templates use production URLs
- Check: Confirm signup, Password reset, Magic link

### 3. CORS Settings
- Go to **Settings** → **API**
- Add your production domain to allowed origins:
  ```
  https://flow-notes.netlify.app
  ```

---

## Environment Variables

Make sure your production environment (Netlify) has:

```env
VITE_SUPABASE_URL=https://oetxqcyktahczrqrxlds.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**To set in Netlify:**
1. Go to Netlify Dashboard
2. Select your Flow site
3. Go to **Site settings** → **Environment variables**
4. Add both variables
5. Redeploy your site

---

## Quick Checklist

- [ ] Update Site URL to `https://flow-notes.netlify.app`
- [ ] Add redirect URLs (production + localhost)
- [ ] Test signup on production site
- [ ] Verify email redirects to production domain
- [ ] Check environment variables in Netlify
- [ ] Test password reset flow
- [ ] Test magic link (if using)

---

## Common Issues

### Issue: Still redirecting to localhost
**Solution:** 
- Clear browser cache
- Sign up with a NEW email (old emails still have old URL)
- Wait 5 minutes for Supabase to update

### Issue: "Invalid redirect URL" error
**Solution:**
- Make sure you added the redirect URL in Supabase
- Include the `/**` wildcard
- Check for typos in the URL

### Issue: Email not sending in production
**Solution:**
- Check Supabase logs: Dashboard → Logs
- Verify email rate limits aren't exceeded
- Check spam folder

---

## Summary

1. ✅ Update **Site URL** to `https://flow-notes.netlify.app`
2. ✅ Add **Redirect URLs** (production + localhost)
3. ✅ Test with new signup
4. ✅ Emails will now redirect to production! 🚀

The `{{ .ConfirmationURL }}` in your email template will automatically use the correct domain based on your Supabase Site URL setting.
