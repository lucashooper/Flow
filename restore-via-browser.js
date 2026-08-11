// RESTORE LAVA NOTE VIA BROWSER (AUTHENTICATED)
// 1. Log into http://localhost:5174
// 2. Paste this in console (F12)
// 3. It will restore to IndexedDB, then sync to Supabase

(async function() {
  console.log('🔧 RESTORING LAVA ENTERPRISES NOTE');
  console.log('====================================\n');
  
  // Get auth info
  const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') && k.includes('auth'));
  let userId = null;
  let authToken = null;
  
  for (const key of authKeys) {
    try {
      const val = JSON.parse(localStorage.getItem(key));
      userId = val?.user?.id || val?.session?.user?.id;
      authToken = val?.access_token;
      if (userId) break;
    } catch {}
  }
  
  if (!userId) {
    console.log('❌ Not logged in! Log in first.');
    return;
  }
  
  console.log('👤 User ID:', userId);
  
  // THE LAVA NOTE DATA FROM BACKUP
  // This is the actual note with content
  const lavaNote = {
    id: '4c6c055e-93ef-4ea3-bf8e-63ce6cdd11a8',
    title: 'The Lava Enterprises Opportunity',
    content: `<h3><span style="color: rgb(196, 181, 253); font-size: 2rem;">The Thesis:</span></h3><ul><li><p>The consumer app space is growing rapidly and we are ready to capitalise on it</p></li></ul><p></p><ul><li><p>We build good products with clear differentiation</p></li></ul><p></p><ul><li><p>Distribution is the current bottleneck.</p></li></ul><p></p><ul><li><p>We are a Lean, technical team that iterates quickly.</p></li></ul><p></p><ul><li><p>Funding would rapidly accelerate marketing validation and product iteration.</p></li></ul><p></p><p></p><h3><span style="color: rgb(196, 181, 253); font-size: 2rem;">For David:</span></h3><p></p><p></p><p><span style="color: rgb(226, 232, 240);">We are building high-quality consumer mobile apps in growing markets with clear differentiation.</span></p><p></p><p><span style="color: rgb(226, 232, 240);">Our bottleneck is distribution and customer acquisition, not product quality or technical capability. We can build and ship — we need capital to validate marketing channels and grow.</span></p><p></p><p><span style="color: rgb(226, 232, 240);">I am looking for an initial investment to fund:</span></p><p></p><ol><li><p><span style="color: rgb(226, 232, 240);">Marketing experiments across multiple channels (meta ads, tiktok, youtube)</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Rapid product iteration based on user feedback</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Development of 2-3 additional products to diversify portfolio</span></p></li></ol><p></p><p><span style="color: rgb(226, 232, 240);">Expected outcomes:</span></p><p></p><ul><li><p><span style="color: rgb(226, 232, 240);">Identify scalable acquisition channels</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Achieve product-market fit on 1-2 apps</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Build foundation for sustainable growth</span></p></li></ul><p></p><p></p><h3><span style="color: rgb(196, 181, 253); font-size: 2rem;">The Ask:</span></h3><p></p><p><span style="color: rgb(226, 232, 240);">£50,000 - £100,000 initial investment</span></p><p></p><p><span style="color: rgb(226, 232, 240);">This would fund:</span></p><ul><li><p><span style="color: rgb(226, 232, 240);">6-12 months of focused marketing experiments</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Product iteration and new feature development</span></p></li><li><p><span style="color: rgb(226, 232, 240);">2-3 new product launches</span></p></li><li><p><span style="color: rgb(226, 232, 240);">Operational costs (hosting, tools, design)</span></p></li></ul><p></p>`, // TRUNCATED - full content would be too large for console
    folder_id: '285aa1a1-f90e-4a1a-a7f8-049d8f2fce03',
    user_id: userId, // Use current logged-in user
    dashboard_id: null,
    created_at: '2026-08-06T17:54:37.598914+00:00',
    updated_at: new Date().toISOString(),
    emoji: null,
    is_starred: false,
    position: 0
  };
  
  console.log('⚠️  NOTE: This script has TRUNCATED content for demo.');
  console.log('We need to load the full 12 MB content from the backup file.\n');
  
  // Check if folder exists
  console.log('📁 Checking folder...');
  const folderResponse = await fetch(
    `https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/folders?select=*&id=eq.${lavaNote.folder_id}`,
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  
  const folders = await folderResponse.json();
  
  if (folders.length === 0) {
    console.log('❌ Folder "Meeting Prep" (285aa1a1-f90e-4a1a-a7f8-049d8f2fce03) does NOT exist!');
    console.log('   Need to create it first.');
    return;
  }
  
  console.log('✅ Folder exists:', folders[0].name);
  
  // Try to create the note via authenticated request
  console.log('\n📝 Creating note in Supabase...');
  const createResponse = await fetch(
    'https://oetxqcyktahczrqrxlds.supabase.co/rest/v1/notes',
    {
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ldHhxY3lrdGFoY3pycXJ4bGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MDU4ODYsImV4cCI6MjA3NjE4MTg4Nn0.mMXaaN3eNP3G1ROpO3mf_TDjOjIxGsYSQrQrTvgG2-E',
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(lavaNote)
    }
  );
  
  if (createResponse.ok) {
    const created = await createResponse.json();
    console.log('✅ CREATED note in Supabase!');
    console.log('   Content length:', created[0].content.length);
    console.log('\n⚠️  BUT content is truncated. We need to load full backup.');
  } else {
    const error = await createResponse.text();
    console.log('❌ Failed:', error);
  }
  
  console.log('\n====================================');
  console.log('⚠️  This script needs the FULL backup content.');
  console.log('Let me generate the complete script...');
})();
