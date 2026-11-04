import { createClient } from '@supabase/supabase-js';

function cleanEnv(value: string | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v === '' || v.includes('YOUR-PROJECT-REF') || v.includes('your-project-ref') || v.includes('YOUR-ANON') || v.includes('YOUR-')) {
    return null;
  }
  return v;
}

/**
 * Server-side Supabase client.
 *
 * On the server we prefer the SERVICE ROLE key (secret) so that admin writes
 * bypass Row Level Security. The anon key is only used as a fallback when the
 * service role key is not configured (local dev without Supabase secrets).
 *
 * The browser never receives this client; it only ever uses the anon key.
 */
export function createServerSupabaseClient() {
  const supabaseUrl =
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnv(process.env.SUPABASE_URL);

  const serviceKey =
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    cleanEnv(process.env.SUPABASE_SECRET_KEY);

  const anonKey =
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnv(process.env.SUPABASE_ANON_KEY);

  const key = serviceKey || anonKey;

  if (!supabaseUrl || !key) return null;
  if (!supabaseUrl.startsWith('http')) return null;

  return createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}