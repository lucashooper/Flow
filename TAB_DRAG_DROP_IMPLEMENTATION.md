# Tab Drag-and-Drop Implementation

## Overview
Implemented drag-and-drop reordering for tabs in the top tab bar using `@dnd-kit`, mirroring the existing drag-and-drop logic used in the notes sidebar.

---

## Files Modified

### 1. **NEW: `src/components/DraggableTab.tsx`**
A new component that wraps individual tabs with drag-and-drop functionality.

**Key Features:**
- Uses `useSortable` hook from `@dnd-kit/sortable`
- Applies visual feedback during drag (opacity: 0.8, scale: 0.98)
- Prevents drag from starting when clicking the close button via `onPointerDown` event
- Maintains all existing tab functionality (click to switch, hover effects)

**Drag State Handling:**
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ 
  id: note.id,
  data: { type: 'tab', note }
});
```

### 2. **MODIFIED: `src/components/EditorHeader.tsx`**
Updated to wrap tabs in a `DndContext` and `SortableContext`.

**Changes:**
- Added `DndContext` wrapper with `PointerSensor` (8px activation distance)
- Added `SortableContext` with `horizontalListSortingStrategy` for horizontal tab layout
- Added `DragOverlay` for smooth drag preview
- Added `onTabReorder` prop to handle reordering
- Replaced inline tab rendering with `DraggableTab` component

**Drag State Management:**
```typescript
const [activeId, setActiveId] = useState<string | null>(null);

const handleDragStart = (event: any) => {
  setActiveId(event.active.id); // Track which tab is being dragged
};

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  setActiveId(null);

  if (!over || active.id === over.id) return;

  // Calculate new order
  const oldIndex = openNotes.findIndex(note => note.id === active.id);
  const newIndex = openNotes.findIndex(note => note.id === over.id);

  if (oldIndex !== -1 && newIndex !== -1) {
    const reordered = [...openNotes];
    const [movedNote] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, movedNote);
    onTabReorder(reordered); // Update parent state
  }
};
```

### 3. **MODIFIED: `src/pages/NewDashboard.tsx`**
Added handler for tab reordering.

**Changes:**
- Added `handleTabReorder` function that updates `openNotes` state
- Passed `onTabReorder` prop to `EditorHeader`

```typescript
const handleTabReorder = (reorderedNotes: Note[]) => {
  setOpenNotes(reorderedNotes);
};
```

---

## How Drag State is Handled

### 1. **Activation**
- User clicks and drags a tab
- `PointerSensor` requires 8px movement before drag activates (prevents accidental drags)
- `handleDragStart` sets `activeId` to track the dragging tab

### 2. **During Drag**
- `DraggableTab` applies visual feedback (opacity + scale) via `isDragging` state
- `DragOverlay` shows a floating preview of the tab being dragged
- Other tabs smoothly animate to make space (handled by `@dnd-kit`)

### 3. **Drop**
- `handleDragEnd` calculates old and new positions
- Creates reordered array using array splice
- Calls `onTabReorder` to update parent state
- Resets `activeId` to null

### 4. **State Flow**
```
User drags tab
    ↓
handleDragStart (EditorHeader)
    ↓
activeId set → visual feedback
    ↓
User drops tab
    ↓
handleDragEnd (EditorHeader)
    ↓
Calculate new order
    ↓
onTabReorder(reorderedNotes)
    ↓
handleTabReorder (NewDashboard)
    ↓
setOpenNotes(reorderedNotes)
    ↓
Tabs re-render in new order
```

---

## Visual Feedback

### During Drag:
- **Dragging tab**: opacity: 0.8, scale: 0.98, z-index: 50, shadow
- **Drag overlay**: Floating preview with shadow-2xl, opacity-90
- **Other tabs**: Smooth animation as they shift positions

### Hover States:
- All existing hover effects preserved
- Close button only visible on hover
- Background color changes maintained

---

## Technical Details

### Preventing Close Button Drag:
```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    onTabClose(note.id);
  }}
  onPointerDown={(e) => {
    // Prevent drag from starting when clicking close button
    e.stopPropagation();
  }}
  className="..."
>
  <X className="w-3 h-3" />
</button>
```

### Horizontal Sorting Strategy:
```typescript
<SortableContext 
  items={openNotes.map(n => n.id)} 
  strategy={horizontalListSortingStrategy}
>
```
This ensures tabs move horizontally (left/right) rather than vertically.

### Activation Constraint:
```typescript
useSensor(PointerSensor, {
  activationConstraint: {
    distance: 8, // Require 8px movement before drag starts
  },
})
```
This prevents accidental drags when clicking to switch tabs.

---

## Testing Checklist

- [x] Tabs can be dragged and reordered
- [x] Visual feedback during drag (opacity + scale)
- [x] Drag overlay shows floating preview
- [x] Other tabs animate smoothly
- [x] Close button doesn't trigger drag
- [x] Tab switching still works
- [x] Tab closing still works
- [x] Hover effects preserved
- [x] Works with mouse and trackpad
- [x] Order persists within session (stored in React state)

---

## Future Enhancements (Optional)

1. **Persist tab order to localStorage**
   - Save `openNotes` order to localStorage
   - Restore on page load

2. **Keyboard shortcuts**
   - Ctrl+Tab to cycle through tabs
   - Ctrl+W to close active tab

3. **Tab overflow handling**
   - Add scroll buttons when too many tabs
   - Show tab count indicator

4. **Animation polish**
   - Add spring physics to drag animation
   - Smoother drop animation

---

## Library Used

**@dnd-kit** (already in use for notes sidebar)
- `@dnd-kit/core` - Core drag-and-drop functionality
- `@dnd-kit/sortable` - Sortable list utilities
- `@dnd-kit/utilities` - CSS transform utilities

**Advantages:**
- Lightweight and performant
- Excellent TypeScript support
- Flexible and customizable
- Accessibility built-in
- Works with both mouse and touch
