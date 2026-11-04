import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  const u = url.trim();
  if (u === '' || u.includes('YOUR-PROJECT-REF') || u.includes('your-project-ref') || u === 'https://your-project-ref.supabase.co') {
    return false;
  }
  try {
    return u.startsWith('http://') || u.startsWith('https://');
  } catch {
    return false;
  }
}

function isValidSupabaseKey(key: string | undefined): boolean {
  if (!key) return false;
  const k = key.trim();
  if (k === '' || k === 'YOUR-ANON-PUBLIC-KEY' || k === 'your-anon-public-key') {
    return false;
  }
  return k.length > 10;
}

export function isSupabaseConfigured(): boolean {
  return isValidSupabaseUrl(supabaseUrl) && isValidSupabaseKey(supabaseAnonKey);
}

export function createSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return createClient(supabaseUrl!, supabaseAnonKey!);
}

export function createBrowserSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('createBrowserSupabaseClient should only be called on the client');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isSupabaseConfigured()) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url!, key!);
}

export const hasSupabaseConfig = isSupabaseConfigured();
