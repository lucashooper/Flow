# Context Menu Debug Instructions 🔧

## 🚨 **IMMEDIATE TESTING STEPS**

### **1. Test Basic Functionality**
1. **Refresh browser** (hard refresh: Cmd/Ctrl+Shift+R)
2. **Open browser console** (F12 → Console tab)
3. **Select some text** in a note
4. **Right-click** → Context menu should appear
5. **Try Font Size** → Look for console logs

### **2. Check Console Output**
When you click Font Size → Tiny, you should see:
```
Setting font size: 0.75rem
```

When you click Text Color → Purple, you should see:
```
Setting color: #a855f7
```

If you see errors instead, that tells us what's wrong!

---

## 🔍 **DEBUGGING CHECKLIST**

### **Font Size Issues**
- [ ] Console shows "Setting font size: X"
- [ ] No errors about "setMark" or "textStyle"
- [ ] Text actually changes size
- [ ] If errors: TextStyle extension not loaded properly

### **Text Color Issues**
- [ ] Console shows "Setting color: X"
- [ ] No errors about "setColor"
- [ ] Text actually changes color
- [ ] If errors: Color extension not loaded properly

### **Highlight Issues**
- [ ] Console shows "Setting highlight: X"
- [ ] No errors about "setHighlight"
- [ ] Text gets highlighted
- [ ] If errors: Highlight extension not loaded properly

---

## 🛠 **COMMON FIXES**

### **If Extensions Not Loading**
The issue is likely in TiptapEditor.tsx extensions array. Check:
1. All imports are correct
2. Extensions are added to the array
3. No TypeScript errors

### **If Commands Not Working**
The issue is in ContextMenu.tsx. Check:
1. Editor is not null
2. Commands are called correctly
3. Focus is set before command

### **If Nothing Happens**
1. Check browser console for errors
2. Verify Tiptap is loaded
3. Check if editor instance exists

---

## 🎯 **EXPECTED BEHAVIOR**

### **Working Font Size:**
1. Select text
2. Right-click → Font Size → Large
3. Text becomes 1.25rem (larger)
4. Console shows: "Setting font size: 1.25rem"

### **Working Text Color:**
1. Select text
2. Right-click → Text Color → Purple
3. Text becomes purple (#a855f7)
4. Console shows: "Setting color: #a855f7"

### **Working Highlight:**
1. Select text
2. Right-click → Highlight → Yellow
3. Text gets yellow background
4. Console shows: "Setting highlight: #fef08a"

---

## 🚨 **TROUBLESHOOTING**

### **Error: "Cannot read properties of null"**
- Editor not initialized properly
- Check TiptapEditor component

### **Error: "setMark is not a function"**
- TextStyle extension not loaded
- Check imports in TiptapEditor.tsx

### **Error: "setColor is not a function"**
- Color extension not loaded
- Check imports and extension array

### **No console logs at all**
- Context menu not calling functions
- Check onClick handlers in ContextMenu.tsx

---

## 🔧 **QUICK FIXES**

### **If Font Size Broken:**
```typescript
// In ContextMenu.tsx, replace with:
editor.chain().focus().setMark('textStyle', { fontSize: size.value }).run();
```

### **If Color Broken:**
```typescript
// In ContextMenu.tsx, replace with:
editor.chain().focus().setColor(color.value).run();
```

### **If Highlight Broken:**
```typescript
// In ContextMenu.tsx, replace with:
editor.chain().focus().setHighlight({ color: color.value }).run();
```

---

## 📋 **TESTING SCRIPT**

Run this in browser console to test editor:
```javascript
// Check if editor exists
console.log('Editor:', window.editor);

// Test font size manually
if (window.editor) {
  window.editor.chain().focus().setMark('textStyle', { fontSize: '2rem' }).run();
}
```

---

## ✅ **SUCCESS INDICATORS**

You'll know it's working when:
- Console shows debug messages
- Text actually changes when you click options
- No error messages in console
- Context menu closes after selection

---

**Let me know what you see in the console when you test!** 🔍

This will help us identify exactly what's broken and fix it quickly.
