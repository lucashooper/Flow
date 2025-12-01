# Focus Timer Debug Steps

## What I Just Fixed

**Problem:** `NewDashboard` page doesn't use `AppLayout`, so `FocusFloat` was never mounted.

**Solution:** Added `FocusFloat` directly to `NewDashboard.tsx`

---

## Test Steps

### 1. Open Browser Console
Press `F12` or right-click → Inspect → Console tab

### 2. Reload the Page
You should see:
```
[FocusFloat] render - enabled: false, showTimer: false, isRunning: false
```

If you **don't see this log**, the component still isn't mounting. Check:
- Is the import correct? `import FocusFloat from '../../landing/components/FocusFloat';`
- Is it rendered? Look for `<FocusFloat />` in the JSX

### 3. Click the Timer Icon (Top-Right)
The clock/timer icon in the navbar.

You should see:
```
[FocusFloat] render - enabled: true, showTimer: false, isRunning: false
```

And a **bottom-right timer trigger** should appear with `⏱ Start focus`

### 4. If Nothing Happens

Check the console for errors. Common issues:

**Error: "Cannot find module"**
- Import path is wrong
- Fix: Verify `../../landing/components/FocusFloat` resolves correctly

**Error: "localStorage is not defined"**
- SSR issue (shouldn't happen in Vite)
- The hook already has try/catch to handle this

**No console log at all**
- Component isn't mounting
- Check if `<FocusFloat />` is actually in the rendered JSX
- Try adding `console.log('NewDashboard rendering')` at the top of the component

**Console log shows but no timer appears**
- Check if `enabled` is actually `true` in the log
- Inspect the DOM: look for `class="fixed bottom-6 right-6"`
- Check if something has `z-index` higher than `9999`
- Check if the element has `display: none` or `opacity: 0`

### 5. Manual localStorage Test

Open console and run:
```js
// Set it manually
localStorage.setItem('flow_floating_focus_enabled', 'true');

// Dispatch the event
window.dispatchEvent(new CustomEvent('focusFloatToggle', { detail: true }));

// Reload and check
location.reload();
```

After reload, you should see:
```
[FocusFloat] render - enabled: true, showTimer: false, isRunning: false
```

And the timer trigger should be visible.

---

## Quick DOM Inspection

If the timer still doesn't appear, inspect the DOM:

1. Open DevTools → Elements tab
2. Search for `focus-float-trigger` (Ctrl+F in Elements)
3. If found but not visible:
   - Check computed styles
   - Look for `display: none`, `opacity: 0`, `visibility: hidden`
   - Check `z-index` and positioning
4. If not found at all:
   - The component is returning `null`
   - Check the console log to see why

---

## Expected Behavior

### When Working:
1. Click timer icon → Console log shows `enabled: true`
2. Bottom-right trigger appears immediately
3. Click trigger → Modal opens
4. Click timer icon again → Trigger disappears

### Current State:
- ✅ `FocusFloat` is now mounted in `NewDashboard`
- ✅ Hook syncs state via custom events
- ✅ Debug logging is active
- ⏳ Need to verify it actually works in browser

---

## If Still Broken

Try this nuclear option - add a visible debug element:

```tsx
// In NewDashboard.tsx, add this temporarily:
<div className="fixed top-20 right-6 bg-red-500 text-white p-4 z-[10000]">
  FocusFloat should be here
</div>
<FocusFloat />
```

If you see the red box but no timer, then `FocusFloat` is definitely not rendering.

Check the component itself:
```tsx
// In FocusFloat.tsx, at the very top of the component:
export const FocusFloat = ({ forcedEnabled, tasks = [] }: FocusFloatProps) => {
  console.log('[FocusFloat] Component called');
  
  const { enabled } = useFloatingFocusEnabled();
  console.log('[FocusFloat] enabled from hook:', enabled);
  
  // ... rest of component
```

This will tell you:
1. Is the component being called at all?
2. What is the `enabled` value?

---

## Next Steps

After confirming it works on `/dashboard`, we should also add `FocusFloat` to:
- `/tasks` page (if it doesn't use `AppLayout`)
- Any other main pages

But let's verify it works on this page first!
