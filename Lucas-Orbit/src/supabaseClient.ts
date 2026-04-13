import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Lucas-Orbit Supabase env vars missing');
  throw new Error('Missing Supabase environment variables for Lucas-Orbit');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
