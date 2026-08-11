// Run this in browser console (PRODUCTION or LOCAL) to check Supabase

(async function() {
  console.log('🔍 CHECKING LAVA NOTE IN SUPABASE');
  console.log('===================================\n');
  
  // Get auth token
  const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') && k.includes('auth'));
  let authToken = null;
  let userId = null;
  
  for (const key of authKeys) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      authToken = val?.access_token;
      userId = val?.user?.id || val?.session?.user?.id;
      if (authToken) break;
    } catch {}
  }
  
  if (!authToken) {
    console.log('❌ Not logged in');
    return;
  }
  
  console.log('👤 User ID:', userId);
  
  // Search for Lava folder
  console.log('\n📁 Searching for Lava Research folder...');
  const foldersResponse = await fetch(
    `https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/folders?select=*&user_id=eq.${userId}`,
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  
  const folders = await foldersResponse.json();
  console.log(`Found ${folders.length} folders`);
  
  const lavaFolder = folders.find(f => 
    f.name && f.name.toLowerCase().includes('lava')
  );
  
  if (lavaFolder) {
    console.log('✅ FOUND Lava folder:', lavaFolder.name);
    console.log('   Folder ID:', lavaFolder.id);
    
    // Get notes in that folder
    console.log('\n📝 Searching for Lava Enterprises note...');
    const notesResponse = await fetch(
      `https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/notes?select=*&folder_id=eq.${lavaFolder.id}`,
      {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
          'Authorization': `Bearer ${authToken}`
        }
      }
    );
    
    const notes = await notesResponse.json();
    console.log(`Found ${notes.length} notes in folder:`);
    
    const lavaNote = notes.find(n => 
      n.title && n.title.toLowerCase().includes('lava') && n.title.toLowerCase().includes('enterprise')
    );
    
    if (lavaNote) {
      console.log('\n✅ FOUND "Lava Enterprises" note in Supabase:');
      console.log('   Title:', lavaNote.title);
      console.log('   Note ID:', lavaNote.id);
      console.log('   Content length:', lavaNote.content ? lavaNote.content.length : 0, 'characters');
      console.log('   Updated:', lavaNote.updated_at);
      
      if (lavaNote.content && lavaNote.content.length > 100) {
        console.log('\n✅ CONTENT EXISTS IN SUPABASE!');
        console.log('   First 200 chars:', lavaNote.content.substring(0, 200));
      } else {
        console.log('\n❌ CONTENT IS MISSING IN SUPABASE!');
      }
    } else {
      console.log('\n❌ Lava Enterprises note NOT in Supabase');
      console.log('Available notes:', notes.map(n => n.title));
    }
  } else {
    console.log('❌ Lava Research folder NOT in Supabase');
    console.log('Available folders:', folders.map(f => f.name).slice(0, 20));
  }
  
  console.log('\n===================================');
})();
