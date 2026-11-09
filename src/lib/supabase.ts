import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isDesktopApp, isVaultMode } from './platform';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when this build can talk to Flow Cloud (desktop builds may ship without it). */
export const hasCloudConfig = Boolean(supabaseUrl && supabaseAnonKey && String(supabaseUrl).startsWith('https://'));

function createCloudClient(): SupabaseClient {
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

return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * The data client the whole app uses.
 *  - Flow Cloud: the real Supabase client.
 *  - Local vault (desktop): a vault-backed stand-in, installed by
 *    bootstrapVault() before the app's modules load (see main.tsx).
 * `export let` gives importers a live binding, so they see the installed client.
 */
export let supabase: SupabaseClient = isVaultMode()
  ? (null as unknown as SupabaseClient)
  : hasCloudConfig || !isDesktopApp()
    ? createCloudClient()
    : createClient('https://cloud-unavailable.invalid', 'unavailable');

export function installSupabaseClient(client: unknown): void {
  supabase = client as SupabaseClient;
}
