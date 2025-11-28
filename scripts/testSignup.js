/**
 * Supabase Signup Test Script
 * 
 * This script tests signup directly against Supabase to determine if the issue
 * is in our frontend code or in the Supabase project configuration.
 * 
 * Usage:
 *   node scripts/testSignup.js
 * 
 * Make sure you have a .env file with:
 *   VITE_SUPABASE_URL=your-url
 *   VITE_SUPABASE_ANON_KEY=your-key
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('=== Supabase Signup Test ===\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Has Anon Key:', !!supabaseAnonKey);
console.log('');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Missing environment variables!');
  console.error('Please create a .env file with:');
  console.error('  VITE_SUPABASE_URL=your-project-url');
  console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  // Generate unique test email
  const testEmail = `test+${Date.now()}@example.com`;
  const testPassword = 'Test1234!';
  const testUsername = `testuser${Date.now()}`;

  console.log('Test Credentials:');
  console.log('  Email:', testEmail);
  console.log('  Password:', testPassword);
  console.log('  Username:', testUsername);
  console.log('');

  console.log('Attempting signup...\n');

  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername
        }
      }
    });

    if (error) {
      console.error('❌ SIGNUP FAILED');
      console.error('');
      console.error('Error Details:');
      console.error('  Message:', error.message);
      console.error('  Status:', error.status);
      console.error('  Name:', error.name);
      console.error('  Code:', error.code);
      console.error('');
      console.error('Full Error Object:', JSON.stringify(error, null, 2));
      console.error('');
      console.error('=== DIAGNOSIS ===');
      console.error('This error is coming from Supabase, not our frontend code.');
      console.error('');
      console.error('Common causes:');
      console.error('  1. Database trigger/function error on auth.users table');
      console.error('  2. Missing or misconfigured user_profiles table');
      console.error('  3. RLS policy blocking profile creation');
      console.error('  4. Constraint violation (e.g., NOT NULL column)');
      console.error('');
      console.error('Next steps:');
      console.error('  1. Go to Supabase Dashboard → Logs → Database');
      console.error('  2. Look for errors around the signup timestamp');
      console.error('  3. Check if user_profiles table exists and has correct schema');
      console.error('  4. Verify RLS policies allow INSERT for authenticated users');
      process.exit(1);
    }

    console.log('✅ SIGNUP SUCCESSFUL!');
    console.log('');
    console.log('User Data:');
    console.log('  ID:', data.user?.id);
    console.log('  Email:', data.user?.email);
    console.log('  Confirmed:', data.user?.confirmed_at ? 'Yes' : 'No (check email)');
    console.log('  Session:', data.session ? 'Created' : 'None (email confirmation required)');
    console.log('');
    console.log('=== DIAGNOSIS ===');
    console.log('Signup works fine from this script!');
    console.log('The issue might be:');
    console.log('  1. Environment variables not loaded in frontend');
    console.log('  2. CORS issue in browser');
    console.log('  3. Different behavior in dev vs production');

  } catch (err) {
    console.error('❌ UNEXPECTED ERROR');
    console.error('');
    console.error('Error:', err);
    console.error('');
    console.error('This is a JavaScript error, not a Supabase API error.');
    console.error('Check your network connection and Supabase project status.');
    process.exit(1);
  }
}

testSignup().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
