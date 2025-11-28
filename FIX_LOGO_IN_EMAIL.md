# Fix Logo in Email Template

## Problem
The logo isn't showing in the email because `{{ .SiteURL }}/Flow-icon.webp` doesn't work during development or if your site isn't deployed yet.

## Solutions

### Option 1: Upload Logo to Supabase Storage (RECOMMENDED)

1. **Go to Supabase Dashboard**
   - Navigate to: Storage → Buckets

2. **Create a public bucket** (if you don't have one)
   - Click "New Bucket"
   - Name it: `public-assets`
   - Make it **Public**

3. **Upload your logo**
   - Open the `public-assets` bucket
   - Click "Upload File"
   - Select `Flow-icon.webp` from your `public` folder
   - Upload it

4. **Get the public URL**
   - Click on the uploaded file
   - Click "Get URL" or "Copy URL"
   - You'll get something like:
     ```
     https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/public-assets/Flow-icon.webp
     ```

5. **Update email template**
   - Open `email-template-premium.html`
   - Find: `{{ .SiteURL }}/Flow-icon.webp`
   - Replace with your Supabase Storage URL:
     ```html
     <img src="https://YOUR_PROJECT.supabase.co/storage/v1/object/public/public-assets/Flow-icon.webp" alt="Flow" />
     ```

6. **Save in Supabase**
   - Go to Supabase → Authentication → Email Templates → Confirm signup
   - Paste the updated template
   - Save

---

### Option 2: Use a CDN or Image Host

1. Upload `Flow-icon.webp` to:
   - Imgur
   - Cloudinary
   - GitHub (raw URL)
   - Any CDN

2. Get the direct image URL

3. Replace in email template:
   ```html
   <img src="YOUR_CDN_URL_HERE" alt="Flow" />
   ```

---

### Option 3: Use Base64 Encoding (Not Recommended)

This embeds the image directly in the email but increases email size.

1. Convert `Flow-icon.webp` to base64:
   ```bash
   # On Windows PowerShell:
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("public\Flow-icon.webp"))
   ```

2. Replace in email template:
   ```html
   <img src="data:image/webp;base64,YOUR_BASE64_STRING_HERE" alt="Flow" />
   ```

---

## Quick Fix Template

Here's the updated email template with a placeholder for your Supabase Storage URL:

```html
<!-- Replace this line in email-template-premium.html -->

<!-- OLD: -->
<img src="{{ .SiteURL }}/Flow-icon.webp" alt="Flow" class="logo" width="72" height="72" />

<!-- NEW: -->
<img src="https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/public-assets/Flow-icon.webp" alt="Flow" class="logo" width="72" height="72" />
```

**Replace `oetxqcyktahczrqrxlds` with your actual Supabase project ID!**

---

## Testing

After updating:

1. Sign up with a test email
2. Check inbox
3. Verify logo appears
4. If not, check:
   - Is the Supabase Storage bucket public?
   - Is the URL correct?
   - Try opening the URL directly in browser

---

## Why {{ .SiteURL }} Doesn't Work

- `{{ .SiteURL }}` refers to your deployed site URL
- During development, this is `http://localhost:5173`
- Email clients can't access localhost
- Even when deployed, the logo needs to be publicly accessible

**Solution:** Use Supabase Storage or a CDN for email assets.
