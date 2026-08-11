// Run this in browser console to check if Lava content exists locally

(async function() {
  console.log('🔍 SEARCHING FOR LAVA CONTENT');
  console.log('================================\n');
  
  const dbName = 'flow-notes-db';
  const request = indexedDB.open(dbName);
  
  request.onsuccess = async function(event) {
    const db = event.target.result;
    
    // Get all notes
    const notesTx = db.transaction('notes', 'readonly');
    const notesStore = notesTx.objectStore('notes');
    const allNotes = await new Promise(resolve => {
      const req = notesStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    console.log(`📝 Total notes in IndexedDB: ${allNotes.length}`);
    
    // Find Lava note
    const lavaNote = allNotes.find(n => 
      n.title && (
        n.title.toLowerCase().includes('lava') &&
        n.title.toLowerCase().includes('enterprise')
      )
    );
    
    if (lavaNote) {
      console.log('\n✅ FOUND "Lava Enterprises" note:');
      console.log('   Title:', lavaNote.title);
      console.log('   ID:', lavaNote.id);
      console.log('   Folder ID:', lavaNote.folder_id);
      console.log('   Content length:', lavaNote.content?.length || 0, 'characters');
      console.log('   Updated:', lavaNote.updated_at);
      console.log('   Created:', lavaNote.created_at);
      
      if (lavaNote.content && lavaNote.content.length > 0) {
        console.log('\n📄 CONTENT EXISTS! First 500 chars:');
        console.log(lavaNote.content.substring(0, 500));
        console.log('\n✅ Content is in IndexedDB!');
      } else {
        console.log('\n❌ CONTENT IS EMPTY OR MISSING!');
      }
    } else {
      console.log('\n❌ "Lava Enterprises" note NOT found');
      
      // Try broader search
      console.log('\n🔍 Searching for any note with "lava"...');
      const anyLava = allNotes.filter(n => 
        n.title && n.title.toLowerCase().includes('lava')
      );
      
      if (anyLava.length > 0) {
        console.log(`Found ${anyLava.length} notes with "lava":`);
        anyLava.forEach(n => {
          console.log(`   - "${n.title}" (${n.content?.length || 0} chars)`);
        });
      }
    }
    
    // Get all folders
    const foldersTx = db.transaction('folders', 'readonly');
    const foldersStore = foldersTx.objectStore('folders');
    const allFolders = await new Promise(resolve => {
      const req = foldersStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    // Find Lava Research folder
    const lavaFolder = allFolders.find(f => 
      f.name && f.name.toLowerCase().includes('lava')
    );
    
    if (lavaFolder) {
      console.log('\n📁 FOUND "Lava Research" folder:');
      console.log('   Name:', lavaFolder.name);
      console.log('   ID:', lavaFolder.id);
      
      const notesInFolder = allNotes.filter(n => n.folder_id === lavaFolder.id);
      console.log(`   Notes in folder: ${notesInFolder.length}`);
      notesInFolder.forEach(n => {
        console.log(`     - "${n.title}" (${n.content?.length || 0} chars)`);
      });
    }
    
    db.close();
    console.log('\n================================');
  };
  
  request.onerror = function() {
    console.log('❌ Could not open IndexedDB');
  };
})();
