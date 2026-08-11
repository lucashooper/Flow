// Import JSON backup into IndexedDB with new user_id
// Run this in browser console (F12) on your Flow app

// STEP 1: Update this with your NEW user_id from new Supabase
const NEW_USER_ID = 'c4526913-2f33-4f5b-ad2e-44290c9fd640'; // REPLACE THIS

// STEP 2: Paste your JSON data here (or load from file)
// For now, we'll prompt you to paste it
console.log('🔄 Starting import to IndexedDB...\n');

console.log('⚠️  INSTRUCTIONS:');
console.log('1. Open your JSON backup file');
console.log('2. Copy ALL the contents (Ctrl+A, Ctrl+C)');
console.log('3. Come back here and run: importData(pastedJSON)');
console.log('4. Where pastedJSON is the object you copied\n');

window.importData = async function(jsonData) {
  console.log('📊 Analyzing backup data...');
  console.log(`   Notes: ${jsonData.notes?.length || 0}`);
  console.log(`   Folders: ${jsonData.folders?.length || 0}`);
  console.log('');
  
  if (!jsonData.notes || !jsonData.folders) {
    console.error('❌ Invalid JSON format. Expected {notes: [], folders: []}');
    return;
  }
  
  console.log(`🔄 Opening IndexedDB...`);
  
  const dbName = 'flow-notes-db';
  const request = indexedDB.open(dbName);
  
  request.onerror = () => {
    console.error('❌ Failed to open IndexedDB');
  };
  
  request.onsuccess = async (event) => {
    const db = event.target.result;
    console.log('✅ IndexedDB opened\n');
    
    // Import folders first (for foreign key integrity)
    console.log(`📁 Importing ${jsonData.folders.length} folders...`);
    const folderTx = db.transaction('folders', 'readwrite');
    const folderStore = folderTx.objectStore('folders');
    
    let folderCount = 0;
    for (const folder of jsonData.folders) {
      // Replace user_id with new one
      const newFolder = {
        ...folder,
        user_id: NEW_USER_ID
      };
      
      try {
        await new Promise((resolve, reject) => {
          const req = folderStore.put(newFolder);
          req.onsuccess = () => { folderCount++; resolve(); };
          req.onerror = () => reject(req.error);
        });
        
        if (folderCount % 50 === 0) {
          console.log(`   Progress: ${folderCount}/${jsonData.folders.length} folders...`);
        }
      } catch (err) {
        console.error(`   Failed to import folder ${folder.id}:`, err);
      }
    }
    
    console.log(`✅ Imported ${folderCount}/${jsonData.folders.length} folders\n`);
    
    // Import notes
    console.log(`📝 Importing ${jsonData.notes.length} notes...`);
    const noteTx = db.transaction('notes', 'readwrite');
    const noteStore = noteTx.objectStore('notes');
    
    let noteCount = 0;
    for (const note of jsonData.notes) {
      // Replace user_id with new one
      const newNote = {
        ...note,
        user_id: NEW_USER_ID
      };
      
      try {
        await new Promise((resolve, reject) => {
          const req = noteStore.put(newNote);
          req.onsuccess = () => { noteCount++; resolve(); };
          req.onerror = () => reject(req.error);
        });
        
        if (noteCount % 100 === 0) {
          console.log(`   Progress: ${noteCount}/${jsonData.notes.length} notes...`);
        }
      } catch (err) {
        console.error(`   Failed to import note ${note.id}:`, err);
      }
    }
    
    console.log(`✅ Imported ${noteCount}/${jsonData.notes.length} notes\n`);
    
    db.close();
    
    console.log('════════════════════════════════════════');
    console.log('✅ IMPORT COMPLETE!');
    console.log('════════════════════════════════════════');
    console.log(`📁 Folders: ${folderCount}`);
    console.log(`📝 Notes: ${noteCount}`);
    console.log('');
    console.log('🔄 Now refresh the page (F5) and your notes will appear!');
    console.log('💾 They will automatically sync to Supabase.');
  };
};

console.log('✅ Import function ready!');
console.log('\n📝 Next step:');
console.log('   const jsonData = ' + '{...paste your JSON here...}');
console.log('   importData(jsonData);');
