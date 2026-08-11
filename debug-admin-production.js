// Run this in browser console on your PRODUCTION site
// Press F12, paste this, hit Enter

console.log('=== ADMIN DASHBOARD DEBUG ===');

// 1. Check what email you're logged in as
const authKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.startsWith('sb-'));
console.log('Auth keys found:', authKeys);

let userEmail = null;
for (const key of authKeys) {
  try {
    const val = JSON.parse(localStorage.getItem(key));
    const email = val?.user?.email || val?.session?.user?.email || val?.currentSession?.user?.email;
    if (email) {
      userEmail = email;
      console.log('✅ Logged in as:', email);
      console.log('   Is admin?', email === 'edwardsjonny547@gmail.com');
      break;
    }
  } catch {}
}

if (!userEmail) {
  console.log('❌ Not logged in!');
}

// 2. Check if Settings component exists
const settingsElement = document.querySelector('[class*="Settings"]') || 
                        document.querySelector('nav') ||
                        document.body;
console.log('\n=== SETTINGS HTML ===');
console.log(settingsElement?.innerHTML?.includes('Admin Dashboard') ? 
  '✅ "Admin Dashboard" found in DOM' : 
  '❌ "Admin Dashboard" NOT in DOM'
);

// 3. Check if code is deployed
fetch(window.location.origin + '/assets/index-DxWeFE_r.js')
  .then(r => r.text())
  .then(code => {
    console.log('\n=== DEPLOYED CODE CHECK ===');
    if (code.includes('Admin Dashboard')) {
      console.log('✅ "Admin Dashboard" found in deployed JS');
      console.log('   Problem: React not rendering it');
      console.log('   Reason: Either not logged in as admin, or component logic issue');
    } else {
      console.log('❌ "Admin Dashboard" NOT in deployed JS');
      console.log('   Problem: Old code still deployed');
      console.log('   Solution: Redeploy on Netlify');
    }
  })
  .catch(err => {
    console.log('❌ Could not fetch JS bundle:', err);
    console.log('   Try checking Network tab for the actual bundle name');
  });

// 4. Check React component state
setTimeout(() => {
  console.log('\n=== REACT STATE CHECK ===');
  const allButtons = Array.from(document.querySelectorAll('button'));
  const adminButton = allButtons.find(b => b.textContent?.includes('Admin'));
  if (adminButton) {
    console.log('✅ Admin button exists:', adminButton);
  } else {
    console.log('❌ Admin button not rendered');
    console.log('   All buttons:', allButtons.map(b => b.textContent?.trim()).filter(Boolean));
  }
}, 1000);
