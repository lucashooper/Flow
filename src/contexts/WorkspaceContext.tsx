import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type PaneDirection = 'vertical' | 'horizontal';
export type DropRegion = 'left' | 'right' | 'top' | 'bottom' | 'center';

export type PaneLeaf = {
  type: 'leaf';
  id: string;
  noteId: string | null;
};

export type PaneSplit = {
  type: 'split';
  id: string;
  direction: PaneDirection;
  sizes: number[]; // fractions that sum to 1
  children: PaneNode[];
};

export type PaneNode = PaneLeaf | PaneSplit;

function makeId(prefix = 'pane') {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface WorkspaceContextValue {
  root: PaneNode;
  setRoot: (node: PaneNode) => void;
  splitInto: (targetId: string, region: DropRegion, noteId: string) => void;
  replaceIn: (targetId: string, noteId: string) => void;
  closePane: (targetId: string) => void;
  resizeSplit: (splitId: string, sizes: number[]) => void;
  activeLeafId: string | null;
  setActiveLeafId: (id: string) => void;
  findLeafIdByNote: (noteId: string) => string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
};

function normalizeSizes(count: number, sizes?: number[]) {
  if (!sizes || sizes.length !== count) return Array(count).fill(1 / count);
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  return sizes.map(s => s / total);
}

// Utility: find first leaf id in a tree (breadth-first)
function findFirstLeafId(node: PaneNode): string | null {
  const q: PaneNode[] = [node];
  while (q.length) {
    const n = q.shift()!;
    if (n.type === 'leaf') return n.id;
    if (n.type === 'split') q.push(...n.children);
  }
  return null;
}

function leafExists(node: PaneNode, id: string | null): boolean {
  if (!id) return false;
  const path = findPath(node, id);
  return Array.isArray(path) && path !== null;
}

function findLeafIdByNoteIn(node: PaneNode, noteId: string): string | null {
  if (node.type === 'leaf') return node.noteId === noteId ? node.id : null;
  for (const child of node.children) {
    const got = findLeafIdByNoteIn(child, noteId);
    if (got) return got;
  }
  return null;
}

function findPath(node: PaneNode, id: string, path: number[] = []): number[] | null {
  if (node.id === id) return path;
  if (node.type === 'split') {
    for (let i = 0; i < node.children.length; i++) {
      const p = findPath(node.children[i], id, [...path, i]);
      if (p) return p;
    }
  }
  return null;
}

function getAt(node: PaneNode, path: number[]): PaneNode {
  let cur: PaneNode = node;
  for (const idx of path) {
    cur = (cur as PaneSplit).children[idx];
  }
  return cur;
}

function setAt(root: PaneNode, path: number[], newNode: PaneNode): PaneNode {
  if (path.length === 0) return newNode;
  const head = path[0];
  const parentPath = path.slice(0, -1);
  const parent = getAt(root, parentPath) as PaneSplit;
  const nextParent: PaneSplit = {
    ...parent,
    children: parent.children.map((c, i) => (i === head ? newNode : c)),
  };
  return setAt(root, parentPath, nextParent);
}

export const WorkspaceProvider: React.FC<{ 
  initialNoteId: string | null; 
  selectedNoteId?: string | null; 
  onActiveNoteChange?: (noteId: string | null) => void;
  children: React.ReactNode 
}>
  = ({ initialNoteId, selectedNoteId, onActiveNoteChange, children }) => {
  const [root, setRoot] = useState<PaneNode>(() => {
    // Try to restore workspace layout from localStorage
    try {
      const saved = localStorage.getItem('workspaceLayout');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that it's a valid PaneNode structure
        if (parsed && (parsed.type === 'leaf' || parsed.type === 'split')) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to restore workspace layout:', e);
    }
    // Default to single pane with initial note
    return { type: 'leaf', id: makeId('leaf'), noteId: initialNoteId };
  });
  const [activeLeafId, setActiveLeafId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('activeLeafId');
      if (saved) return saved;
    } catch (e) {
      console.error('Failed to restore active leaf:', e);
    }
    return (root as PaneLeaf).id;
  });

  // Persist workspace layout whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('workspaceLayout', JSON.stringify(root));
    } catch (e) {
      console.error('Failed to save workspace layout:', e);
    }
  }, [root]);

  // Persist active leaf ID
  useEffect(() => {
    if (activeLeafId) {
      try {
        localStorage.setItem('activeLeafId', activeLeafId);
      } catch (e) {
        console.error('Failed to save active leaf:', e);
      }
    }
  }, [activeLeafId]);

  const replaceIn = useCallback((targetId: string, noteId: string) => {
    setRoot(prev => {
      const p = findPath(prev, targetId);
      if (!p) return prev;
      const leaf = getAt(prev, p) as PaneLeaf;
      if (leaf.type !== 'leaf') return prev;
      const newLeaf: PaneLeaf = { ...leaf, noteId };
      return setAt(prev, p, newLeaf);
    });
  }, []);

  const resizeSplit = useCallback((splitId: string, sizes: number[]) => {
    setRoot(prev => {
      const p = findPath(prev, splitId);
      if (!p) return prev;
      const node = getAt(prev, p) as PaneSplit;
      if (node.type !== 'split') return prev;
      const newParent: PaneSplit = { ...node, sizes: normalizeSizes(node.children.length, sizes) };
      return setAt(prev, p, newParent);
    });
  }, []);

  const closePane = useCallback((targetId: string) => {
    setRoot(prev => {
      const path = findPath(prev, targetId);
      if (!path) return prev;
      if (path.length === 0) return { type: 'leaf', id: makeId('leaf'), noteId: null };
      const parentPath = path.slice(0, -1);
      const idx = path[path.length - 1];
      const parent = getAt(prev, parentPath) as PaneSplit;
      const children = parent.children.filter((_, i) => i !== idx);
      if (children.length === 1) {
        // Collapse single child into parent
        const only = children[0];
        const next = setAt(prev, parentPath, only);
        // If the closed leaf was active, move focus to the remaining leaf
        if (!leafExists(next, activeLeafId)) {
          const fallback = findFirstLeafId(next);
          if (fallback) setActiveLeafId(fallback);
        }
        return next;
      }
      const sizes = normalizeSizes(children.length, parent.sizes.filter((_, i) => i !== idx));
      const newParent: PaneSplit = { ...parent, children, sizes };
      const next = setAt(prev, parentPath, newParent);
      if (!leafExists(next, activeLeafId)) {
        const fallback = findFirstLeafId(next);
        if (fallback) setActiveLeafId(fallback);
      }
      return next;
    });
  }, []);

  const splitInto = useCallback((targetId: string, region: DropRegion, noteId: string) => {
    setRoot(prev => {
      const path = findPath(prev, targetId);
      if (!path) return prev;
      const target = getAt(prev, path);
      if (target.type !== 'leaf') return prev;

      const direction: PaneDirection = (region === 'left' || region === 'right') ? 'vertical' : 'horizontal';
      const insertAfter = region === 'right' || region === 'bottom';

      // If parent is same direction, insert sibling; else wrap in new split
      if (path.length > 0) {
        const parentPath = path.slice(0, -1);
        const parent = getAt(prev, parentPath) as PaneSplit;
        if (parent.type === 'split' && parent.direction === direction) {
          const idx = path[path.length - 1] + (insertAfter ? 1 : 0);
          const children = [...parent.children];
          const sizes = normalizeSizes(parent.children.length + 1, parent.sizes);
          const newLeaf: PaneLeaf = { type: 'leaf', id: makeId('leaf'), noteId };
          children.splice(idx, 0, newLeaf);
          const newSizes = normalizeSizes(children.length, sizes);
          const newParent: PaneSplit = { ...parent, children, sizes: newSizes };
          const next = setAt(prev, parentPath, newParent);
          // Focus the newly created sibling
          setActiveLeafId(newLeaf.id);
          return next;
        }
      }

      // Wrap target leaf in a split
      const newSibling: PaneLeaf = { type: 'leaf', id: makeId('leaf'), noteId };
      const children = insertAfter ? [target, newSibling] : [newSibling, target];
      const newSplit: PaneSplit = {
        type: 'split',
        id: makeId('split'),
        direction,
        sizes: normalizeSizes(2),
        children,
      };
      const next = setAt(prev, path, newSplit);
      setActiveLeafId(newSibling.id);
      return next;
    });
  }, []);

  // (removed old value memo)
  
  // Keep active leaf initialized to the first leaf id if missing
  useEffect(() => {
    if (!activeLeafId) {
      if (root.type === 'leaf') setActiveLeafId(root.id);
      else if (root.type === 'split') {
        // find first leaf
        const stack: PaneNode[] = [root];
        while (stack.length) {
          const n = stack.shift()!;
          if (n.type === 'leaf') { setActiveLeafId(n.id); break; }
          if (n.type === 'split') stack.unshift(...n.children);
        }
      }
    }
  }, [root, activeLeafId]);

  // When dashboard-selected note changes: replace in ACTIVE pane only
  const prevSelectedNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedNoteId) return;
    // Skip if selectedNoteId hasn't actually changed
    if (prevSelectedNoteIdRef.current === selectedNoteId) return;
    prevSelectedNoteIdRef.current = selectedNoteId;
    
    let target = activeLeafId;
    if (!leafExists(root, target)) {
      const fallback = findFirstLeafId(root);
      if (fallback) {
        setActiveLeafId(fallback);
        target = fallback;
      }
    }
    if (target) replaceIn(target, selectedNoteId);
  }, [selectedNoteId, activeLeafId, root]);

  // Notify parent when active pane's note changes (for sidebar highlighting)
  const lastNotifiedActiveNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeLeafId || !onActiveNoteChange) return;
    
    const path = findPath(root, activeLeafId);
    if (!path) return;
    
    const leaf = getAt(root, path);
    if (leaf.type !== 'leaf') return;

    const nextNoteId = leaf.noteId;
    if (lastNotifiedActiveNoteIdRef.current === nextNoteId) return;
    lastNotifiedActiveNoteIdRef.current = nextNoteId;

    onActiveNoteChange(nextNoteId);
  }, [activeLeafId, root, onActiveNoteChange]);

  const findLeafIdByNote = useCallback((noteId: string) => findLeafIdByNoteIn(root, noteId), [root]);

  const valueWithFocus = useMemo<WorkspaceContextValue>(
    () => ({ root, setRoot, splitInto, replaceIn, closePane, resizeSplit, activeLeafId, setActiveLeafId, findLeafIdByNote }),
    [root, splitInto, replaceIn, closePane, resizeSplit, activeLeafId, findLeafIdByNote]
  );

  return (
    <WorkspaceContext.Provider value={valueWithFocus}>{children}</WorkspaceContext.Provider>
  );
};
