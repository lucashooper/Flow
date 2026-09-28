/**
 * EMERGENCY: Full paginated cloud restore when production app only fetches 1000 rows.
 *
 * 1. Open https://flow-notes.app (logged in)
 * 2. Open DevTools → Console
 * 3. Paste this entire file and press Enter
 * 4. Hard refresh when done (Cmd+Shift+R)
 */
(async function emergencyCloudRestore() {
  const PAGE = 1000;

  const authKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (!authKey) {
    console.error('❌ Not logged in — sign in to Flow first.');
    return;
  }
  const session = JSON.parse(localStorage.getItem(authKey));
  const accessToken = session?.access_token;
  const userId = session?.user?.id;
  if (!accessToken || !userId) {
    console.error('❌ Could not read Supabase session.');
    return;
  }

  const supabaseUrl = 'https://ufgtyfhfdlbqupgvfkpc.supabase.co';
  const anonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3R5ZmhmZGxicXVwZ3Zma3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzIyMTQsImV4cCI6MjEwMDY0ODIxNH0.CvKJOu1fYgYW7D8RV-so8RQUj62yfqyQqiNqQS25vB0';

  async function fetchAll(table) {
    const all = [];
    let from = 0;
    while (true) {
      const url = `${supabaseUrl}/rest/v1/${table}?user_id=eq.${userId}&select=*&order=updated_at.desc&offset=${from}&limit=${PAGE}`;
      const res = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) throw new Error(`${table} fetch failed: ${res.status}`);
      const batch = await res.json();
      if (!batch.length) break;
      all.push(...batch);
      console.log(`  ${table}: fetched ${all.length} so far…`);
      if (batch.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('FlowDB');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txPut(db, store, row) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put({ ...row, synced: true });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  console.log('☁️ Emergency cloud restore starting for user', userId);

  const [notes, folders] = await Promise.all([fetchAll('notes'), fetchAll('folders')]);
  console.log(`✅ Downloaded ${notes.length} notes, ${folders.length} folders from Supabase`);

  const db = await openDb();

  // Clear outbox so bad local uploads are not pushed after reload
  await new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  let added = 0;
  let updated = 0;

  for (const note of notes) {
    const existing = await new Promise((resolve) => {
      const tx = db.transaction('notes', 'readonly');
      const req = tx.objectStore('notes').get(note.id);
      req.onsuccess = () => resolve(req.result);
    });
    if (!existing) added++;
    else updated++;
    await txPut(db, 'notes', note);
  }

  for (const folder of folders) {
    await txPut(db, 'folders', folder);
  }

  db.close();

  console.log(`✅ Wrote ${notes.length} notes to IndexedDB (${added} new, ${updated} updated)`);
  console.log('🔄 Hard refresh now (Cmd+Shift+R) and check your Astra notes.');
})();
