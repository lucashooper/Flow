// Emergency IndexedDB check
// Paste this in browser console to see what's actually stored

(async function() {
  console.log('🔍 EMERGENCY CHECK - What data exists locally?');
  
  const dbName = 'flow-notes-db';
  const request = indexedDB.open(dbName);
  
  request.onsuccess = async function(event) {
    const db = event.target.result;
    console.log('✅ IndexedDB opened');
    console.log('📊 Object stores:', Array.from(db.objectStoreNames));
    
    // Check notes
    const notesTx = db.transaction('notes', 'readonly');
    const notesStore = notesTx.objectStore('notes');
    const allNotes = await new Promise(resolve => {
      const req = notesStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    console.log(`📝 Total notes in IndexedDB: ${allNotes.length}`);
    
    // Check folders
    const foldersTx = db.transaction('folders', 'readonly');
    const foldersStore = foldersTx.objectStore('folders');
    const allFolders = await new Promise(resolve => {
      const req = foldersStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    console.log(`📁 Total folders in IndexedDB: ${allFolders.length}`);
    
    // Find David meeting folder
    const davidFolder = allFolders.find(f => 
      f.name && f.name.toLowerCase().includes('david')
    );
    
    if (davidFolder) {
      console.log('✅ FOUND David meeting folder:', davidFolder);
      const davidNotes = allNotes.filter(n => n.folder_id === davidFolder.id);
      console.log(`📝 Notes in David folder: ${davidNotes.length}`);
      davidNotes.forEach(n => console.log(`  - ${n.title}`));
    } else {
      console.log('❌ David meeting folder NOT in IndexedDB');
      console.log('📁 Available folders:', allFolders.map(f => f.name));
    }
    
    // Check for "Lava" note
    const lavaNote = allNotes.find(n => 
      n.title && n.title.toLowerCase().includes('lava')
    );
    
    if (lavaNote) {
      console.log('✅ FOUND Lava note:', lavaNote.title);
      console.log('   In folder:', allFolders.find(f => f.id === lavaNote.folder_id)?.name);
    } else {
      console.log('❌ Lava note NOT in IndexedDB');
    }
    
    // Get logged-in user
    const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') && k.includes('auth'));
    console.log('\n👤 Auth tokens found:', authKeys);
    
    for (const key of authKeys) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        const email = val?.user?.email || val?.session?.user?.email;
        const userId = val?.user?.id || val?.session?.user?.id;
        if (email) {
          console.log(`   Email: ${email}`);
          console.log(`   User ID: ${userId}`);
          
          // Check user_id distribution in notes
          const userNotes = allNotes.filter(n => n.user_id === userId);
          console.log(`   Notes with this user_id: ${userNotes.length} / ${allNotes.length}`);
        }
      } catch {}
    }
    
    db.close();
  };
  
  request.onerror = function() {
    console.log('❌ Could not open IndexedDB');
  };
})();
