# Pomodoro Timer Feature - Complete Implementation

## ✅ Feature Overview

A premium Pomodoro / Focus Timer that integrates seamlessly into Flow's Tasks and Editor pages without cluttering the UI. The timer helps users focus on specific tasks with visual highlighting and dimming effects.

---

## 🎯 Key Features

### 1. **Global Timer State (Zustand)**
- Persists across page navigation (Tasks ↔ Editor)
- Tracks: `isRunning`, `secondsLeft`, `mode`, `attachedTaskId`, `pomodorosCompleted`
- Auto-switches between work/break/long break cycles

### 2. **Collapsible UI**
- **Collapsed:** Small pill showing remaining time + task name
- **Expanded:** Full controls with circular progress ring
- Floating bottom-right position (non-intrusive)

### 3. **Task Attachment**
- Dropdown to select any task
- Attached task gets highlighted with orange glow
- Other tasks dimmed to 40% opacity
- Smooth 220ms fade animations

### 4. **Premium Glassmorphic Design**
- Dark translucent background: `rgba(18, 18, 18, 0.85)`
- Subtle orange border: `rgba(255, 122, 24, 0.2)`
- Backdrop blur: `blur(12px)`
- Soft shadow: `0 20px 50px rgba(0, 0, 0, 0.7)`

### 5. **Visual Feedback**
- Pulsing ring around collapsed timer when running
- Circular progress indicator (SVG + Framer Motion)
- Smooth animations for all interactions

---

## 📁 Files Created/Modified

### **New Files:**

1. **`src/stores/timerStore.ts`**
   - Zustand store for global timer state
   - Actions: `start`, `pause`, `reset`, `tick`, `setMode`, `attachTask`
   - Durations: 25min work, 5min break, 15min long break
   - Auto-cycle logic (4 pomodoros → long break)

2. **`src/components/PomodoroTimer.tsx`**
   - Collapsible timer component
   - Circular SVG progress ring
   - Task attachment dropdown
   - Play/Pause/Reset controls
   - Pulsing animation when running

### **Modified Files:**

3. **`src/components/TaskCard.tsx`**
   - Added timer integration via `useTimerStore`
   - Highlighting for attached task:
     - Background: `rgba(255, 122, 24, 0.08)`
     - Border: `rgba(255, 122, 24, 0.3)`
     - Glow: `0 0 30px rgba(255, 122, 24, 0.2)`
   - Dimming for non-attached tasks: `opacity: 0.4`
   - Updated glassmorphic styling:
     - Background: `rgba(26, 26, 26, 0.4)`
     - Border: `rgba(255, 255, 255, 0.05)`
     - Shadow: `0 10px 30px rgba(255, 140, 0, 0.05)`
   - Added `pointerEvents: 'auto'` for drag-and-drop compatibility

4. **`src/pages/Tasks.tsx`**
   - Added `<PomodoroTimer tasks={tasks} position="floating" />`
   - Timer receives task list for attachment dropdown

5. **`src/pages/NewDashboard.tsx`**
   - Added `<PomodoroTimer position="floating" />`
   - Timer persists when navigating from Tasks to Editor

---

## 🎨 Design Tokens

### **Timer Component:**
```typescript
// Collapsed pill
background: 'rgba(18, 18, 18, 0.85)'
border: '1px solid rgba(255, 122, 24, 0.2)'
boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)'
backdropFilter: 'blur(12px)'

// Expanded card
background: 'rgba(18, 18, 18, 0.85)'
border: '1px solid rgba(255, 122, 24, 0.15)'
boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
backdropFilter: 'blur(12px)'

// Pulsing ring (when running)
border: '2px solid rgba(255, 122, 24, 0.5)'
animation: scale [1, 1.1, 1], opacity [0.5, 0.8, 0.5]
duration: 2s, infinite
```

### **Task Cards (Updated):**
```typescript
// Default state
background: 'rgba(26, 26, 26, 0.4)'
border: '1px solid rgba(255, 255, 255, 0.05)'
boxShadow: '0 10px 30px rgba(255, 140, 0, 0.05)'
backdropFilter: 'blur(16px)'

// Attached task (highlighted)
background: 'rgba(255, 122, 24, 0.08)'
border: '1px solid rgba(255, 122, 24, 0.3)'
boxShadow: '0 0 30px rgba(255, 122, 24, 0.2), 0 10px 30px rgba(255, 140, 0, 0.1)'

// Dimmed tasks (when timer running)
opacity: 0.4
transition: opacity 220ms

// Hover (non-dimmed)
background: 'rgba(255, 255, 255, 0.07)'
y: -1px
```

---

## 🔧 Technical Implementation

### **Timer State Management:**
```typescript
interface TimerState {
  isRunning: boolean;
  secondsLeft: number;
  mode: 'work' | 'break' | 'longBreak';
  attachedTaskId: string | null;
  pomodorosCompleted: number;
  
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  attachTask: (taskId: string | null) => void;
}
```

### **Timer Tick Logic:**
```typescript
useEffect(() => {
  if (!isRunning) return;
  
  const interval = setInterval(() => {
    tick(); // Decrements secondsLeft
  }, 1000);
  
  return () => clearInterval(interval);
}, [isRunning, tick]);
```

