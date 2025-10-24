# Image Paste Debug Guide 🐛

## 🔍 **Issue Reported**
User copied image from Discord and pasted in Flow, but nothing happened.

## ✅ **What I Fixed**

### **1. Improved Paste Handler**
- Added comprehensive console logging
- Fixed editor reference issue
- Use `view.dispatch` instead of `editor.chain()`
- Better error handling

### **2. Debug Logs Added**
When you paste, you'll now see in console:
```
📋 Paste event detected: [DataTransferItemList]
📋 Item type: image/png (or whatever type)
📸 Image file found: File {name: "image.png", ...}
✅ Image uploaded, URL: https://...
```

## 🧪 **Testing Steps**

### **Test 1: Screenshot**
1. Take a screenshot (Win+Shift+S / Cmd+Shift+4)
2. Click in Flow editor
3. Press Ctrl+V / Cmd+V
4. **Check console** for logs
5. Image should appear

### **Test 2: Copy from Browser**
1. Right-click any image online
2. Click "Copy image"
3. Paste in Flow
4. **Check console**
5. Image should appear

### **Test 3: Discord Image**
1. Right-click image in Discord
2. Click "Copy Image"
3. Paste in Flow
4. **Check console** - what does it say?

## 🔍 **Troubleshooting**

### **If you see NO logs:**
❌ **Problem:** Paste event not firing
**Solutions:**
- Make sure editor is focused (click in it first)
- Try refreshing the page
- Check browser console for errors

### **If you see logs but NO "image" type:**
❌ **Problem:** Discord copies images differently
**What to check:**
- Look at the `Item type` in console
- Discord might use `text/html` or `text/uri-list` instead
- We may need to handle these formats

### **If you see "Image file found" but NO upload:**
❌ **Problem:** Supabase bucket not set up
**Solution:**
- Go to Supabase Dashboard
- Create `note-images` bucket (public)
- Set policies (see IMAGE_PASTE_SETUP.md)

### **If upload succeeds but image doesn't show:**
❌ **Problem:** Image extension not configured
**Check:**
- Image extension is imported
- Image extension is in extensions array
- Schema includes image node

## 💡 **Discord Specific Issue**

Discord might copy images as:
1. **Blob URL** (`blob:https://discord.com/...`)
2. **Data URL** (`data:image/png;base64,...`)
3. **File** (what we expect)
4. **HTML** (`<img src="...">`)

### **Current Implementation:**
We only handle **File** type (item.type === 'image/*')

### **To Support Discord:**
We may need to also handle:
```typescript
// Check for image URLs in clipboard
for (const item of items) {
  if (item.type === 'text/html') {
    // Parse HTML and extract image URL
  }
  if (item.type === 'text/plain') {
    const text = event.clipboardData.getData('text/plain');
    if (text.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)$/i.test(text)) {
      // It's an image URL!
    }
  }
}
```

## 🔧 **Next Steps**

1. **Test with console open**
2. **Copy exact console output** when pasting from Discord
3. **Share the output** so I can see what format Discord uses
4. **I'll update the handler** to support Discord's format

## 📋 **Expected Console Output**

### **Successful Paste:**
```
📋 Paste event detected: DataTransferItemList {0: DataTransferItem, ...}
📋 Item type: image/png
📸 Image file found: File {name: "image.png", size: 123456, type: "image/png"}
✅ Image uploaded, URL: https://oetxqcyktahczrqrxlds.supabase.co/storage/v1/object/public/note-images/images/abc123.png
```

### **If Nothing Happens:**
```
📋 Paste event detected: DataTransferItemList {0: DataTransferItem, ...}
📋 Item type: text/plain (or text/html, or something else)
📋 No image found in paste, hasImage: false
```

**This tells us Discord is sending a different format!**

## 🎯 **Action Items**

1. Open browser console (F12)
2. Try pasting from Discord
3. **Screenshot the console output**
4. Share it with me
5. I'll fix the handler to support Discord's format

**The logs will tell us exactly what's happening!** 🔍
