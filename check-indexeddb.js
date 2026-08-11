// Run this in browser console (F12) to check IndexedDB data
// Paste this entire script and press Enter

(async function() {
  console.log('🔍 Checking IndexedDB for all users...\n');
  
  const dbName = 'flow-notes-db';
  
  const request = indexedDB.open(dbName);
  
  request.onerror = () => {
    console.error('❌ Failed to open IndexedDB');
  };
  
  request.onsuccess = async (event) => {
    const db = event.target.result;
    
    console.log('📦 IndexedDB opened successfully');
    console.log('Database version:', db.version);
    console.log('Object stores:', Array.from(db.objectStoreNames));
    console.log('');
    
    // Get all notes
    const notesTx = db.transaction('notes', 'readonly');
    const notesStore = notesTx.objectStore('notes');
    const allNotes = await new Promise((resolve, reject) => {
      const req = notesStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    // Get all folders
    const foldersTx = db.transaction('folders', 'readonly');
    const foldersStore = foldersTx.objectStore('folders');
    const allFolders = await new Promise((resolve, reject) => {
      const req = foldersStore.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    console.log('📝 Total notes in IndexedDB:', allNotes.length);
    console.log('📁 Total folders in IndexedDB:', allFolders.length);
    console.log('');
    
    // Group by user_id
    const notesByUser = {};
    const foldersByUser = {};
    
    allNotes.forEach(note => {
      if (!notesByUser[note.user_id]) notesByUser[note.user_id] = [];
      notesByUser[note.user_id].push(note);
    });
    
    allFolders.forEach(folder => {
      if (!foldersByUser[folder.user_id]) foldersByUser[folder.user_id] = [];
      foldersByUser[folder.user_id].push(folder);
    });
    
    console.log('👥 Data grouped by user_id:');
    console.log('');
    
    const userIds = new Set([...Object.keys(notesByUser), ...Object.keys(foldersByUser)]);
    
    userIds.forEach(userId => {
      const noteCount = notesByUser[userId]?.length || 0;
      const folderCount = foldersByUser[userId]?.length || 0;
      
      console.log(`User ID: ${userId}`);
      console.log(`  Notes: ${noteCount}`);
      console.log(`  Folders: ${folderCount}`);
      
      if (noteCount > 0) {
        console.log(`  Sample notes:`, notesByUser[userId].slice(0, 3).map(n => n.title || '(untitled)'));
      }
      console.log('');
    });
    
    // Get current logged in user
    const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.startsWith('sb-'));
    let currentUserId = null;
    
    for (const key of authKeys) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        const user = val?.user || val?.session?.user || val?.currentSession?.user;
        if (user?.id) {
          currentUserId = user.id;
          break;
        }
      } catch {}
    }
    
    console.log('🔑 Currently logged in as user_id:', currentUserId || '(not logged in)');
    console.log('');
    
    if (currentUserId) {
      const hasData = notesByUser[currentUserId]?.length > 0 || foldersByUser[currentUserId]?.length > 0;
      
      if (hasData) {
        console.log('✅ Current user HAS data in IndexedDB');
        console.log('   This should sync automatically');
      } else {
        console.log('❌ Current user has NO data in IndexedDB');
        console.log('   This is why you see 0 notes!');
        console.log('');
        console.log('💡 Solution:');
        console.log('   Option 1: Copy data from old user_id to new user_id');
        console.log('   Option 2: Import from JSON backup');
        console.log('   Option 3: Switch back to old Supabase temporarily');
      }
    }
    
    db.close();
  };
})();