### **Auto-Cycle Logic:**
```typescript
if (newSecondsLeft <= 0) {
  set({ isRunning: false, secondsLeft: 0 });
  
  if (mode === 'work') {
    // Every 4th pomodoro → long break, else → short break
    const newMode = (pomodorosCompleted + 1) % 4 === 0 
      ? 'longBreak' 
      : 'break';
    setTimeout(() => {
      set({ 
        mode: newMode, 
        secondsLeft: DURATIONS[newMode],
        pomodorosCompleted: pomodorosCompleted + 1
      });
    }, 1000);
  } else {
    // Break finished → back to work
    setTimeout(() => {
      set({ mode: 'work', secondsLeft: DURATIONS.work });
    }, 1000);
  }
}
```

### **Task Highlighting Logic:**
```typescript
const { attachedTaskId, isRunning } = useTimerStore();
const isAttached = attachedTaskId === task.id;
const shouldDim = isRunning && attachedTaskId && !isAttached;

// Apply to card style
opacity: isDragging ? 0.5 : shouldDim ? 0.4 : 1,
background: isAttached ? 'rgba(255, 122, 24, 0.08)' : 'rgba(26, 26, 26, 0.4)',
border: isAttached ? '1px solid rgba(255, 122, 24, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
```

---

## 🎬 User Flow

### **Starting a Focus Session:**
1. User clicks collapsed timer pill (bottom-right)
2. Timer expands showing full controls
3. User clicks "Attach to task..." dropdown
4. Selects a task from the list
5. Timer displays: "25:00 — Working on: <taskName>"
6. User clicks Play button
7. Attached task highlights with orange glow
8. Other tasks dim to 40% opacity
9. Pulsing ring appears around collapsed pill

### **During Session:**
- Timer counts down: 25:00 → 24:59 → ... → 0:00
- Circular progress ring fills clockwise
- User can pause/resume/reset anytime
- Timer persists when navigating Tasks ↔ Editor

### **Session Complete:**
1. Timer reaches 0:00
2. Auto-pauses and switches to break mode
3. Dimming removed from tasks
4. (Future: Toast notification "Pomodoro complete!")

---

## ✨ UX Polish Details

### **Animations:**
- **Collapsed → Expanded:** Scale 0.9 → 1, opacity 0 → 1 (200ms)
- **Pulsing ring:** Scale 1 → 1.1 → 1, opacity 0.5 → 0.8 → 0.5 (2s loop)
- **Task dimming:** Opacity 1 → 0.4 (220ms fade)
- **Progress ring:** Smooth stroke-dashoffset animation (500ms ease-out)

### **Interactions:**
- **Hover collapsed pill:** Scale 1.02
- **Tap collapsed pill:** Scale 0.98
- **Hover Play/Reset buttons:** Scale 1.05
- **Tap Play/Reset buttons:** Scale 0.95

### **Drag-and-Drop Compatibility:**
- `pointerEvents: 'auto'` ensures dragging works on dimmed tasks
- Highlighting doesn't break DnD transforms
- Smooth opacity transitions don't interfere with drag animations

---

## 🚀 Future Enhancements (Not Implemented Yet)

### **Optional Features:**
- [ ] Sound notification when timer completes (commented out)
- [ ] Toast notification: "Pomodoro complete!"
- [ ] Statistics: total pomodoros completed today/week
- [ ] Custom durations (user settings)
- [ ] Auto-start next session
- [ ] Desktop notifications (browser API)
- [ ] Keyboard shortcuts (Space = play/pause, R = reset)

---

## 📊 Testing Checklist

### **Timer Functionality:**
- [x] Timer counts down correctly (1 second intervals)
- [x] Play/Pause/Reset buttons work
- [x] Auto-switches to break after work session
- [x] Auto-switches to long break after 4 pomodoros
- [x] Persists state across Tasks ↔ Editor navigation

### **Task Integration:**
- [x] Dropdown shows all incomplete tasks
- [x] Attached task highlights with orange glow
- [x] Other tasks dim to 40% opacity
- [x] Dimming fades smoothly (220ms)
- [x] Drag-and-drop still works on dimmed tasks

### **UI/UX:**
- [x] Collapsed pill shows time + task name
- [x] Pulsing ring appears when running
- [x] Circular progress ring animates smoothly
- [x] Expand/collapse animations smooth
- [x] Doesn't overlap sidebar on small screens
- [x] Glassmorphic styling matches Flow aesthetic

### **Edge Cases:**
- [x] Timer works with no tasks
- [x] Detaching task removes highlighting
- [x] Completing attached task removes it from dropdown
- [x] Timer resets correctly when switching modes

---

## 🎯 Summary

**Implemented:**
✅ Global Zustand timer store  
✅ Collapsible floating timer component  
✅ Circular SVG progress ring  
✅ Task attachment dropdown  
✅ Visual highlighting + dimming  
✅ Smooth animations (pulsing, fading)  
✅ Lighter glassmorphic task cards  
✅ Drag-and-drop compatibility  
✅ Persistence across navigation  

**Result:** A premium, non-intrusive Pomodoro timer that enhances focus without cluttering Flow's UI. The timer integrates seamlessly with tasks, providing visual feedback that helps users stay on track.

---

## 📦 Dependencies Added

```json
{
  "zustand": "^4.x.x"
}
```

All other dependencies (Framer Motion, Lucide React) were already installed.

---

**The Pomodoro feature is now live and ready for production!** 🎉
