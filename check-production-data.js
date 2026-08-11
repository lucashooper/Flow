// Run this in PRODUCTION browser console (flownotesapp.netlify.app)
// to check what's actually in Supabase

(async function() {
  console.log('🔍 PRODUCTION DATA CHECK');
  console.log('========================\n');
  
  // Get auth info
  const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') && k.includes('auth'));
  let userId = null;
  let userEmail = null;
  
  for (const key of authKeys) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      userEmail = val?.user?.email || val?.session?.user?.email;
      userId = val?.user?.id || val?.session?.user?.id;
      if (userEmail) {
        console.log('👤 Logged in as:', userEmail);
        console.log('🆔 User ID:', userId);
        break;
      }
    } catch {}
  }
  
  if (!userId) {
    console.log('❌ Not logged in');
    return;
  }
  
  // Fetch folders from Supabase
  console.log('\n📁 Fetching folders from Supabase...');
  const foldersResponse = await fetch(
    'https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/folders?select=*&user_id=eq.' + userId,
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
        'Authorization': 'Bearer ' + localStorage.getItem(authKeys[0])
      }
    }
  );
  
  const folders = await foldersResponse.json();
  console.log(`✅ Found ${folders.length} folders in Supabase`);
  
  // Find David meeting folder
  const davidFolder = folders.find(f => 
    f.name && f.name.toLowerCase().includes('david')
  );
  
  if (davidFolder) {
    console.log('\n✅ FOUND David meeting folder in Supabase:');
    console.log('   Name:', davidFolder.name);
    console.log('   ID:', davidFolder.id);
    
    // Fetch notes in that folder
    console.log('\n📝 Fetching notes in David folder...');
    const notesResponse = await fetch(
      'https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/notes?select=*&folder_id=eq.' + davidFolder.id,
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
          'Authorization': 'Bearer ' + localStorage.getItem(authKeys[0])
        }
      }
    );
    
    const notes = await notesResponse.json();
    console.log(`✅ Found ${notes.length} notes in David folder:`);
    notes.forEach(n => console.log(`   - ${n.title}`));
    
    // Check for Lava note
    const lavaNote = notes.find(n => 
      n.title && n.title.toLowerCase().includes('lava')
    );
    
    if (lavaNote) {
      console.log('\n✅ FOUND Lava note in David folder!');
      console.log('   Title:', lavaNote.title);
    } else {
      console.log('\n❌ Lava note NOT in David folder');
    }
  } else {
    console.log('\n❌ David meeting folder NOT in Supabase');
    console.log('📁 Available folders:', folders.map(f => f.name));
  }
  
  // Check IndexedDB too
  console.log('\n\n📦 Checking IndexedDB...');
  const dbRequest = indexedDB.open('flow-notes-db');
  
  dbRequest.onsuccess = async function(event) {
    const db = event.target.result;
    
    // Check folders in IndexedDB
    const foldersTx = db.transaction('folders', 'readonly');
    const foldersStore = foldersTx.objectStore('folders');
    const localFolders = await new Promise(resolve => {
      const req = foldersStore.getAll();
      req.onsuccess = () => resolve(req.result);
    });
    
    console.log(`📁 Folders in IndexedDB: ${localFolders.length}`);
    
    const localDavidFolder = localFolders.find(f => 
      f.name && f.name.toLowerCase().includes('david')
    );
    
    if (localDavidFolder) {
      console.log('✅ David folder EXISTS in IndexedDB');
    } else {
      console.log('❌ David folder NOT in IndexedDB');
    }
    
    db.close();
  };
  
  console.log('\n========================');
  console.log('Done! Check results above.');
})();
