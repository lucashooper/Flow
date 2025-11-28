import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables with detailed error messages
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('=== SUPABASE CONFIGURATION ERROR ===');
  console.error('Missing required environment variables:');
  console.error('  VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  console.error('');
  console.error('Please create a .env file in the project root with:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  VITE_SUPABASE_ANON_KEY=your-anon-key');
  console.error('');
  console.error('Then restart the dev server.');
  throw new Error('Missing Supabase environment variables - check console for details');
}

// Validate URL format
if (!supabaseUrl.startsWith('https://')) {
  console.error('=== SUPABASE CONFIGURATION ERROR ===');
  console.error('Invalid VITE_SUPABASE_URL format:', supabaseUrl);
  console.error('URL must start with https://');
  throw new Error('Invalid Supabase URL format');
}

console.log('✅ Supabase client initialized');
console.log('   URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
