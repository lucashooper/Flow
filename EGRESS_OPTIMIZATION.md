# Supabase Egress Optimization Guide

## Current Situation

**Problem**: 22.35 GB egress used out of 5 GB free tier limit (447% over limit)

**Cause**: Every time you open a note with images, Supabase serves those images again:
- 1008 notes total
- Many contain multiple images
- Each image ~500KB average
- Opening notes repeatedly throughout the day = images fetched 100+ times

**Math**: If 200 images are opened 50 times each in a month:
```
200 images × 500 KB × 50 views = 5 GB egress
```

With your usage pattern (1000+ notes, frequent switching), you're hitting the limit fast.

---

## Solutions (Choose One or More)

### Option 1: Upgrade to Supabase Pro ✅ **Recommended**

**Cost**: $25/month

**Benefits**:
- 200 GB egress (40x more than free)
- 100 GB storage
- Faster performance
- No restrictions
- Support

**How**: Go to Supabase Dashboard → Billing → Upgrade to Pro

**Best for**: You're using this app seriously with important data. $25/month is reasonable.

---

### Option 2: Enable CDN Caching (Code Update Required)

**How it works**: 
- Set cache headers on images
- Browser caches images for 7-30 days
- Reduces repeat fetches by 90%

**Implementation**:
```sql
-- In Supabase, set cache policy on note-images bucket
UPDATE storage.buckets 
SET public = true, 
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'note-images';
```

Then update `uploadImage` function to set cache headers.

**Savings**: ~80-90% reduction in egress

---

### Option 3: Move Images to External CDN

**Providers**:
- **Cloudflare R2**: $0.36/GB egress (10x cheaper than Supabase)
- **Cloudinary**: 25 GB free/month, then $0.08/GB
- **Imgur**: Free for moderate use
- **AWS S3 + CloudFront**: $0.085/GB

**How**: 
1. Upload images to CDN
2. Update image URLs in notes
3. Keep Supabase for notes/folders only

**Savings**: 90%+ cost reduction

---

### Option 4: Delete Unused Folders

**Check Admin Dashboard** (now available at `/admin`):
- See which folders use the most storage
- Identify folders with many images
- Delete unused folders with images

**Immediate**: Can reclaim 50%+ space if you have old/unused folders

---

### Option 5: Image Compression

**Before upload**, compress images:
- Use WebP instead of PNG/JPEG (50% smaller)
- Resize large images to max 1920px width
- Strip metadata

**Savings**: 40-60% storage + egress reduction

**Implementation**: Update `uploadImage` to compress before upload

---

## Recommended Action Plan

### Immediate (Today)
1. **Visit `/admin`** to see which folders use most data
2. **Delete unused folders** with many images
3. **Export backup** using Admin Dashboard

### Short-term (This Week)
1. **Upgrade to Supabase Pro** ($25/month) ← easiest solution
2. **Enable CDN caching** in Supabase bucket settings

### Long-term (Optional)
1. Move images to Cloudflare R2 or Cloudinary
2. Add image compression on upload
3. Implement lazy loading (only load visible images)

---

## How to Access Admin Dashboard

**URL**: `https://your-site.com/admin`

**Access**: Only visible to `edwardsjonny547@gmail.com`

**Features**:
- See total notes, folders, images, storage
- View storage usage by folder
- Export all data as JSON backup
- Identify high-usage folders for cleanup

---

## Emergency Backup

If you need to move everything to a new Supabase project:

1. Go to `/admin` → **Export All Data**
2. Downloads JSON with all notes + folders
3. Run the generated SQL in new project
4. Images stay at old URLs (still work) or migrate separately

---

## Questions?

- **"Why is egress so high?"** — Images are re-fetched on every note open. No browser caching.
- **"Is my data safe?"** — Yes, use `/admin` to export everything. Always have backups.
- **"Can I use free tier?"** — Not sustainably with 1000+ notes and images. Need Pro or CDN.
- **"What's the best solution?"** — Supabase Pro ($25/mo) is simplest. For cheaper: Cloudflare R2.

---

## Monitor Usage

**Supabase Dashboard** → Project → Settings → Billing
- Check egress daily
- Set up usage alerts
- Track which operations use most bandwidth

Free tier grace period ends soon — take action before restrictions hit.
