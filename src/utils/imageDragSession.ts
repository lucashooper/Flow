import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from 'prosemirror-model';
import {
  destroyImageDropOverlay,
  getImageDropPreview,
  hideImageDropIndicator,
  moveImageWithPreview,
  showImageDropIndicator,
  type ImageDropPreview,
} from './imageDropPreview';
import { isColumnDropKind } from './imageColumnDrop';

type PointerDragSession = {
  editor: Editor;
  fromPos: number;
  node: PMNode;
  width: number;
  draggedEl: HTMLElement | null;
  lastPreview: ImageDropPreview | null;
  ghost: HTMLElement | null;
  ghostOffsetX: number;
  ghostOffsetY: number;
  onFinish?: () => void;
};

let activeSession: PointerDragSession | null = null;

function logDropTarget(preview: ImageDropPreview | null, coords: { x: number; y: number }): void {
  console.log('[DropTarget]', {
    x: coords.x,
    y: coords.y,
    kind: preview?.kind ?? null,
    insertPos: preview?.insertPos ?? null,
    targetImagePos: preview?.targetImagePos ?? null,
  });
}

function logDropExecute(
  reason: 'mouseup' | 'cancel' | 'blur',
  preview: ImageDropPreview | null,
  fromPos: number,
  moved: boolean,
): void {
  console.log('[DropExecute]', {
    reason,
    fromPos,
    moved,
    kind: preview?.kind ?? null,
    insertPos: preview?.insertPos ?? null,
    targetImagePos: preview?.targetImagePos ?? null,
  });
}

function clearDragUi(): void {
  hideImageDropIndicator();
  destroyImageDropOverlay();
  document.body.classList.remove('flow-image-dragging');
  document.body.style.cursor = '';
}

function removeGhost(session: PointerDragSession): void {
  session.ghost?.remove();
  session.ghost = null;
}

function teardownPointerListeners(): void {
  document.removeEventListener('mousemove', handlePointerMove, true);
  document.removeEventListener('mouseup', handlePointerUp, true);
  window.removeEventListener('blur', handlePointerCancel, true);
  document.removeEventListener('keydown', handlePointerKey, true);
}

function handlePointerMove(ev: MouseEvent): void {
  if (!activeSession) return;
  ev.preventDefault();

  const session = activeSession;
  if (session.ghost) {
    session.ghost.style.left = `${ev.clientX - session.ghostOffsetX}px`;
    session.ghost.style.top = `${ev.clientY - session.ghostOffsetY}px`;
  }

  session.lastPreview = getImageDropPreview(
    session.editor,
    ev.clientX,
    ev.clientY,
    session.fromPos,
    session.width,
    session.draggedEl,
  );
  logDropTarget(session.lastPreview, { x: ev.clientX, y: ev.clientY });
  showImageDropIndicator(session.lastPreview);
}

function endPointerSession(
  reason: 'mouseup' | 'cancel' | 'blur',
  ev?: MouseEvent,
): void {
  const session = activeSession;
  if (!session) return;

  teardownPointerListeners();
  activeSession = null;
  clearDragUi();
  removeGhost(session);

  let moved = false;
  let preview = session.lastPreview;

  if (reason === 'mouseup' && ev) {
    const freshPreview = getImageDropPreview(
      session.editor,
      ev.clientX,
      ev.clientY,
      session.fromPos,
      session.width,
      session.draggedEl,
    );

    preview = freshPreview ?? session.lastPreview;

    // If release missed the narrow side zone, honor the last column preview from drag-over
    if (
      preview &&
      preview.kind === 'line' &&
      session.lastPreview &&
      isColumnDropKind(session.lastPreview.kind)
    ) {
      preview = session.lastPreview;
    }

    if (preview) {
      const liveNode = session.editor.state.doc.nodeAt(session.fromPos) ?? session.node;
      moved = moveImageWithPreview(
        session.editor,
        session.fromPos,
        preview,
        liveNode,
      );
      if (!moved) {
        console.error('[ColumnDrop] drop on mouseup did not move node', {
          fromPos: session.fromPos,
          kind: preview.kind,
          label: preview.label,
        });
      }
    } else {
      console.error('[ColumnDrop] no drop preview at mouseup');
    }
    logDropExecute('mouseup', preview, session.fromPos, moved);
  } else {
    logDropExecute(reason, preview, session.fromPos, false);
  }

  session.onFinish?.();
}

function handlePointerUp(ev: MouseEvent): void {
  if (!activeSession) return;
  ev.preventDefault();
  endPointerSession('mouseup', ev);
}

function handlePointerCancel(): void {
  if (!activeSession) return;
  endPointerSession('cancel');
}

function handlePointerKey(ev: KeyboardEvent): void {
  if (!activeSession) return;
  if (ev.key === 'Escape') {
    ev.preventDefault();
    endPointerSession('cancel');
  }
}

/** Create a floating ghost that follows the pointer (no HTML5 drag). */
export function createPointerGhost(source: HTMLElement): {
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
} {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;

  ghost.style.position = 'fixed';
  ghost.style.zIndex = '10000';
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.opacity = '0.88';
  ghost.style.pointerEvents = 'none';
  ghost.style.boxShadow = '0 12px 40px rgba(0,0,0,0.45)';
  ghost.style.borderRadius = '8px';
  ghost.style.overflow = 'hidden';
  ghost.classList.add('flow-image-drag-ghost');

  ghost.querySelectorAll('img, video').forEach((el) => {
    (el as HTMLElement).style.pointerEvents = 'none';
  });

  document.body.appendChild(ghost);

  return {
    ghost,
    offsetX: Math.min(rect.width / 2, Math.max(0, rect.width * 0.5)),
    offsetY: Math.min(rect.height / 2, Math.max(0, rect.height * 0.5)),
  };
}

/** Begin pointer-based image repositioning (works reliably inside contenteditable). */
export function startPointerDragSession(
  session: Omit<PointerDragSession, 'lastPreview' | 'ghost' | 'ghostOffsetX' | 'ghostOffsetY'> & {
    ghost: HTMLElement;
    ghostOffsetX: number;
    ghostOffsetY: number;
  },
): void {
  endPointerDragSession();

  activeSession = {
    ...session,
    lastPreview: null,
  };

  document.body.classList.add('flow-image-dragging');
  document.body.style.cursor = 'grabbing';

  document.addEventListener('mousemove', handlePointerMove, true);
  document.addEventListener('mouseup', handlePointerUp, true);
  window.addEventListener('blur', handlePointerCancel, true);
  document.addEventListener('keydown', handlePointerKey, true);
}

export function endPointerDragSession(): void {
  if (!activeSession) return;
  endPointerSession('cancel');
}

export function isPointerDragActive(): boolean {
  return activeSession != null;
}
