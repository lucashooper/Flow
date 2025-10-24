# Image Paste Setup Guide 📸

## ✅ **What's Been Added**

Image paste functionality is now fully implemented! You can:
- **Copy an image** from anywhere (screenshot, browser, file explorer)
- **Paste it directly** into a note (Ctrl+V / Cmd+V)
- **Images are automatically uploaded** to Supabase Storage
- **Images display beautifully** in the editor

---

## 🔧 **Supabase Storage Setup Required**

### **Step 1: Create Storage Bucket**

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Enter the following details:
   - **Name:** `note-images`
   - **Public bucket:** ✅ **YES** (images need to be publicly accessible)
   - **File size limit:** 5 MB (or your preference)
   - **Allowed MIME types:** Leave empty (allows all image types)
5. Click **"Create bucket"**

---

### **Step 2: Set Bucket Policies** (IMPORTANT!)

By default, the bucket is private. You need to allow:
1. **Authenticated users** to upload images
2. **Everyone** to read images (so they display in notes)

#### **In Supabase Dashboard:**

1. Go to **Storage** → `note-images` bucket
2. Click **"Policies"** tab
3. Click **"New policy"**

#### **Policy 1: Allow Uploads (Authenticated Users)**

```sql
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'note-images' 
  AND (storage.foldername(name))[1] = 'images'
);
```

**Or use the UI:**
- Policy name: `Allow authenticated uploads`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- USING expression: `bucket_id = 'note-images'`

#### **Policy 2: Allow Public Read**

```sql
CREATE POLICY "Allow public to view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'note-images');
```

**Or use the UI:**
- Policy name: `Allow public read`
- Allowed operation: `SELECT`
- Target roles: `public`  
- USING expression: `bucket_id = 'note-images'`

---

### **Step 3: Test It!**

1. **Open Flow app**
2. **Create or open a note**
3. **Copy an image** (take a screenshot, or copy from browser)
4. **Click in the editor** and press **Ctrl+V** (or Cmd+V on Mac)
5. **Wait a moment** - the image will upload and appear!

---

## 🎨 **How It Works**

### **Behind the Scenes:**

```typescript
// 1. User pastes (Ctrl+V)
// 2. TiptapEditor detects image in clipboard
// 3. Uploads to Supabase Storage:
//    - Bucket: note-images
//    - Path: images/random-timestamp.jpg
// 4. Gets public URL
// 5. Inserts image into editor
```

### **File Naming:**
Images are saved with random names like:
- `images/abc123-1234567890.png`
- `images/xyz789-1234567891.jpg`

This prevents:
- Name conflicts
- Overwriting existing images
- Security issues

---

## 🔍 **Troubleshooting**

### **Image paste not working?**

1. **Check browser console** for errors
2. **Verify storage bucket** exists: `note-images`
3. **Check policies** are set correctly
4. **Test image format** - try PNG, JPG, GIF

### **Images not displaying?**

1. **Bucket must be PUBLIC**
2. **Check public read policy** exists
3. **Verify image URL** in browser console
4. **Check CORS settings** (should be automatic)

### **Upload fails?**

- **Check auth** - user must be logged in
- **File size** - max 5MB by default
- **Check upload policy** - authenticated users need INSERT permission

---

## 📊 **Storage Limits**

### **Supabase Free Tier:**
- **1 GB** storage
- **2 GB** bandwidth/month

### **Estimate:**
- Average image: ~500 KB
- Free tier: ~2,000 images
- Plenty for personal use!

### **If You Hit Limits:**
- Upgrade to Supabase Pro ($25/month)
- Use image compression
- Delete old images

---

## 🚀 **Future Improvements**

### **Coming Soon:**
- [ ] Image resize/crop in editor
- [ ] Drag & drop images
- [ ] Image captions
- [ ] Image galleries
- [ ] Compress images before upload
- [ ] Delete unused images
- [ ] Image search

---

## 🎯 **Quick Start Checklist**

- [ ] Create `note-images` bucket (public)
- [ ] Add upload policy (authenticated users)
- [ ] Add read policy (public)
- [ ] Test paste in a note
- [ ] Verify image displays
- [ ] Celebrate! 🎉

---

## 💡 **Pro Tips**

1. **Screenshots work great!** 
   - Windows: Win+Shift+S
   - Mac: Cmd+Shift+4
   - Then paste directly into Flow!

2. **Copy from browser**
   - Right-click any image → Copy
   - Paste into Flow!

3. **Multiple images**
   - Paste them one by one
   - They'll stack vertically

4. **Formatting**
   - Images auto-resize to fit
   - Round corners for aesthetics
   - Margins for spacing

---

## 🔐 **Security Notes**

- Images are **public** once uploaded
- Don't paste sensitive screenshots
- Anyone with the URL can view images
- Consider adding authentication for sensitive content

---

## ✨ **You're All Set!**

Image paste functionality is ready to go. Just set up the Supabase bucket and you're good!

**Test it now:** Copy this guide's heading as an image and paste it into a note! 📸
