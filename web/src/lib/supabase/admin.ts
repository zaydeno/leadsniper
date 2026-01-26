// Admin Supabase client (Bypasses RLS - Use only in webhooks/server-side)
import { createClient } from '@supabase/supabase-js';

// This client uses the service role key and bypasses RLS
// Only use this for webhook handlers and admin operations
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}




