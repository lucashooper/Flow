import { db } from './db';

/** Fields the Supabase `folders` table accepts (position is local-only until migrated). */
const FOLDER_SYNC_FIELDS = [
  'id', 'name', 'emoji', 'user_id', 'parent_id', 'dashboard_id', 'created_at', 'updated_at',
] as const;

/** Fields the Supabase `notes` table accepts (position is local-only until migrated). */
const NOTE_SYNC_FIELDS = [
  'id', 'title', 'content', 'user_id', 'folder_id', 'dashboard_id',
  'emoji', 'drawing_data', 'is_starred', 'created_at', 'updated_at',
] as const;

function pickFields<T extends Record<string, unknown>>(payload: T, fields: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in payload && payload[key] !== undefined) {
      result[key] = payload[key];
    }
  }
  return result;
}

export function sanitizeFolderPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return pickFields(payload, FOLDER_SYNC_FIELDS);
}

export function sanitizeNotePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return pickFields(payload, NOTE_SYNC_FIELDS);
}

export function sanitizeSyncPayload(
  entityType: 'note' | 'folder',
  payload: Record<string, unknown>
): Record<string, unknown> {
  return entityType === 'folder' ? sanitizeFolderPayload(payload) : sanitizeNotePayload(payload);
}

/** Fix outbox items queued before payload sanitization (e.g. included `position`). */
export async function repairOutboxPayloads(): Promise<number> {
  const items = await db.outbox.toArray();
  let repaired = 0;

  for (const item of items) {
    if (item.operation !== 'upsert') continue;
    const sanitized = sanitizeSyncPayload(item.entityType, item.payload);
    const hadExtraFields = JSON.stringify(sanitized) !== JSON.stringify(item.payload);
    if (hadExtraFields) {
      await db.outbox.update(item.id, { payload: sanitized, attempts: 0 });
      repaired++;
    }
  }

  if (repaired > 0) {
    console.log(`🔧 Repaired ${repaired} outbox payload(s) for Supabase compatibility`);
  }

  return repaired;
}
