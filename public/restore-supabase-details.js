// Paste this entire file in browser console on Flow (localhost or flow-notes.app)
// Restores "Supabase Details" note content from backup into IndexedDB

(async function restoreSupabaseDetailsNote() {
  const NOTE_ID = '3ffff11c-d0f4-4640-b302-94737afd5140';
  const CONTENT = `<p><a target="_blank" rel="noopener noreferrer nofollow" class="text-[#D97706] underline cursor-pointer" href="mailto:edwardsjonny547+growthos@gmail.com">edwardsjonny547+growthos@gmail.com</a></p><p>OldRocks111!</p><p></p><p>Database PW:</p><p>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</p><p></p><p>API keys:<br></p><p>Project URL: <a target="_blank" rel="noopener noreferrer nofollow" class="text-[#D97706] underline cursor-pointer" href="https://ufgtyfhfdlbqupgvfkpc.supabase.co">https://ufgtyfhfdlbqupgvfkpc.supabase.co</a></p><p>Anon key:</p><p>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3R5ZmhmZGxicXVwZ3Zma3BjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzIyMTQsImV4cCI6MjEwMDY0ODIxNH0.CvKJOu1fYgYW7D8RV-so8RQUj62yfqyQqiNqQS25vB0</p><p></p><p></p><p>Publishable key: sb_publishable_d65j9TqSGpMFodtivZjqlg_VJUGiB93</p><p></p><p>Connection String: </p><p>postgresql://postgres:[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]@db.ufgtyfhfdlbqupgvfkpc.supabase.co:5432/postgres</p><p></p><p></p>`;

  console.log('🔧 Restoring Supabase Details note...');

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('FlowDB');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const note = await new Promise((resolve) => {
    const tx = db.transaction('notes', 'readonly');
    const req = tx.objectStore('notes').get(NOTE_ID);
    req.onsuccess = () => resolve(req.result);
  });

  if (!note) {
    console.error('❌ Note not found in IndexedDB on THIS browser.');
    console.log('Try flow-notes.app if you used production, or load full backup via view-notes-offline.html');
    db.close();
    return;
  }

  console.log('Before — content length:', note.content?.length ?? 0);

  note.content = CONTENT;
  note.updated_at = new Date().toISOString();
  note.synced = false;

  await new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    tx.objectStore('notes').put(note);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  console.log('✅ Restored! Content length:', CONTENT.length);
  console.log('🔄 Hard refresh (Ctrl+Shift+R) and reopen the note.');
})();
