import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/team/members - Get team members for reassignment
export async function GET() {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role and org
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only org_admin and superadmin can fetch team members
    if (profile.role !== 'superadmin' && profile.role !== 'org_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build query based on role
    let query = adminClient
      .from('profiles')
      .select('id, full_name, username, email, role, organization_id');

    if (profile.role === 'org_admin') {
      // Org admins can only see their organization's members
      query = query.eq('organization_id', profile.organization_id);
    }
    // Superadmins see everyone

    const { data: members, error: membersError } = await query.order('full_name');

    if (membersError) {
      console.error('Error fetching team members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    return NextResponse.json({ members: members || [] });

  } catch (error) {
    console.error('Team members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}




