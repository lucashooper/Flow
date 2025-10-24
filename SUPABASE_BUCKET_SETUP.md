# Supabase Storage Bucket Setup 🪣

## ❌ **Current Error:**
```
Bucket not found
StorageApiError: Bucket not found
```

This means the `note-images` bucket doesn't exist in your Supabase project yet!

---

## ✅ **How to Create the Bucket**

### **Step 1: Go to Supabase Dashboard**
1. Open https://supabase.com/dashboard
2. Select your project
3. Click **"Storage"** in the left sidebar

### **Step 2: Create New Bucket**
1. Click the **"New bucket"** button (green button, top right)
2. Fill in the details:
   - **Name:** `note-images`
   - **Public bucket:** ✅ **CHECK THIS BOX** (very important!)
   - **File size limit:** 5MB (or leave default)
   - **Allowed MIME types:** Leave empty (allows all image types)
3. Click **"Create bucket"**

### **Step 3: Set Bucket Policies**
The bucket needs two policies:

#### **Policy 1: Allow Authenticated Users to Upload**
1. Click on the `note-images` bucket
2. Go to **"Policies"** tab
3. Click **"New policy"**
4. Click **"For full customization"**
5. Fill in:
   - **Policy name:** `Allow authenticated uploads`
   - **Allowed operation:** `INSERT`
   - **Target roles:** `authenticated`
   - **Policy definition (USING):** `true`
6. Click **"Review"** → **"Save policy"**

#### **Policy 2: Allow Public Read**
1. Click **"New policy"** again
2. Click **"For full customization"**
3. Fill in:
   - **Policy name:** `Allow public read`
   - **Allowed operation:** `SELECT`
   - **Target roles:** `public`
   - **Policy definition (USING):** `true`
4. Click **"Review"** → **"Save policy"**

---

## 🎯 **Quick SQL Alternative**

If you prefer, run this in the **SQL Editor**:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true);

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'note-images');

-- Allow public read
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'note-images');
```

---

## ✅ **Test After Setup**

1. **Refresh your Flow app**
2. **Try pasting an image** in a note
3. **Check console** - should see:
   ```
   🎯 ImagePaste Extension: Paste detected
   📋 Item 1 type: image/png
   📸 Image detected in paste!
   ⬆️ Starting upload...
   ✅ Upload complete, URL: https://...
   ✅ Image inserted into editor
   ```
4. **Image should appear** in the editor!

---

## 🔍 **Verify Bucket Exists**

In your Supabase Dashboard:
1. Go to **Storage**
2. You should see **`note-images`** in the list
3. Click it → Should show empty folder
4. After uploading, you'll see:
   - `images/` folder (for pasted images)
   - `dashboard-covers/` folder (for dashboard covers)

---

## 📊 **Storage Limits**

**Free Tier:**
- 1 GB storage
- 2 GB bandwidth/month

**Enough for:**
- ~2,000 images (avg 500KB each)
- Perfect for personal use!

---

## ⚠️ **Important Notes**

1. **Bucket MUST be public** for images to display
2. **Name MUST be exactly** `note-images` (code expects this)
3. **Both policies required** (upload + read)
4. **Refresh app after setup**

---

## 🆘 **Still Having Issues?**

**Error: "Bucket not found"**
→ Bucket name is wrong or doesn't exist

**Error: "Access denied"**
→ Policies not set correctly

**Images upload but don't display**
→ Bucket is not public

**Error: "Storage API error"**
→ Check your Supabase project URL/keys in `.env`

---

## ✨ **Once This Works:**

You'll be able to:
- ✅ Paste images from clipboard
- ✅ Upload dashboard cover photos
- ✅ See images in notes
- ✅ All images stored safely in Supabase

**Do this now, then everything will work!** 🚀
