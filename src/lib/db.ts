import Dexie, { type Table } from 'dexie';

export interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  folder_id: string | null;
  dashboard_id: string | null;
  created_at: string;
  updated_at: string;
  emoji: string | null;
  drawing_data: any | null;
  is_starred: boolean;
  synced: boolean; // Track if synced to server
}

export interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  user_id: string;
  parent_id: string | null;
  dashboard_id: string | null;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface OutboxItem {
  id: string;
  entityType: 'note' | 'folder';
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: any;
  createdAt: string;
  attempts: number;
}

export interface MetaData {
  key: string;
  value: string;
}

export class FlowDatabase extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaData, string>;

  constructor() {
    super('FlowDB');
    
    this.version(1).stores({
      notes: 'id, user_id, dashboard_id, folder_id, updated_at, synced',
      folders: 'id, user_id, dashboard_id, parent_id, updated_at, synced',
      outbox: 'id, entityType, entityId, createdAt, attempts',
      meta: 'key'
    });
  }
}

export const db = new FlowDatabase();

// Helper to generate UUID v4
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper to get device ID (persistent)
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Helper to get last sync time
export async function getLastSyncTime(): Promise<string | null> {
  const meta = await db.meta.get('lastSyncAt');
  return meta?.value || null;
}

// Helper to set last sync time
export async function setLastSyncTime(time: string): Promise<void> {
  await db.meta.put({ key: 'lastSyncAt', value: time });
}
