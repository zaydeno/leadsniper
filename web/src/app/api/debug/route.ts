import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    // Server client (with user session)
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    results.sessionUser = user ? { id: user.id, email: user.email, metadata: user.user_metadata } : null;
    results.sessionUserError = userError?.message || null;

    if (user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      results.profileViaSession = profileData;
      results.profileViaSessionError = profileError?.message || null;
    }
  } catch (e) {
    results.serverClientError = e instanceof Error ? e.message : String(e);
  }

  try {
    // Admin client (bypasses RLS)
    const adminClient = createAdminClient();
    const { data: allProfiles, error: adminError } = await adminClient
      .from('profiles')
      .select('id, username, email, role, organization_id');
    results.allProfilesViaAdmin = allProfiles;
    results.adminError = adminError?.message || null;
  } catch (e) {
    results.adminClientError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}

